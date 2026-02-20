-- Migration: Update sites_complete view to include created_at
-- This adds the created_at timestamp to the optimized view for tracking new establishments

-- Drop the existing view
DROP VIEW IF EXISTS public.sites_complete;

-- Create the updated complete sites view with created_at
CREATE VIEW public.sites_complete AS
SELECT
  s.est_id,
  -- Sites table fields (including created_at for recently added tracking)
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

  -- Menu table fields
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
    'specialty_item_1', m.specialty_item_1,
    'specialty_item_2', m.specialty_item_2,
    'specialty_item_3', m.specialty_item_3
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
    'salsa_spec_1', sa.salsa_spec_1,
    'salsa_spec_2', sa.salsa_spec_2,
    'other_1_name', sa.other_1_name,
    'other_1_heat', sa.other_1_heat,
    'other_1_descrip', sa.other_1_descrip,
    'other_2_name', sa.other_2_name,
    'other_2_heat', sa.other_2_heat,
    'other_2_descrip', sa.other_2_descrip,
    'other_3_name', sa.other_3_name,
    'other_3_heat', sa.other_3_heat,
    'other_3_descrip', sa.other_3_descrip
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
    'protein_spec_1', p.protein_spec_1,
    'protein_spec_2', p.protein_spec_2,
    'protein_spec_3', p.protein_spec_3
  ) AS protein

FROM public.sites s
LEFT JOIN public.descriptions d ON s.est_id = d.est_id
LEFT JOIN public.menu m ON s.est_id = m.est_id
LEFT JOIN public.hours h ON s.est_id = h.est_id
LEFT JOIN public.salsa sa ON s.est_id = sa.est_id
LEFT JOIN public.protein p ON s.est_id = p.est_id;

-- Grant select permissions to authenticated and anonymous users
GRANT SELECT ON public.sites_complete TO anon;
GRANT SELECT ON public.sites_complete TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW public.sites_complete IS 'Optimized view combining all site-related tables into a single query to reduce network overhead';
