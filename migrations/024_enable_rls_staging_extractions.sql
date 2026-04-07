-- Migration 024: Enable RLS on staging_extractions
-- This table is used by the admin data-entry helper app (input interface
-- for adding new establishments to the backend).
-- Enable RLS to resolve the Supabase security advisor warning.
-- Policies allow authenticated users full read/write access;
-- anonymous users are blocked entirely.
-- The service role bypasses RLS and retains unrestricted access.

ALTER TABLE public.staging_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access"
  ON public.staging_extractions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert"
  ON public.staging_extractions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update"
  ON public.staging_extractions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
