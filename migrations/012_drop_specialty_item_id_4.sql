-- Migration: Drop unused specialty_item_id_4 column from menu table
-- This column was added in 009 but there is no specialty_item_4 text column
-- to backfill from, so it is always NULL. Remove it and update the view
-- to drop the corresponding is4 JOIN.
--
-- Dashboard → SQL Editor → New Query → Paste → Run

-- Must drop the view first because it references menu.specialty_item_id_4
DROP VIEW IF EXISTS public.sites_complete;

-- Drop the unused FK column
ALTER TABLE public.menu DROP COLUMN IF EXISTS specialty_item_id_4;

-- Recreate the view without the is4 JOIN (otherwise identical to migration 011)
CREATE VIEW public.sites_complete AS
SELECT
  s.est_id,

  -- Sites table fields
  jsonb_build_object(
    'est_id', s.est_id,
    'name', s.name,
    'lat_1', s.lat_1,
    'lon_1', s.lon_1,
    'days_loc_1', s.days_loc_1,
    'lat_2', s.lat_2,
    'lon_2', s.lon_2,
    'days_loc_2', s.days_loc_2,
    'contact', s.contact,
    'type', s.type,
    'last_updated', s.last_updated,
    'created_at', s.created_at,
    'phone', s.phone,
    'website', s.website,
    'instagram', s.instagram,
    'facebook', s.facebook,
    'address', s.address
  ) AS site,

  -- Descriptions table fields
  jsonb_build_object(
    'short_descrip', d.short_descrip,
    'long_descrip', d.long_descrip,
    'region', d.region,
    'last_updated', d.last_updated
  ) AS descriptions,

  -- Menu table fields (specialty_items: up to 3 item_spec entries)
  jsonb_build_object(
    'burro_yes', m.burro_yes,
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
-- item_spec joins (up to 3 per site)
LEFT JOIN public.item_spec   is1   ON m.specialty_item_id_1 = is1.id
LEFT JOIN public.item_spec   is2   ON m.specialty_item_id_2 = is2.id
LEFT JOIN public.item_spec   is3   ON m.specialty_item_id_3 = is3.id
-- protein_spec joins (up to 3 per site)
LEFT JOIN public.protein_spec ps1  ON p.protein_spec_id_1 = ps1.id
LEFT JOIN public.protein_spec ps2  ON p.protein_spec_id_2 = ps2.id
LEFT JOIN public.protein_spec ps3  ON p.protein_spec_id_3 = ps3.id
-- salsa_spec joins (up to 2 per site)
LEFT JOIN public.salsa_spec   ss1  ON sa.salsa_spec_id_1 = ss1.id
LEFT JOIN public.salsa_spec   ss2  ON sa.salsa_spec_id_2 = ss2.id;

-- Grant select permissions to authenticated and anonymous users
GRANT SELECT ON public.sites_complete TO anon;
GRANT SELECT ON public.sites_complete TO authenticated;

COMMENT ON VIEW public.sites_complete IS 'Optimized view combining all site-related tables into a single query. Specialty data embedded as JSONB arrays: up to 3 item specs, 3 protein specs, 2 salsa specs.';
