-- Migration 025: Fix SECURITY DEFINER warning on sites_complete view
-- The Supabase security advisor flags views created with the view owner's
-- permissions (SECURITY DEFINER behavior) rather than the querying user's.
-- Explicitly setting security_invoker = true ensures the view executes
-- with the caller's permissions, which is the correct and safer default.
--
-- This does not change observable behavior: all underlying tables already
-- have public SELECT policies via migration 006, so anon and authenticated
-- users can read data through the view as before.
--
-- Requires PostgreSQL 15+.

ALTER VIEW public.sites_complete SET (security_invoker = true);
