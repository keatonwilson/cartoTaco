-- 038: favourite salsas
--
-- Signed-in users can favourite a salsa style from its Salsa Atlas page, the
-- same way they favourite a spot (user_favorites, migration 005). The taste
-- profile uses these to pull recommendations toward spots serving salsas with
-- a similar flavour profile.

CREATE TABLE IF NOT EXISTS public.user_favorite_salsas (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_id   bigint NOT NULL REFERENCES public.salsa_styles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, style_id)
);

ALTER TABLE public.user_favorite_salsas ENABLE ROW LEVEL SECURITY;

-- Own rows only; nothing is public (unlike vibe_votes, there is no aggregate)
DROP POLICY IF EXISTS "Users can view own favorite salsas" ON public.user_favorite_salsas;
CREATE POLICY "Users can view own favorite salsas"
  ON public.user_favorite_salsas FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorite salsas" ON public.user_favorite_salsas;
CREATE POLICY "Users can insert own favorite salsas"
  ON public.user_favorite_salsas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorite salsas" ON public.user_favorite_salsas;
CREATE POLICY "Users can delete own favorite salsas"
  ON public.user_favorite_salsas FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.user_favorite_salsas TO authenticated;

COMMENT ON TABLE public.user_favorite_salsas IS 'Salsa styles a user has favourited (Salsa Atlas). Feeds the taste profile.';
