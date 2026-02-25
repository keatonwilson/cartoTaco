-- Migration: Add FK columns to menu, protein, salsa for spec table joins
-- These nullable bigint columns point to the correct row in item_spec, protein_spec,
-- and salsa_spec so that the sites_complete view can JOIN those tables directly
-- instead of filtering by est_id (which those tables don't have).
--
-- Run BEFORE migration 010.
--
-- Dashboard → SQL Editor → New Query → Paste → Run

-- ── menu → item_spec ────────────────────────────────────────────────────────
ALTER TABLE public.menu
  ADD COLUMN IF NOT EXISTS specialty_item_id_1 bigint REFERENCES public.item_spec(id),
  ADD COLUMN IF NOT EXISTS specialty_item_id_2 bigint REFERENCES public.item_spec(id),
  ADD COLUMN IF NOT EXISTS specialty_item_id_3 bigint REFERENCES public.item_spec(id),
  ADD COLUMN IF NOT EXISTS specialty_item_id_4 bigint REFERENCES public.item_spec(id);

-- Back-fill from existing text columns (match by name, take first hit)
UPDATE public.menu m
SET specialty_item_id_1 = (SELECT id FROM public.item_spec WHERE name = m.specialty_item_1 LIMIT 1)
WHERE m.specialty_item_1 IS NOT NULL AND m.specialty_item_1 <> '';

UPDATE public.menu m
SET specialty_item_id_2 = (SELECT id FROM public.item_spec WHERE name = m.specialty_item_2 LIMIT 1)
WHERE m.specialty_item_2 IS NOT NULL AND m.specialty_item_2 <> '';

UPDATE public.menu m
SET specialty_item_id_3 = (SELECT id FROM public.item_spec WHERE name = m.specialty_item_3 LIMIT 1)
WHERE m.specialty_item_3 IS NOT NULL AND m.specialty_item_3 <> '';

-- specialty_item_4 has no matching text column yet; leave NULL for now

-- ── protein → protein_spec ───────────────────────────────────────────────────
ALTER TABLE public.protein
  ADD COLUMN IF NOT EXISTS protein_spec_id_1 bigint REFERENCES public.protein_spec(id),
  ADD COLUMN IF NOT EXISTS protein_spec_id_2 bigint REFERENCES public.protein_spec(id),
  ADD COLUMN IF NOT EXISTS protein_spec_id_3 bigint REFERENCES public.protein_spec(id);

UPDATE public.protein p
SET protein_spec_id_1 = (SELECT id FROM public.protein_spec WHERE name = p.protein_spec_1 LIMIT 1)
WHERE p.protein_spec_1 IS NOT NULL AND p.protein_spec_1 <> '';

UPDATE public.protein p
SET protein_spec_id_2 = (SELECT id FROM public.protein_spec WHERE name = p.protein_spec_2 LIMIT 1)
WHERE p.protein_spec_2 IS NOT NULL AND p.protein_spec_2 <> '';

UPDATE public.protein p
SET protein_spec_id_3 = (SELECT id FROM public.protein_spec WHERE name = p.protein_spec_3 LIMIT 1)
WHERE p.protein_spec_3 IS NOT NULL AND p.protein_spec_3 <> '';

-- ── salsa → salsa_spec ───────────────────────────────────────────────────────
ALTER TABLE public.salsa
  ADD COLUMN IF NOT EXISTS salsa_spec_id_1 bigint REFERENCES public.salsa_spec(id),
  ADD COLUMN IF NOT EXISTS salsa_spec_id_2 bigint REFERENCES public.salsa_spec(id);

UPDATE public.salsa sa
SET salsa_spec_id_1 = (SELECT id FROM public.salsa_spec WHERE name = sa.salsa_spec_1 LIMIT 1)
WHERE sa.salsa_spec_1 IS NOT NULL AND sa.salsa_spec_1 <> '';

UPDATE public.salsa sa
SET salsa_spec_id_2 = (SELECT id FROM public.salsa_spec WHERE name = sa.salsa_spec_2 LIMIT 1)
WHERE sa.salsa_spec_2 IS NOT NULL AND sa.salsa_spec_2 <> '';
