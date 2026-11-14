-- 042: description similarity between spots
--
-- cartoTacoMenuExtract's src/similarity.py embeds each spot's hand-written
-- short + long description and writes every pairwise cosine score here. With
-- ~30 spots that's a few hundred rows, so the app fetches the whole matrix and
-- does "Similar spots" on the card and the text half of the taste-profile
-- recommendations client-side. No pgvector: the vectors never leave the
-- script, only the scores do.
--
-- site_similarity_sources records which description text each spot's scores
-- came from (description_hash), so data_health_report() can say when a
-- description changed and the script needs re-running.
--
-- description_hash() is mirrored by description_hash() in cartoTacoMenuExtract
-- src/similarity.py — keep the two in sync.

-- One row per unordered pair (est_id_a < est_id_b)
CREATE TABLE IF NOT EXISTS public.site_similarity (
  est_id_a integer NOT NULL REFERENCES public.sites(est_id) ON DELETE CASCADE,
  est_id_b integer NOT NULL REFERENCES public.sites(est_id) ON DELETE CASCADE,
  score    real    NOT NULL CHECK (score BETWEEN -1 AND 1),
  PRIMARY KEY (est_id_a, est_id_b),
  CHECK (est_id_a < est_id_b)
);

CREATE INDEX IF NOT EXISTS site_similarity_b_idx ON public.site_similarity (est_id_b);

