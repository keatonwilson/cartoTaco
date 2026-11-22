-- 039: field sightings and draft styles for the Salsa Atlas
--
-- cartoTacoMenuExtract's Salsa Field Notes page records a "sighting" (this spot
-- serves this salsa: photo, colours sampled against a grey card, date) on
-- site_salsas, and creates new styles as drafts. 036 shipped without the
-- columns for either; this adds them.
--
--   1. site_salsas: photo_url, palette, observed_at, and synced (true = made by
--      sync_site_salsas(), false = made by hand). Existing links to keyed
--      styles are backfilled as synced, which is what the 036 sync assumed.
--   2. salsa_styles.status ('draft' | 'published'); public reads see published
--      only. sites_complete is security_invoker, so a link to a draft style
--      drops out of the view for the public too.
--   3. sync_site_salsas() removes only links it created, and keeps even those
--      while they carry curated data, so re-promoting a menu can't erase
--      field work.
--   4. sites_complete exposes the sighting fields on salsa.styles.

-- ── 1. Sighting columns ─────────────────────────────────────────────────────
ALTER TABLE public.site_salsas
  ADD COLUMN IF NOT EXISTS photo_url   text,
  ADD COLUMN IF NOT EXISTS palette     text[] CHECK (palette IS NULL OR array_to_string(palette, ',') ~ '^#[0-9a-f]{6}(,#[0-9a-f]{6}){0,4}$'),
  ADD COLUMN IF NOT EXISTS observed_at date,
  ADD COLUMN IF NOT EXISTS synced      boolean NOT NULL DEFAULT false;

UPDATE public.site_salsas ss
   SET synced = true
  FROM public.salsa_styles st
 WHERE st.id = ss.style_id
   AND (st.variety_key IS NOT NULL OR st.spec_id IS NOT NULL);

-- ── 2. Draft styles ─────────────────────────────────────────────────────────
ALTER TABLE public.salsa_styles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'));

DROP POLICY IF EXISTS "Allow public read access" ON public.salsa_styles;
CREATE POLICY "Allow public read access" ON public.salsa_styles FOR SELECT USING (status = 'published');

-- ── 3. Sync keeps hand-made links and recorded sightings ────────────────────
CREATE OR REPLACE FUNCTION public.sync_site_salsas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row jsonb := to_jsonb(NEW);
BEGIN
  WITH wanted AS (
    SELECT st.id
      FROM public.salsa_styles st
     WHERE (st.variety_key IS NOT NULL AND (v_row->>(st.variety_key || '_yes'))::boolean IS TRUE)
        OR (st.spec_id IS NOT NULL AND st.spec_id IN (NEW.spec_id_1, NEW.spec_id_2))
  ), gone AS (
    -- Only links this function created. Keying on the link, not on whether the
    -- style is still keyed, matters when a salsa_spec row is deleted: the
    -- style's spec_id goes NULL, and its synced links must still be cleared.
    --
    -- A synced link that carries curated data (a field sighting's photo,
    -- palette or date, or a hand-set heat, house name or note) is kept even
    -- when the salsa row stops implying it: that data is evidence someone
    -- recorded at the spot, and a re-promotion of the menu must not erase it.
    DELETE FROM public.site_salsas ss
     WHERE ss.est_id = NEW.est_id
       AND ss.synced
       AND ss.style_id NOT IN (SELECT id FROM wanted)
       AND ss.photo_url IS NULL AND ss.palette IS NULL AND ss.observed_at IS NULL
       AND ss.heat IS NULL AND ss.house_name IS NULL AND ss.note IS NULL
  )
  -- DO NOTHING keeps a hand-set heat / house_name / note on an existing link,
  -- and leaves a hand-made link hand-made
  INSERT INTO public.site_salsas (est_id, style_id, synced)
  SELECT NEW.est_id, id, true FROM wanted
  ON CONFLICT DO NOTHING;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_site_salsas() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.site_salsas IS 'Which spot serves which salsa style. Rows with synced = true are created by sync_site_salsas() from the salsa table and removed by it only while they carry no curated data (photo_url, palette, observed_at, heat, house_name, note); other rows are hand-made and never touched.';

