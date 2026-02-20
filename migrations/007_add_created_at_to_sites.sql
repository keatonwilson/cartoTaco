-- Migration: Add created_at timestamp to sites table
-- This tracks when each establishment was added to help surface new spots to users

-- Add created_at column with default to now
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows with a reasonable default
-- (assuming most existing data was added before the tracking feature)
UPDATE public.sites
SET created_at = '2025-01-01'::TIMESTAMPTZ
WHERE created_at IS NULL;

-- Make the column NOT NULL after backfill
ALTER TABLE public.sites
ALTER COLUMN created_at SET NOT NULL;

-- Add index for efficient querying of recent sites
CREATE INDEX IF NOT EXISTS idx_sites_created_at ON public.sites(created_at DESC);
