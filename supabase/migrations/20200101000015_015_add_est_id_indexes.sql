-- Migration: Add indexes on est_id join columns and spec FK columns
-- These support the sites_complete view JOINs and will improve query
-- performance as the dataset grows.
--
-- All use IF NOT EXISTS so this migration is safe to re-run.
--
-- Dashboard -> SQL Editor -> New Query -> Paste -> Run

-- est_id indexes for the 5 child tables
CREATE INDEX IF NOT EXISTS idx_descriptions_est_id ON public.descriptions(est_id);
CREATE INDEX IF NOT EXISTS idx_menu_est_id ON public.menu(est_id);
CREATE INDEX IF NOT EXISTS idx_hours_est_id ON public.hours(est_id);
CREATE INDEX IF NOT EXISTS idx_salsa_est_id ON public.salsa(est_id);
CREATE INDEX IF NOT EXISTS idx_protein_est_id ON public.protein(est_id);

-- Spec FK indexes for the LEFT JOINs to spec tables
CREATE INDEX IF NOT EXISTS idx_menu_spec_id_1 ON public.menu(specialty_item_id_1);
CREATE INDEX IF NOT EXISTS idx_menu_spec_id_2 ON public.menu(specialty_item_id_2);
CREATE INDEX IF NOT EXISTS idx_menu_spec_id_3 ON public.menu(specialty_item_id_3);
CREATE INDEX IF NOT EXISTS idx_protein_spec_id_1 ON public.protein(protein_spec_id_1);
CREATE INDEX IF NOT EXISTS idx_protein_spec_id_2 ON public.protein(protein_spec_id_2);
CREATE INDEX IF NOT EXISTS idx_protein_spec_id_3 ON public.protein(protein_spec_id_3);
CREATE INDEX IF NOT EXISTS idx_salsa_spec_id_1 ON public.salsa(salsa_spec_id_1);
CREATE INDEX IF NOT EXISTS idx_salsa_spec_id_2 ON public.salsa(salsa_spec_id_2);