-- ── 4. View ─────────────────────────────────────────────────────────────────
-- Copied from schema/sites_complete_view.sql (the canonical definition).

DROP VIEW IF EXISTS public.sites_complete;

CREATE VIEW public.sites_complete WITH (security_invoker = true) AS
SELECT
  s.est_id,

  -- Sites table fields (contact, lat_2, lon_2, days_loc_2 removed in migration 016)
  jsonb_build_object(
    'est_id', s.est_id,
    'name', s.name,
    'lat_1', s.lat_1,
    'lon_1', s.lon_1,
    'days_loc_1', s.days_loc_1,
    'type', s.type,
    'last_updated', s.last_updated,
    'created_at', s.created_at,
    'phone', s.phone,
    'website', s.website,
    'instagram', s.instagram,
    'facebook', s.facebook,
    'address', s.address,
    'vetting_status', s.vetting_status,
    'source', s.source,
    'source_url', s.source_url,
    'closed_at', s.closed_at
  ) AS site,

  -- Descriptions table fields
  jsonb_build_object(
    'short_descrip', d.short_descrip,
    'long_descrip', d.long_descrip,
    'region', d.region,
    'last_updated', d.last_updated
  ) AS descriptions,

  -- Menu table fields (burro aliased to burrito in migration 016)
  jsonb_build_object(
    'burrito_yes', m.burro_yes,
    'taco_yes', m.taco_yes,
    'torta_yes', m.torta_yes,
    'dog_yes', m.dog_yes,
    'plate_yes', m.plate_yes,
    'cocktail_yes', m.cocktail_yes,
    'gordita_yes', m.gordita_yes,
    'huarache_yes', m.huarache_yes,
    'cemita_yes', m.cemita_yes,
    'flauta_yes', m.flauta_yes,
    'chalupa_yes', m.chalupa_yes,
    'molote_yes', m.molote_yes,
    'tostada_yes', m.tostada_yes,
    'enchilada_yes', m.enchilada_yes,
    'tamale_yes', m.tamale_yes,
    'sope_yes', m.sope_yes,
    'caldo_yes', m.caldo_yes,
    'snacks_yes', m.snacks_yes,
    'quesadilla_yes', m.quesadilla_yes,
    'burrito_perc', m.burro_perc,
    'taco_perc', m.taco_perc,
    'torta_perc', m.torta_perc,
    'dog_perc', m.dog_perc,
    'plate_perc', m.plate_perc,
    'cocktail_perc', m.cocktail_perc,
    'gordita_perc', m.gordita_perc,
    'huarache_perc', m.huarache_perc,
    'cemita_perc', m.cemita_perc,
    'flauta_perc', m.flauta_perc,
    'chalupa_perc', m.chalupa_perc,
    'molote_perc', m.molote_perc,
    'tostada_perc', m.tostada_perc,
    'enchilada_perc', m.enchilada_perc,
    'tamale_perc', m.tamale_perc,
    'sope_perc', m.sope_perc,
    'caldo_perc', m.caldo_perc,
    'snacks_perc', m.snacks_perc,
    'quesadilla_perc', m.quesadilla_perc,
    'flour_corn', m.flour_corn,
    'handmade_tortilla', m.handmade_tortilla,
    'specialty_items', (
      SELECT jsonb_agg(spec)
      FROM (
        VALUES
          (CASE WHEN is1.id IS NOT NULL THEN jsonb_build_object('id', is1.id, 'name', is1.name, 'short_descrip', is1.short_descrip, 'long_descrip', is1.long_descrip, 'img_url', is1.img_url) END),
          (CASE WHEN is2.id IS NOT NULL THEN jsonb_build_object('id', is2.id, 'name', is2.name, 'short_descrip', is2.short_descrip, 'long_descrip', is2.long_descrip, 'img_url', is2.img_url) END),
          (CASE WHEN is3.id IS NOT NULL THEN jsonb_build_object('id', is3.id, 'name', is3.name, 'short_descrip', is3.short_descrip, 'long_descrip', is3.long_descrip, 'img_url', is3.img_url) END)
      ) AS t(spec)
      WHERE spec IS NOT NULL
    )
  ) AS menu,

  -- Hours table fields
  jsonb_build_object(
    'mon_start', h.mon_start,
    'mon_end', h.mon_end,
    'tue_start', h.tue_start,
    'tue_end', h.tue_end,
    'wed_start', h.wed_start,
    'wed_end', h.wed_end,
    'thu_start', h.thu_start,
    'thu_end', h.thu_end,
    'fri_start', h.fri_start,
    'fri_end', h.fri_end,
    'sat_start', h.sat_start,
    'sat_end', h.sat_end,
    'sun_start', h.sun_start,
    'sun_end', h.sun_end
  ) AS hours,

  -- Salsa table fields
  jsonb_build_object(
    'total_num', sa.total_num,
    'heat_overall', sa.heat_overall,
    'verde_yes', sa.verde_yes,
    'rojo_yes', sa.rojo_yes,
    'pico_yes', sa.pico_yes,
    'pickles_yes', sa.pickles_yes,
    'chipotle_yes', sa.chipotle_yes,
    'avo_yes', sa.avo_yes,
    'molcajete_yes', sa.molcajete_yes,
    'macha_yes', sa.macha_yes,
    'other_1_name', sa.other_1_name,
    'other_1_heat', sa.other_1_heat,
    'other_1_descrip', sa.other_1_descrip,
    'other_2_name', sa.other_2_name,
    'other_2_heat', sa.other_2_heat,
    'other_2_descrip', sa.other_2_descrip,
    'other_3_name', sa.other_3_name,
    'other_3_heat', sa.other_3_heat,
    'other_3_descrip', sa.other_3_descrip,
    'specialty_salsas', (
      SELECT jsonb_agg(spec)
      FROM (
        VALUES
          (CASE WHEN ss1.id IS NOT NULL THEN jsonb_build_object('id', ss1.id, 'name', ss1.name, 'short_descrip', ss1.short_descrip, 'long_descrip', ss1.long_descrip) END),
          (CASE WHEN ss2.id IS NOT NULL THEN jsonb_build_object('id', ss2.id, 'name', ss2.name, 'short_descrip', ss2.short_descrip, 'long_descrip', ss2.long_descrip) END)
      ) AS t(spec)
      WHERE spec IS NOT NULL
    ),
    -- Catalog styles this spot serves (migration 037); 'color' is the style's
    -- definitive hex. NULL when the spot has no links.
    'styles', (
      SELECT jsonb_agg(
               jsonb_build_object('slug', st.slug, 'name', st.name, 'color', st.palette[1],
                                  'heat', ss.heat, 'house_name', ss.house_name, 'note', ss.note,
                                  'photo_url', ss.photo_url, 'palette', ss.palette, 'observed_at', ss.observed_at,
                                  -- the style's flavour profile, for taste-profile matching
                                  'heat_min', st.heat_min, 'heat_max', st.heat_max, 'smoke', st.smoke,
                                  'acid', st.acid, 'sweet', st.sweet, 'chunk', st.chunk, 'rich', st.rich)
               ORDER BY st.name)
      FROM public.site_salsas ss
      JOIN public.salsa_styles st ON st.id = ss.style_id
      WHERE ss.est_id = s.est_id
    )
  ) AS salsa,

  -- Protein table fields
  jsonb_build_object(
    'chicken_yes', p.chicken_yes,
    'beef_yes', p.beef_yes,
    'pork_yes', p.pork_yes,
    'fish_yes', p.fish_yes,
    'veg_yes', p.veg_yes,
    'chicken_perc', p.chicken_perc,
    'beef_perc', p.beef_perc,
    'pork_perc', p.pork_perc,
    'fish_perc', p.fish_perc,
    'veg_perc', p.veg_perc,
    'chicken_style_1', p.chicken_style_1,
    'chicken_style_2', p.chicken_style_2,
    'chicken_style_3', p.chicken_style_3,
    'beef_style_1', p.beef_style_1,
    'beef_style_2', p.beef_style_2,
    'beef_style_3', p.beef_style_3,
    'pork_style_1', p.pork_style_1,
    'pork_style_2', p.pork_style_2,
    'pork_style_3', p.pork_style_3,
    'fish_style_1', p.fish_style_1,
    'fish_style_2', p.fish_style_2,
    'fish_style_3', p.fish_style_3,
    'veg_style_1', p.veg_style_1,
    'veg_style_2', p.veg_style_2,
    'veg_style_3', p.veg_style_3,
    'specialty_proteins', (
      SELECT jsonb_agg(spec)
      FROM (
        VALUES
          (CASE WHEN ps1.id IS NOT NULL THEN jsonb_build_object('id', ps1.id, 'name', ps1.name, 'short_descrip', ps1.short_descrip, 'long_descrip', ps1.long_descrip) END),
          (CASE WHEN ps2.id IS NOT NULL THEN jsonb_build_object('id', ps2.id, 'name', ps2.name, 'short_descrip', ps2.short_descrip, 'long_descrip', ps2.long_descrip) END),
          (CASE WHEN ps3.id IS NOT NULL THEN jsonb_build_object('id', ps3.id, 'name', ps3.name, 'short_descrip', ps3.short_descrip, 'long_descrip', ps3.long_descrip) END)
      ) AS t(spec)
      WHERE spec IS NOT NULL
    )
  ) AS protein

