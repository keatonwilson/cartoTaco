-- Migration 017: Drop legacy specialty text columns
-- Phase 3.1: These text columns were replaced by FK integer columns in migration 009.
-- The view no longer references them (since migration 011).
-- Safe to drop now that all data is accessed via FK joins.
--
-- Dashboard → SQL Editor → New Query → Paste → Run

-- ── menu: drop legacy text columns ──────────────────────────────────────────
ALTER TABLE public.menu
  DROP COLUMN IF EXISTS specialty_item_1,
  DROP COLUMN IF EXISTS specialty_item_2,
  DROP COLUMN IF EXISTS specialty_item_3;

-- ── protein: drop legacy text columns ───────────────────────────────────────
ALTER TABLE public.protein
  DROP COLUMN IF EXISTS protein_spec_1,
  DROP COLUMN IF EXISTS protein_spec_2,
  DROP COLUMN IF EXISTS protein_spec_3;

-- ── salsa: drop legacy text columns ─────────────────────────────────────────
ALTER TABLE public.salsa
  DROP COLUMN IF EXISTS salsa_spec_1,
  DROP COLUMN IF EXISTS salsa_spec_2;
