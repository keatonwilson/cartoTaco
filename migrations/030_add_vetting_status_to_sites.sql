-- Migration 030: Add vetting status + provenance columns to sites.
-- Supports the "unvetted spots" feature: preliminary spots sourced from web
-- scraping (via the cartoTacoMenuExtract admin tool) appear on the map as
-- 'pending' until the team visits and promotes full menu data, which flips
-- them to 'vetted'.
--
-- Existing rows are all editorial/vetted; the NOT NULL DEFAULTs backfill them.
-- Safe to run before any frontend changes — nothing renders differently until
-- a pending row exists AND the frontend reads the flag.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS vetting_status TEXT NOT NULL DEFAULT 'vetted'
    CHECK (vetting_status IN ('vetted', 'pending')),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'editorial'
    CHECK (source IN ('editorial', 'web_scrape', 'user_submission')),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vetted_at TIMESTAMPTZ;

-- Partial index: pending rows will always be a small minority of sites
CREATE INDEX IF NOT EXISTS idx_sites_vetting_status
  ON public.sites (vetting_status)
  WHERE vetting_status <> 'vetted';

COMMENT ON COLUMN public.sites.vetting_status IS
  'vetted = editorially reviewed/visited; pending = web-scraped preliminary spot awaiting a visit';
COMMENT ON COLUMN public.sites.source IS
  'How this site entered the database: editorial, web_scrape, or user_submission';
COMMENT ON COLUMN public.sites.source_url IS
  'Primary URL the preliminary data was scraped from (shown as provenance on the pending card)';
COMMENT ON COLUMN public.sites.scraped_at IS
  'When the preliminary data was scraped (admin-side; not exposed in sites_complete)';
COMMENT ON COLUMN public.sites.vetted_at IS
  'When the spot was promoted from pending to vetted (admin-side; not exposed in sites_complete)';

-- ============================================================
-- Deletion path for retracted pending spots
-- ============================================================
-- user_favorites.est_id and vibe_votes.est_id currently have NO foreign key
-- to sites (only user_id -> auth.users). Add FKs with ON DELETE CASCADE so
-- retracting a pending spot (or any future site deletion) cannot leave
-- orphaned favorites/votes. Clean up any existing orphans first, mirroring
-- the orphan-check approach of migration 014.

DELETE FROM public.user_favorites f
WHERE NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.est_id = f.est_id);

DELETE FROM public.vibe_votes v
WHERE NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.est_id = v.est_id);

ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS fk_user_favorites_sites,
  ADD CONSTRAINT fk_user_favorites_sites
    FOREIGN KEY (est_id) REFERENCES public.sites(est_id) ON DELETE CASCADE;

ALTER TABLE public.vibe_votes
  DROP CONSTRAINT IF EXISTS fk_vibe_votes_sites,
  ADD CONSTRAINT fk_vibe_votes_sites
    FOREIGN KEY (est_id) REFERENCES public.sites(est_id) ON DELETE CASCADE;