FROM public.sites s
LEFT JOIN public.descriptions d    ON s.est_id = d.est_id
LEFT JOIN public.menu m            ON s.est_id = m.est_id
LEFT JOIN public.hours h           ON s.est_id = h.est_id
LEFT JOIN public.salsa sa          ON s.est_id = sa.est_id
LEFT JOIN public.protein p         ON s.est_id = p.est_id
-- item_spec joins (up to 3 per site; spec_id_N renamed in migration 018)
LEFT JOIN public.item_spec   is1   ON m.spec_id_1 = is1.id
LEFT JOIN public.item_spec   is2   ON m.spec_id_2 = is2.id
LEFT JOIN public.item_spec   is3   ON m.spec_id_3 = is3.id
-- protein_spec joins (up to 3 per site)
LEFT JOIN public.protein_spec ps1  ON p.spec_id_1 = ps1.id
LEFT JOIN public.protein_spec ps2  ON p.spec_id_2 = ps2.id
LEFT JOIN public.protein_spec ps3  ON p.spec_id_3 = ps3.id
-- salsa_spec joins (up to 2 per site)
LEFT JOIN public.salsa_spec   ss1  ON sa.spec_id_1 = ss1.id
LEFT JOIN public.salsa_spec   ss2  ON sa.spec_id_2 = ss2.id;

-- Grant select permissions
GRANT SELECT ON public.sites_complete TO anon;
GRANT SELECT ON public.sites_complete TO authenticated;

COMMENT ON VIEW public.sites_complete IS 'Optimized view combining all site-related tables into a single query. Specialty data embedded as JSONB arrays via FK joins. burro aliased to burrito; unused site fields removed; spec FK columns normalized to spec_id_N. snacks_yes/snacks_perc added in migration 023. quesadilla_yes/quesadilla_perc added in migration 026. vetting_status/source/source_url added in migration 031 (unvetted spots feature). closed_at added in migration 033 (closed spots). salsa.styles added in migration 037 (Salsa Atlas); field-sighting photo_url/palette/observed_at added in migration 039.';
