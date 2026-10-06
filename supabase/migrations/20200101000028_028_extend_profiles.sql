-- Migration 028: Extend profiles for public-facing identity.
-- Adds:
--   - username: lowercase slug (3-20 chars, alphanumeric + underscore), UNIQUE
--   - bio: optional 280-char self-description
-- Auto-generates a username on signup from the email local-part with collision
-- handling. Backfills usernames for any existing rows that don't have one yet.
-- Opens up SELECT to anon/authenticated so /u/[username] pages can render
-- without auth. (Email is intentionally NOT queried by client code on the
-- public surface; only display_name, username, avatar_url, bio, created_at.)

-- 1) Schema: new columns. Username constraint allows 3-20 lowercase + digit +
--    underscore, which keeps URLs readable and prevents homograph attacks.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
    CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 280);

-- 2) Username generator: derive a slug from a base string, with a counter
--    suffix on collision. Used by both the signup trigger and the backfill.
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_input TEXT, fallback_seed TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INT := 0;
BEGIN
  base_slug := lower(regexp_replace(coalesce(base_input, ''), '[^a-z0-9_]+', '_', 'g'));
  base_slug := substring(base_slug from 1 for 16);
  base_slug := trim(both '_' from base_slug);
  IF base_slug IS NULL OR length(base_slug) < 3 THEN
    base_slug := 'user_' || substr(replace(coalesce(fallback_seed, ''), '-', ''), 1, 8);
  END IF;
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    counter := counter + 1;
    candidate := substring(base_slug from 1 for 16) || '_' || counter::text;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3) Update the new-user trigger to assign a username on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uname TEXT;
BEGIN
  uname := public.generate_unique_username(split_part(new.email, '@', 1), new.id::text);
  INSERT INTO public.profiles (id, email, display_name, username)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'display_name',
    uname
  );
  RETURN new;
END;
$$;

-- 4) Backfill usernames for any existing rows.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, email FROM public.profiles WHERE username IS NULL LOOP
    UPDATE public.profiles
    SET username = public.generate_unique_username(split_part(rec.email, '@', 1), rec.id::text)
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 5) Now that every row has a username, enforce NOT NULL and UNIQUE.
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (username);

-- 6) Open up SELECT for public profile browsing. The existing own-only SELECT
--    policy stays in place; this adds a permissive policy alongside it. Client
--    code is responsible for not surfacing the email column on public pages.
CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- (Optional cleanup: drop the redundant own-only SELECT policy. We keep it
-- for now since multiple permissive SELECT policies are OR'd, harmless.)

COMMENT ON COLUMN public.profiles.username IS 'Public URL slug; lowercase, 3-20 chars, [a-z0-9_].';
COMMENT ON COLUMN public.profiles.bio IS 'Optional 280-char self-description shown on /u/[username].';
