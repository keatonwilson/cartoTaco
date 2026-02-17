-- Migration 006: Enable RLS on public data tables with read-only access policies
-- Supabase flags all tables without RLS enabled as a security concern.
-- These tables contain public, read-only data (taco establishment info).
-- Enabling RLS with SELECT-only policies ensures:
--   1. Data remains publicly readable by anon and authenticated users
--   2. INSERT/UPDATE/DELETE are blocked at the RLS level (only service role can write)
--   3. Supabase security advisor warnings are resolved

-- ============================================================
-- sites table
-- ============================================================
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.sites
  FOR SELECT
  USING (true);

-- ============================================================
-- descriptions table
-- ============================================================
ALTER TABLE public.descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.descriptions
  FOR SELECT
  USING (true);

-- ============================================================
-- menu table
-- ============================================================
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.menu
  FOR SELECT
  USING (true);

-- ============================================================
-- hours table
-- ============================================================
ALTER TABLE public.hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.hours
  FOR SELECT
  USING (true);

-- ============================================================
-- salsa table
-- ============================================================
ALTER TABLE public.salsa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.salsa
  FOR SELECT
  USING (true);

-- ============================================================
-- protein table
-- ============================================================
ALTER TABLE public.protein ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.protein
  FOR SELECT
  USING (true);

-- ============================================================
-- summaries table
-- ============================================================
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.summaries
  FOR SELECT
  USING (true);

-- ============================================================
-- item_spec table
-- ============================================================
ALTER TABLE public.item_spec ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.item_spec
  FOR SELECT
  USING (true);

-- ============================================================
-- protein_spec table
-- ============================================================
ALTER TABLE public.protein_spec ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.protein_spec
  FOR SELECT
  USING (true);

-- ============================================================
-- salsa_spec table
-- ============================================================
ALTER TABLE public.salsa_spec ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.salsa_spec
  FOR SELECT
  USING (true);
