-- Migration 020: Drop unused columns from the sites table
-- Phase 5: These columns were removed from the sites_complete view in
-- migration 016. They are not referenced anywhere in the application.
--   - contact: legacy field, replaced by phone/website/instagram/facebook
--   - lat_2, lon_2, days_loc_2: secondary location fields, never used
--
-- Dashboard → SQL Editor → New Query → Paste → Run

ALTER TABLE public.sites
  DROP COLUMN IF EXISTS contact,
  DROP COLUMN IF EXISTS lat_2,
  DROP COLUMN IF EXISTS lon_2,
  DROP COLUMN IF EXISTS days_loc_2;
