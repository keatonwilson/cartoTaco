-- Migration 032: Mark permanently closed spots.
--
-- Closed spots stay on the map (history matters, and "whatever happened to X?"
-- deserves an answer) but are visibly marked and drop out of every city-wide
-- rollup. NULL = open, so existing rows need no backfill.
--
-- Orthogonal to vetting_status: a spot can be vetted AND closed. For display
-- precedence the frontend treats closed as outranking pending.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Partial index: closed rows are a small minority of sites
CREATE INDEX IF NOT EXISTS idx_sites_closed_at
  ON public.sites (closed_at)
  WHERE closed_at IS NOT NULL;

COMMENT ON COLUMN public.sites.closed_at IS
  'When the spot closed for good. NULL = open. Closed spots stay on the map, marked closed.';
