-- Migration: Add foreign key constraints on est_id for child tables
-- These formalize the existing relationships that are currently only
-- enforced by LEFT JOINs in the view.
--
-- BEFORE RUNNING: Verify no orphan rows exist by running these checks:
--   SELECT d.est_id FROM descriptions d LEFT JOIN sites s ON d.est_id = s.est_id WHERE s.est_id IS NULL;
--   SELECT m.est_id FROM menu m LEFT JOIN sites s ON m.est_id = s.est_id WHERE s.est_id IS NULL;
--   SELECT h.est_id FROM hours h LEFT JOIN sites s ON h.est_id = s.est_id WHERE s.est_id IS NULL;
--   SELECT sa.est_id FROM salsa sa LEFT JOIN sites s ON sa.est_id = s.est_id WHERE s.est_id IS NULL;
--   SELECT p.est_id FROM protein p LEFT JOIN sites s ON p.est_id = s.est_id WHERE s.est_id IS NULL;
-- If any return rows, fix the data first.
--
-- Dashboard -> SQL Editor -> New Query -> Paste -> Run

ALTER TABLE public.descriptions
  ADD CONSTRAINT fk_descriptions_sites FOREIGN KEY (est_id) REFERENCES public.sites(est_id);

ALTER TABLE public.menu
  ADD CONSTRAINT fk_menu_sites FOREIGN KEY (est_id) REFERENCES public.sites(est_id);

ALTER TABLE public.hours
  ADD CONSTRAINT fk_hours_sites FOREIGN KEY (est_id) REFERENCES public.sites(est_id);

ALTER TABLE public.salsa
  ADD CONSTRAINT fk_salsa_sites FOREIGN KEY (est_id) REFERENCES public.sites(est_id);

ALTER TABLE public.protein
  ADD CONSTRAINT fk_protein_sites FOREIGN KEY (est_id) REFERENCES public.sites(est_id);
