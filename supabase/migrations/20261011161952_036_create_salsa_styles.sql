-- 036: salsa catalog + spot↔salsa links (Salsa Atlas)
--
-- Until now a spot's salsas were 8 booleans on `salsa` (verde_yes, …) plus at
-- most 2 linked salsa_spec rows. Nothing described what a salsa is, and nothing
-- went from a salsa to the spots serving it.
--
--   1. salsa_styles  — the catalog: ingredients, history, palette of hex codes,
--                      optional photo. Backs /salsa and /salsa/[slug].
--   2. site_salsas   — which spot serves which style, with optional per-spot
--                      heat / house name / note. No per-spot cap.
--   3. sync_site_salsas() keeps site_salsas in step with the `salsa` row, which
--      stays the thing cartoTacoMenuExtract writes. One direction only.
--   4. `salsas` storage bucket for photos (uploaded through the dashboard).
--
-- A style is tied to the legacy data by `variety_key` (verde → salsa.verde_yes)
-- or `spec_id` (→ salsa_spec). Styles with neither are hand-curated: the sync
-- never creates or removes their links.

-- ── Catalog ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salsa_styles (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text NOT NULL,
  family      text NOT NULL CHECK (family IN ('fresca', 'cooked', 'dried-chile', 'oil', 'creamy', 'pickled', 'mole')),
  -- Coarse bucket for clustering the atlas by region; `origin` is the display text
  region      text NOT NULL CHECK (region IN ('north', 'west', 'central', 'south', 'everywhere')),
  -- Flavour profile, each 0–10: smokiness, acidity, sweetness, chunkiness
  -- (0 = smooth), richness (fat, oil, nuts). Editorial estimates; they place the
  -- salsa on the detail page's map and decide which salsas count as relatives.
  smoke       smallint NOT NULL CHECK (smoke BETWEEN 0 AND 10),
  acid        smallint NOT NULL CHECK (acid BETWEEN 0 AND 10),
  sweet       smallint NOT NULL CHECK (sweet BETWEEN 0 AND 10),
  chunk       smallint NOT NULL CHECK (chunk BETWEEN 0 AND 10),
  rich        smallint NOT NULL CHECK (rich BETWEEN 0 AND 10),
  tagline     text NOT NULL,
  origin      text,
  history     text,
  ingredients text[] NOT NULL DEFAULT '{}',
  heat_min    smallint CHECK (heat_min BETWEEN 0 AND 10),
  heat_max    smallint CHECK (heat_max BETWEEN 0 AND 10),
  -- 3–5 lowercase hex codes; the first is the salsa's definitive colour
  palette     text[] NOT NULL CHECK (array_to_string(palette, ',') ~ '^#[0-9a-f]{6}(,#[0-9a-f]{6}){2,4}$'),
  img_url     text,
  img_credit  text,
  variety_key text UNIQUE CHECK (variety_key IN ('verde', 'rojo', 'pico', 'pickles', 'chipotle', 'avo', 'molcajete', 'macha')),
  spec_id     bigint UNIQUE REFERENCES public.salsa_spec(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (heat_min <= heat_max)
);

CREATE TABLE IF NOT EXISTS public.site_salsas (
  est_id     bigint NOT NULL REFERENCES public.sites(est_id) ON DELETE CASCADE,
  style_id   bigint NOT NULL REFERENCES public.salsa_styles(id) ON DELETE CASCADE,
  heat       smallint CHECK (heat BETWEEN 0 AND 10),
  house_name text,
  note       text,
  PRIMARY KEY (est_id, style_id)
);

CREATE INDEX IF NOT EXISTS site_salsas_style_id_idx ON public.site_salsas (style_id);

-- Public read, no write policies (service role only) — same as migration 006
ALTER TABLE public.salsa_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_salsas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.salsa_styles;
CREATE POLICY "Allow public read access" ON public.salsa_styles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.site_salsas;
CREATE POLICY "Allow public read access" ON public.site_salsas FOR SELECT USING (true);

GRANT SELECT ON public.salsa_styles, public.site_salsas TO anon, authenticated;

-- ── Sync: salsa row → site_salsas ────────────────────────────────────────────
-- Definer rights: whoever writes the salsa row may not be able to write
-- site_salsas (RLS, no write policies).
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
    -- Only keyed styles: a hand-curated link is never removed here
    DELETE FROM public.site_salsas ss
     USING public.salsa_styles st
     WHERE ss.est_id = NEW.est_id
       AND st.id = ss.style_id
       AND (st.variety_key IS NOT NULL OR st.spec_id IS NOT NULL)
       AND st.id NOT IN (SELECT id FROM wanted)
  )
  -- DO NOTHING keeps a hand-set heat / house_name / note on an existing link
  INSERT INTO public.site_salsas (est_id, style_id)
  SELECT NEW.est_id, id FROM wanted
  ON CONFLICT DO NOTHING;

  RETURN NULL;
