-- Migration 019: Drop the summaries table
-- Phase 4: The summaries table is no longer queried. Summary stats (max/avg
-- salsa count, heat levels) are now computed client-side from processedTacoData
-- (see stores.js summaryStats derived store, added in Phase 1).
--
-- Dashboard → SQL Editor → New Query → Paste → Run

-- Drop RLS policies first
DROP POLICY IF EXISTS "Allow public read access to summaries" ON public.summaries;

-- Drop the table
DROP TABLE IF EXISTS public.summaries;