CREATE TABLE IF NOT EXISTS public.site_similarity_sources (
  est_id      integer PRIMARY KEY REFERENCES public.sites(est_id) ON DELETE CASCADE,
  source_hash text NOT NULL,
  model       text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- Scores are public, like the rest of the spot data; writes are service role only
ALTER TABLE public.site_similarity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_similarity_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.site_similarity;
CREATE POLICY "Public read access"
  ON public.site_similarity FOR SELECT
  USING (true);

GRANT SELECT ON public.site_similarity TO anon, authenticated;
-- site_similarity_sources: no policies, so only the service role sees it

-- The text a spot's similarity was computed from, as an md5 of
-- short_descrip || '\n' || long_descrip (NULLs as empty strings)
CREATE OR REPLACE FUNCTION public.description_hash(p_short text, p_long text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT md5(coalesce(p_short, '') || E'\n' || coalesce(p_long, ''))
$$;

-- Replace the whole matrix in one transaction, so the app never reads half a
-- recompute. p_sources: [{est_id, source_hash}], p_pairs: [{a, b, score}].
-- Returns the number of pairs written.
CREATE OR REPLACE FUNCTION public.replace_site_similarity(p_model text, p_sources jsonb, p_pairs jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  -- WHERE true: pg_safeupdate rejects a bare DELETE (see migration 041)
  DELETE FROM public.site_similarity WHERE true;
  DELETE FROM public.site_similarity_sources WHERE true;

  INSERT INTO public.site_similarity_sources (est_id, source_hash, model)
  SELECT x.est_id, x.source_hash, p_model
    FROM jsonb_to_recordset(p_sources) AS x(est_id integer, source_hash text);

  INSERT INTO public.site_similarity (est_id_a, est_id_b, score)
  SELECT least(x.a, x.b), greatest(x.a, x.b), x.score
    FROM jsonb_to_recordset(p_pairs) AS x(a integer, b integer, score real)
   WHERE x.a <> x.b;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.description_hash(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_site_similarity(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.description_hash(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_site_similarity(text, jsonb, jsonb) TO service_role;

-- data_health_report(): migration 035's body plus a similarity_stale check.
-- CREATE OR REPLACE keeps the existing grants, so 034's REVOKEs still apply.

CREATE OR REPLACE FUNCTION public.data_health_report()
RETURNS TABLE (check_name text, severity text, est_id integer, site_name text, detail text)
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  t record;
  i int;
BEGIN
  -- Spec slots
  FOR t IN
    SELECT * FROM (VALUES
      ('menu',    'specialty_item_', 'item_spec',    3),
      ('protein', 'protein_spec_',   'protein_spec', 3),
      ('salsa',   'salsa_spec_',     'salsa_spec',   2)
    ) AS v(tbl, prefix, spec, slots)
  LOOP
    FOR i IN 1..t.slots LOOP
      RETURN QUERY EXECUTE format($q$
        SELECT 'spec_unlinked', CASE WHEN c.n = 1 THEN 'info' ELSE 'error' END,
               x.est_id::integer, s.name::text,
               format('%%s.%%s = %%L: %%s', %1$L, %3$L, x.%3$I,
                      CASE c.n WHEN 0 THEN 'no matching ' || %2$L || ' row'
                               WHEN 1 THEN 'same spec already linked in another slot'
                               ELSE 'ambiguous (several specs match)' END)
          FROM public.%1$I x JOIN public.sites s USING (est_id)
          CROSS JOIN LATERAL (
            SELECT count(*) AS n FROM public.%2$I sp
             WHERE public.normalize_spec_name(sp.name) = public.normalize_spec_name(x.%3$I)) c
         WHERE x.spec_id_%4$s IS NULL AND public.normalize_spec_name(x.%3$I) IS NOT NULL
        UNION ALL
        SELECT 'spec_name_mismatch', 'warn', x.est_id::integer, s.name::text,
               format('%%s.%%s = %%L but spec_id_%%s links to %%L', %1$L, %3$L, x.%3$I, %4$s, sp.name)
          FROM public.%1$I x JOIN public.sites s USING (est_id)
          JOIN public.%2$I sp ON sp.id = x.spec_id_%4$s
         WHERE public.normalize_spec_name(x.%3$I) IS NOT NULL
           AND public.normalize_spec_name(x.%3$I) <> public.normalize_spec_name(sp.name)
      $q$, t.tbl, t.spec, t.prefix || i, i);
    END LOOP;

    RETURN QUERY EXECUTE format($q$
      SELECT 'spec_duplicate_name', 'warn', NULL::integer, NULL::text,
             format('%%s: %%s', %1$L, string_agg(format('#%%s %%L', id, name), ', ' ORDER BY id))
        FROM public.%1$I GROUP BY public.normalize_spec_name(name) HAVING count(*) > 1
    $q$, t.spec);

    RETURN QUERY EXECUTE format($q$
      SELECT 'spec_unused', 'info', NULL::integer, NULL::text, format('%%s #%%s %%L', %1$L, sp.id, sp.name)
        FROM public.%1$I sp
       WHERE NOT EXISTS (SELECT 1 FROM public.%2$I x WHERE sp.id IN (%3$s))
    $q$, t.spec, t.tbl,
       (SELECT string_agg('x.spec_id_' || g, ', ') FROM generate_series(1, t.slots) g));
  END LOOP;

  -- Menu/protein yes-vs-share consistency
  RETURN QUERY
  WITH items AS (
    SELECT 'menu' AS tbl, m.est_id, k.key AS yes_key, (k.value)::text = 'true' AS yes,
           (j->>replace(k.key, '_yes', '_perc'))::numeric AS perc
      FROM public.menu m, to_jsonb(m) j, jsonb_each(j) k
     WHERE k.key LIKE '%\_yes' AND j ? replace(k.key, '_yes', '_perc')
    UNION ALL
    SELECT 'protein', p.est_id, k.key, (k.value)::text = 'true',
           (j->>replace(k.key, '_yes', '_perc'))::numeric
      FROM public.protein p, to_jsonb(p) j, jsonb_each(j) k
     WHERE k.key LIKE '%\_yes' AND j ? replace(k.key, '_yes', '_perc')
  )
  SELECT CASE WHEN it.yes THEN 'menu_yes_zero_perc' ELSE 'menu_perc_not_served' END,
         CASE WHEN it.yes THEN 'error' ELSE 'warn' END,
         it.est_id::integer, s.name::text,
         format('%s.%s = %s, share = %s', it.tbl, it.yes_key, it.yes, coalesce(it.perc::text, 'NULL'))
    FROM items it JOIN public.sites s ON s.est_id = it.est_id
   WHERE (it.yes AND coalesce(it.perc, 0) = 0) OR (NOT it.yes AND coalesce(it.perc, 0) > 0)
  UNION ALL
  SELECT 'perc_sum_off', 'warn', it.est_id::integer, s.name::text,
         format('%s shares sum to %s', it.tbl, round(sum(coalesce(it.perc, 0)), 2))
    FROM items it JOIN public.sites s ON s.est_id = it.est_id
   WHERE s.vetting_status IS DISTINCT FROM 'pending'
   GROUP BY it.tbl, it.est_id, s.name
  HAVING sum(coalesce(it.perc, 0)) > 0
     AND sum(coalesce(it.perc, 0)) NOT BETWEEN 0.85 AND 1.15;

  -- Vetted spots missing child rows / heat
  RETURN QUERY
  SELECT 'vetted_missing_rows', 'error', s.est_id::integer, s.name::text,
         'no ' || concat_ws(', ',
           CASE WHEN m.est_id IS NULL THEN 'menu' END,
           CASE WHEN p.est_id IS NULL THEN 'protein' END,
           CASE WHEN sa.est_id IS NULL THEN 'salsa' END) || ' row'
    FROM public.sites s
    LEFT JOIN public.menu m ON m.est_id = s.est_id
    LEFT JOIN public.protein p ON p.est_id = s.est_id
    LEFT JOIN public.salsa sa ON sa.est_id = s.est_id
   WHERE s.vetting_status IS DISTINCT FROM 'pending'
     AND (m.est_id IS NULL OR p.est_id IS NULL OR sa.est_id IS NULL)
  UNION ALL
  SELECT 'vetted_missing_heat', 'warn', s.est_id::integer, s.name::text, 'salsa.heat_overall is NULL'
    FROM public.sites s JOIN public.salsa sa ON sa.est_id = s.est_id
   WHERE s.vetting_status IS DISTINCT FROM 'pending' AND s.closed_at IS NULL
     AND sa.heat_overall IS NULL;

  -- Coordinates (Tucson metro bounding box, generous)
  RETURN QUERY
  SELECT 'bad_coordinates', 'error', s.est_id::integer, s.name::text,
         format('lat_1 = %s, lon_1 = %s', coalesce(s.lat_1::text, 'NULL'), coalesce(s.lon_1::text, 'NULL'))
    FROM public.sites s
   WHERE s.lat_1 IS NULL OR s.lon_1 IS NULL
      OR s.lat_1::float8 NOT BETWEEN 31.8 AND 32.6
      OR s.lon_1::float8 NOT BETWEEN -111.4 AND -110.5;

  -- Hours ('NA' and blanks count as unset, matching the frontend)
  RETURN QUERY
  WITH days AS (
    SELECT h.est_id, d.day,
           NULLIF(NULLIF(btrim(j->>(d.day || '_start')), ''), 'NA') AS st,
           NULLIF(NULLIF(btrim(j->>(d.day || '_end')), ''), 'NA') AS en
      FROM public.hours h, to_jsonb(h) j,
           unnest(ARRAY['mon','tue','wed','thu','fri','sat','sun']) AS d(day)
  )
  SELECT CASE WHEN d.st = d.en THEN 'hours_zero_length' ELSE 'hours_half_set' END,
         'warn', d.est_id::integer, s.name::text,
         format('%s: start = %s, end = %s', d.day, coalesce(d.st, '—'), coalesce(d.en, '—'))
    FROM days d JOIN public.sites s ON s.est_id = d.est_id
   WHERE (d.st IS NULL) <> (d.en IS NULL) OR d.st = d.en;

  -- Possible duplicate spots (same normalized name, or within ~150 m)
  RETURN QUERY
  SELECT 'duplicate_site', 'warn', a.est_id::integer, a.name::text,
         format('looks like #%s %L (%s m apart)', b.est_id, b.name,
                coalesce(round(dist.m)::text, '?'))
    FROM public.sites a
    JOIN public.sites b ON b.est_id > a.est_id
    CROSS JOIN LATERAL (
      SELECT 6371000 * 2 * asin(sqrt(
               power(sin(radians(b.lat_1::float8 - a.lat_1::float8) / 2), 2) +
               cos(radians(a.lat_1::float8)) * cos(radians(b.lat_1::float8)) *
               power(sin(radians(b.lon_1::float8 - a.lon_1::float8) / 2), 2))) AS m
    ) dist
   WHERE a.closed_at IS NULL AND b.closed_at IS NULL
     AND (public.normalize_spec_name(a.name) = public.normalize_spec_name(b.name)
          OR dist.m < 150);

  -- Workflow leftovers
  RETURN QUERY
  SELECT 'stale_pending', 'info', s.est_id::integer, s.name::text,
         format('pending since %s', coalesce(s.scraped_at, s.created_at)::date)
    FROM public.sites s
   WHERE s.vetting_status = 'pending'
     AND coalesce(s.scraped_at, s.created_at) < now() - interval '60 days';

  IF to_regclass('public.staging_extractions') IS NOT NULL THEN
    RETURN QUERY EXECUTE $q$
      SELECT 'stale_staging_approved', 'info', se.est_id::integer, se.restaurant_name::text,
             format('staging row %s approved, last touched %s', se.id, se.updated_at::date)
        FROM public.staging_extractions se
       WHERE se.status = 'approved' AND se.updated_at < now() - interval '14 days'
    $q$;
  END IF;

  -- Description similarity (cartoTacoMenuExtract src/similarity.py). Before the
  -- first run there are no sources at all: one finding, not one per spot.
  IF NOT EXISTS (SELECT 1 FROM public.site_similarity_sources) THEN
    RETURN QUERY
    SELECT 'similarity_stale', 'info', NULL::integer, NULL::text,
           'description similarity has never been computed'::text;
  ELSE
    RETURN QUERY
    SELECT 'similarity_stale', 'warn', s.est_id::integer, s.name::text,
           CASE WHEN src.est_id IS NULL THEN 'no similarity scores yet'
                ELSE format('description changed since similarity was computed (%s)', src.computed_at::date)
           END
      FROM public.sites s
      JOIN public.descriptions d ON d.est_id = s.est_id
      LEFT JOIN public.site_similarity_sources src ON src.est_id = s.est_id
     WHERE coalesce(btrim(d.short_descrip), '') || coalesce(btrim(d.long_descrip), '') <> ''
       AND (src.est_id IS NULL
            OR src.source_hash <> public.description_hash(d.short_descrip, d.long_descrip));
  END IF;
END;
$$;