END;
$$;

-- AFTER, so it sees the spec ids filled in by salsa_fill_spec_links (034)
DROP TRIGGER IF EXISTS salsa_sync_site_salsas ON public.salsa;
CREATE TRIGGER salsa_sync_site_salsas
  AFTER INSERT OR UPDATE ON public.salsa
  FOR EACH ROW EXECUTE FUNCTION public.sync_site_salsas();

-- Adding or re-keying a style re-syncs every spot, so a new catalog entry picks
-- up the spots that already serve it. This is also what backfills the seed below.
CREATE OR REPLACE FUNCTION public.resync_site_salsas_on_style_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.salsa SET est_id = est_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS salsa_styles_resync_insert ON public.salsa_styles;
CREATE TRIGGER salsa_styles_resync_insert
  AFTER INSERT ON public.salsa_styles
  FOR EACH STATEMENT EXECUTE FUNCTION public.resync_site_salsas_on_style_change();

DROP TRIGGER IF EXISTS salsa_styles_resync_update ON public.salsa_styles;
CREATE TRIGGER salsa_styles_resync_update
  AFTER UPDATE OF variety_key, spec_id ON public.salsa_styles
  FOR EACH STATEMENT EXECUTE FUNCTION public.resync_site_salsas_on_style_change();

REVOKE EXECUTE ON FUNCTION public.sync_site_salsas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resync_site_salsas_on_style_change() FROM PUBLIC, anon, authenticated;

-- ── Photo bucket ─────────────────────────────────────────────────────────────
-- Public bucket: objects are readable by URL without a storage policy. No write
-- policies on purpose — photos go in through the dashboard / service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('salsas', 'salsas', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- Editorial text is a first draft for review. spec_id is resolved by name
-- (resolve_spec_id, 034) because spec ids differ between environments; a spec
-- missing from an environment just leaves that style unkeyed.
INSERT INTO public.salsa_styles
  (slug, name, family, region, smoke, acid, sweet, chunk, rich, tagline, origin, heat_min, heat_max, palette, variety_key, spec_id, ingredients, history)
VALUES
  ('verde', 'Salsa Verde', 'cooked', 'central', 1, 8, 2, 3, 2,
   'Tart, green and on almost every table in town.',
   'Central Mexico', 2, 6,
   ARRAY['#7a9a2e', '#a8b545', '#4f6b1f', '#d9d27a'], 'verde', NULL,
   ARRAY['Tomatillo', 'Serrano or jalapeño', 'White onion', 'Garlic', 'Cilantro', 'Salt'],
   'The tomatillo was domesticated in Mesoamerica long before the red tomato travelled the world, and sauces built on it are among the oldest in the Mexican kitchen. Sixteenth-century Spanish accounts of the markets of Tenochtitlan describe vendors selling sauces of tomato and chile in many combinations. The tomatillo''s natural acidity is the point: boiled it turns soft and bright, roasted it turns sweet and smoky. In Tucson it is the default green on the salsa bar, the one you reach for with carnitas and anything fried.'),

  ('rojo', 'Salsa Roja', 'cooked', 'everywhere', 2, 5, 3, 3, 2,
   'The house red: tomato, chile, and a point of view.',
   'Throughout Mexico', 2, 7,
   ARRAY['#b3261e', '#d9482b', '#7a1712', '#f0a05a'], 'rojo', NULL,
   ARRAY['Tomato', 'Red chiles, fresh or dried', 'White onion', 'Garlic', 'Salt'],
   'Salsa roja is less a recipe than a category. Every kitchen has one and no two match: some are built on fresh jalapeño and boiled tomato, others on toasted dried chiles with barely any tomato at all. What they share is the pairing of tomato and chile, both native to the Americas and combined in Mesoamerican cooking for thousands of years. A spot''s red is often the quickest read on its cooking, which is why it is the most commonly served salsa in the CartoTaco data.'),

  ('pico-de-gallo', 'Pico de Gallo', 'fresca', 'everywhere', 0, 6, 3, 10, 1,
   'Raw, chopped, and dressed in the colours of the flag.',
   'Throughout Mexico', 1, 4,
   ARRAY['#d8362f', '#f4f1e6', '#3f8f3a', '#e9c84a'], 'pico', NULL,
   ARRAY['Tomato', 'White onion', 'Serrano or jalapeño', 'Cilantro', 'Lime', 'Salt'],
   'Nothing is cooked and nothing is blended: pico de gallo is knife work. It also goes by salsa mexicana and salsa bandera, because its red, white and green match the Mexican flag. The name means "rooster''s beak", and nobody has settled why; the explanations on offer range from the pecking motion of eating it with your fingers to the bite of the chile. In northern Mexico and Arizona it is as much a topping as a salsa, piled onto carne asada for crunch and acid.'),

  ('escabeche', 'Escabeche', 'pickled', 'everywhere', 0, 9, 2, 9, 1,
   'Pickled jalapeños, carrots and onion from the corner of the salsa bar.',
   'Spain, by way of Mexico', 2, 5,
   ARRAY['#e58a2b', '#5f8a3a', '#f2e3b3', '#c7453a'], 'pickles', NULL,
   ARRAY['Jalapeño', 'Carrot', 'White onion', 'Garlic', 'Vinegar', 'Mexican oregano', 'Bay leaf'],
   'Escabeche is a technique before it is a condiment: food preserved in a seasoned vinegar. It reached Mexico with the Spanish, who had inherited it from the medieval Arab kitchen, and it met the jalapeño there. The result, chiles en escabeche, became a pantry staple and later one of Mexico''s best-known canned goods. At a Tucson taquería it is the tub of sliced carrots, chiles and onion beside the salsas, there to cut through fat between bites.'),

  ('chipotle', 'Salsa de Chipotle', 'dried-chile', 'central', 9, 4, 3, 2, 3,
   'Smoke first, then heat.',
   'Central Mexico', 4, 7,
   ARRAY['#8a3b1e', '#b5562a', '#4a1f12', '#d99a5b'], 'chipotle', NULL,
   ARRAY['Chipotle chiles', 'Tomato or tomatillo', 'Garlic', 'Onion', 'Vinegar', 'Salt'],
   'A chipotle is a jalapeño left on the plant until red, then dried over smoke. The name comes from the Nahuatl chilpoctli, "smoked chile", and the method predates the Spanish: smoking was a practical way to preserve a thick-fleshed chile that rots before it air-dries. Blended into salsa it gives a deep brick colour and a flavour closer to barbecue than to fresh chile. It is the rarest of the standard varieties in the CartoTaco data.'),

  ('aguacate', 'Salsa de Aguacate', 'creamy', 'central', 0, 6, 1, 1, 7,
   'Pourable, pale green, and not guacamole.',
   'Central Mexico', 2, 6,
   ARRAY['#9bbf4d', '#c9d97a', '#5c7f2a', '#f1efc4'], 'avo', NULL,
   ARRAY['Avocado', 'Tomatillo', 'Serrano', 'Cilantro', 'Lime', 'Salt'],
   'The taquería avocado salsa is thin enough to pour from a squeeze bottle: avocado blended with raw or boiled tomatillo and green chile until smooth. Avocados have been eaten in Mexico for thousands of years, and the word guacamole comes from the Nahuatl ahuacamolli, "avocado sauce", so the idea of avocado as a sauce is the older one. The creamy green is cooling at first and then the serrano arrives, which makes it a favourite on al pastor and asada.'),

  ('molcajete', 'Salsa de Molcajete', 'cooked', 'everywhere', 5, 5, 3, 7, 2,
   'Roasted, then ground by hand in volcanic stone.',
   'Throughout Mexico', 3, 7,
   ARRAY['#5b5a55', '#a8402a', '#2f2e2b', '#c9b79a'], 'molcajete', NULL,
   ARRAY['Roasted tomato or tomatillo', 'Roasted chiles', 'Garlic', 'Coarse salt', 'Onion', 'Cilantro'],
   'The molcajete is a three-legged basalt mortar that has been used in Mexico for thousands of years; its name comes from Nahuatl. Garlic and salt are ground first, then roasted chiles, then tomato, so the salsa is crushed rather than cut. The texture is the difference: a blender shears everything to the same size, while stone leaves seeds, skin and pulp distinct. A spot that serves salsa de molcajete is telling you someone made it by hand that day.'),

  ('macha', 'Salsa Macha', 'oil', 'south', 6, 1, 2, 6, 10,
   'Dried chiles, nuts and seeds fried in oil.',
   'Veracruz and Oaxaca', 5, 9,
   ARRAY['#6e1f14', '#a63a1c', '#c98a3c', '#2b0f0a'], 'macha', NULL,
   ARRAY['Chile de árbol', 'Morita or other dried chiles', 'Peanuts', 'Sesame seeds', 'Garlic', 'Oil', 'Salt'],
   'Salsa macha contains no tomato and no water. Dried chiles, garlic, nuts and seeds are fried in oil and then ground, leaving a dark, crunchy sediment under a red slick. It is most closely associated with Veracruz, particularly around Orizaba, and with Oaxaca. Because oil preserves it, a jar keeps for weeks, and in the last decade it has spread from regional specialty to taquerías across Mexico and the United States. Stir before spooning: the heat is at the bottom.'),

  ('mole-negro', 'Mole Negro', 'mole', 'south', 7, 2, 6, 1, 9,
   'The darkest and most laboured of the Oaxacan moles.',
   'Oaxaca', 2, 5,
   ARRAY['#2a1a14', '#4a2c1f', '#7a4a2b', '#b0483a'], NULL, public.resolve_spec_id('salsa_spec', 'Mole Negro'),
   ARRAY['Chilhuacle negro, mulato and pasilla chiles', 'Charred tortilla and chile seeds', 'Nuts and sesame', 'Plantain', 'Spices', 'Mexican chocolate'],
   'Mole comes from the Nahuatl molli, "sauce", and mole negro is the most elaborate of the seven moles Oaxaca is known for. Its colour comes from toasting chiles, and often their seeds and a tortilla, almost to the point of burning, then balancing that bitterness with fruit, nuts, spices and a little chocolate. A batch can involve more than two dozen ingredients and most of a day. It is a sauce for occasions, which is why finding it on a Tucson menu is worth noting.'),

  ('verde-de-molcajete', 'Verde de Molcajete', 'cooked', 'everywhere', 4, 7, 2, 7, 2,
   'Chunky tomatillo salsa with the stone still in it.',
   'Throughout Mexico', 3, 7,
   ARRAY['#5f7f2c', '#8fa63f', '#3e3d39', '#c9c58a'], NULL, public.resolve_spec_id('salsa_spec', 'Salsa verde molcajete'),
   ARRAY['Roasted tomatillo', 'Serrano or jalapeño', 'Garlic', 'Coarse salt', 'Cilantro', 'Onion'],
   'The green counterpart of the molcajete tradition. Tomatillos and chiles are blistered on a comal, then crushed in the mortar with garlic and salt. Roasting tempers the tomatillo''s sharpness and the hand-grinding keeps the seeds and charred skin visible, so the salsa is darker and coarser than a blended verde. It varies widely from one kitchen to the next in smoothness, tang and heat.'),

  ('roja-de-molcajete', 'Roja de Molcajete', 'cooked', 'everywhere', 5, 5, 3, 7, 2,
   'Charred tomato and chile, crushed rather than blended.',
   'Throughout Mexico', 3, 8,
   ARRAY['#9c3322', '#c85a34', '#3e3d39', '#e2b07a'], NULL, public.resolve_spec_id('salsa_spec', 'Salsa rojo molcajete'),
   ARRAY['Roasted tomato', 'Roasted red or green chiles', 'Garlic', 'Coarse salt', 'Onion', 'Cilantro'],
   'Somewhere between pico de gallo and a smooth salsa roja. The tomatoes and chiles are roasted until the skins blacken, then worked in the molcajete so the result is loose and pulpy with flecks of char. Many restaurants bring it to the table in the mortar itself. It is a good test of ingredients, since there is nothing to hide behind.'),

  ('de-arbol', 'Salsa de Árbol', 'dried-chile', 'west', 3, 5, 1, 1, 2,
   'Thin, red and hotter than it looks.',
   'Jalisco and western Mexico', 6, 9,
   ARRAY['#c21f17', '#e2452a', '#7d120e', '#f2b36b'], NULL, public.resolve_spec_id('salsa_spec', 'Salsa de Arbol'),
   ARRAY['Chile de árbol', 'Tomato or tomatillo', 'Garlic', 'Vinegar', 'Salt'],
   'The chile de árbol, "tree chile", is named for its woody stem. It is slender, keeps its bright red colour when dried, and is several times hotter than a jalapeño. Toasted briefly and blended, it makes a smooth, pourable salsa with a clean, nutty heat and little sweetness. It is the standard hot red of taquerías across Mexico, and the salsa on the drowned sandwiches of Guadalajara is a close relative.'),

  ('chipotle-mayo', 'Chipotle Mayo', 'creamy', 'west', 5, 3, 2, 0, 9,
   'Smoky, creamy, and made for fried fish.',
   'Baja California', 1, 4,
   ARRAY['#e39a6a', '#f3c9a5', '#b8643a', '#fbeedd'], NULL, public.resolve_spec_id('salsa_spec', 'Chipotle Mayonaise'),
   ARRAY['Mayonnaise', 'Chipotles in adobo', 'Lime', 'Garlic'],
   'Creamy white sauces arrived on tacos with the battered fish taco of Baja California, where mayonnaise- and crema-based dressings are standard. Blending in canned chipotles in adobo adds smoke, colour and a mild burn. It is a modern condiment rather than a traditional salsa, and it is now common on fish and shrimp tacos, tortas and Sonoran hot dogs.'),

  ('pina', 'Salsa de Piña', 'fresca', 'central', 1, 7, 9, 8, 1,
   'Sweet, sharp and built for al pastor.',
   'Central Mexico', 3, 8,
   ARRAY['#f2c230', '#f7dc6f', '#d98e1f', '#6f9a3a'], NULL, NULL,
   ARRAY['Pineapple', 'Habanero or serrano', 'White onion', 'Cilantro', 'Lime', 'Salt'],
   'Pineapple and pork met on the trompo. Tacos al pastor grew out of the spit-roasted meat that Lebanese immigrants brought to central Mexico in the twentieth century, adapted to pork and chile marinade and crowned with a pineapple. Pineapple salsa follows the same logic off the spit: fruit acid and sugar against fat and chile. Some versions are raw and chopped, others grill the fruit first.'),

  ('chiltepin', 'Salsa de Chiltepín', 'dried-chile', 'north', 2, 5, 1, 2, 1,
   'The wild chile of the Sonoran Desert, crushed.',
   'Sonora and southern Arizona', 7, 10,
   ARRAY['#d1241b', '#f04e2e', '#8f1611', '#f6c453'], NULL, NULL,
   ARRAY['Dried chiltepín', 'Garlic', 'Mexican oregano', 'Salt', 'Water or tomato', 'Vinegar'],
   'The chiltepín is a pea-sized wild chile, often called the mother of all chiles because cultivated varieties descend from plants like it. It grows under mesquite and hackberry in the canyons of Sonora, where it is still harvested by hand each autumn, and its range reaches north into southern Arizona; a wild population in the mountains near Tumacácori, south of Tucson, is protected. The heat is fierce but brief. In Sonoran homes the dried chiles sit on the table in a small grinder or are crushed between the fingers, and the simplest salsa is little more than chiltepín, garlic, oregano and water. This is the salsa with the strongest claim to being local.'),

  ('taquera', 'Salsa Taquera', 'dried-chile', 'central', 3, 6, 1, 1, 2,
   'The orange-red squeeze-bottle salsa of the taco stand.',
   'Central Mexico', 5, 8,
   ARRAY['#d4541f', '#ef7f2e', '#9a3413', '#f6c48a'], NULL, NULL,
   ARRAY['Chile de árbol', 'Guajillo', 'Tomatillo', 'Garlic', 'Salt'],
   'Salsa taquera means "taco-stand salsa", and it names a style rather than a fixed recipe: dried red chiles blended with tomatillo until smooth and bright orange-red. The tomatillo gives it tang and body, the árbol gives it heat, and the guajillo gives it colour. It is designed to be squeezed over meat in a thin line, and it is what many people picture when they think of taquería red salsa.'),

  ('habanero', 'Salsa de Habanero', 'fresca', 'south', 1, 7, 4, 5, 1,
   'Floral, fruity and very hot.',
   'Yucatán', 8, 10,
   ARRAY['#f28c1b', '#f7b23b', '#d9541e', '#f9e27d'], NULL, NULL,
   ARRAY['Habanero', 'Sour orange or lime', 'Red or white onion', 'Salt'],
   'The habanero is the chile of the Yucatán Peninsula, although it is thought to have originated in South America and arrived by way of the Caribbean; its name points to Havana. Yucatecan cooks pair it with sour orange and onion in raw salsas such as xnipec, and char it for others. Beneath the heat it has a distinct apricot-like aroma that no other common chile shares. In Tucson it shows up wherever cochinita pibil does.'),

  ('tatemada', 'Salsa Tatemada', 'cooked', 'north', 8, 4, 4, 6, 2,
   'Everything charred over fire before it is crushed.',
   'Northern Mexico', 3, 6,
   ARRAY['#3b2a22', '#a33a22', '#d9682e', '#1c1512'], NULL, NULL,
   ARRAY['Fire-roasted tomato', 'Roasted green chile', 'Garlic', 'Onion', 'Salt'],
   'Tatemar means to char directly over flame or on a hot comal, a word that comes into Mexican Spanish from Nahuatl. In Sonora the salsa is a fixture of carne asada: tomatoes and long green chiles go on the grill beside the meat, then are peeled and mashed with garlic and salt. The flavour is smoky and mild, closer to roasted chile than to a hot sauce, and it belongs to the same mesquite fire as the beef.'),

  ('borracha', 'Salsa Borracha', 'dried-chile', 'central', 4, 3, 4, 2, 3,
   'The "drunken" salsa, made with pulque or beer.',
   'Central Mexico', 3, 6,
   ARRAY['#4a2420', '#7a3a2a', '#c08a4a', '#2a1512'], NULL, NULL,
   ARRAY['Pasilla chiles', 'Pulque or beer', 'Garlic', 'Onion', 'Orange juice', 'Aged cheese'],
   'Borracha means drunk. The traditional version comes from the pulque-producing highlands of central Mexico, where dried pasilla chiles are blended with pulque, the fermented sap of the maguey, and finished with crumbled aged cheese. It is the classic partner of pit-cooked barbacoa. Outside pulque country, beer is the usual substitute, and the result is a dark, slightly bitter, raisin-like salsa.'),

  ('cacahuate', 'Salsa de Cacahuate', 'creamy', 'south', 3, 2, 3, 1, 8,
   'Peanuts and dried chile, blended smooth.',
   'Central and southern Mexico', 4, 7,
   ARRAY['#c08a4b', '#e0b77a', '#8a5a2b', '#a63a22'], NULL, NULL,
   ARRAY['Roasted peanuts', 'Chile de árbol or chipotle', 'Garlic', 'Tomato', 'Salt'],
   'The peanut is native to South America and was being grown in Mexico before the Spanish arrived; the Spanish word cacahuate comes from Nahuatl. Ground peanuts thicken a number of Mexican sauces, including several moles, and in this salsa they are the main event. It is creamy without dairy, nutty, and usually hotter than its soft colour suggests.')
ON CONFLICT (slug) DO NOTHING;

-- Hand-curated link: this spot's salsa row names "Salsa Piña" as a specialty
-- but no salsa_spec row exists for it. Matched by name so it is a no-op in an
-- environment without that row.
INSERT INTO public.site_salsas (est_id, style_id)
SELECT sa.est_id, st.id
  FROM public.salsa sa
  JOIN public.salsa_styles st ON st.slug = 'pina'
 WHERE public.normalize_spec_name(sa.salsa_spec_1) = 'salsa piña'
    OR public.normalize_spec_name(sa.salsa_spec_2) = 'salsa piña'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.salsa_styles IS 'Salsa catalog for the Salsa Atlas (/salsa). variety_key ties a style to a salsa.<key>_yes boolean, spec_id to a salsa_spec row; styles with neither are hand-curated.';
COMMENT ON TABLE public.site_salsas IS 'Which spot serves which salsa style. Rows for keyed styles are maintained by sync_site_salsas() from the salsa table; heat/house_name/note are hand-set and preserved.';
