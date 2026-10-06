-- Migration 034: Self-healing specialty links + data health report
--
-- Cards only show specialty items/proteins/salsas whose spec_id_N FK is set
-- (the sites_complete view joins on the id, never the name). Promotion from
-- cartoTacoMenuExtract writes the spec *name* into the name slots and looks up
-- the id, but historically: exact case-sensitive matching missed variants,
-- salsa ids were never looked up at all, and specs created after promotion
-- were never back-linked. This migration makes the database close those gaps
-- itself:
--
--   1. normalize_spec_name()/resolve_spec_id() — one shared matching rule
--      (lowercase, trimmed, collapsed whitespace; link only when exactly one
--      spec matches). Mirrored in cartoTacoMenuExtract src/spec_tables.py.
--   2. BEFORE INSERT/UPDATE triggers on menu/protein/salsa fill an empty
--      spec_id_N from its name slot at write time.
--   3. heal_spec_links() sweeps every row; AFTER triggers on the spec tables
--      run it, so creating or renaming a spec back-links existing spots.
--   4. heal_log records every automatic change (old/new value) so any fix
--      can be audited or reverted.
--   5. data_health_report() — read-only checks for issues that need a human
--      (see the CHECKS comment below). Run nightly by .github/workflows/data-health.yml.
--
-- Healing only ever fills an empty spec_id_N; it never overwrites or clears a
-- link, so hand-made links are safe.
--
-- Note: migration 017 dropped the spec name columns, but cartoTacoMenuExtract
-- (its migration 009) re-added them and promotion writes them, so they exist
-- in production. ADD COLUMN IF NOT EXISTS keeps this migration runnable on a
-- database where they don't.
--
-- Dashboard → SQL Editor → New Query → Paste → Run

-- ── Name slot columns (no-op where cartoTacoMenuExtract already added them) ──
ALTER TABLE public.menu
  ADD COLUMN IF NOT EXISTS specialty_item_1 text,
  ADD COLUMN IF NOT EXISTS specialty_item_2 text,
  ADD COLUMN IF NOT EXISTS specialty_item_3 text;
ALTER TABLE public.protein
  ADD COLUMN IF NOT EXISTS protein_spec_1 text,
  ADD COLUMN IF NOT EXISTS protein_spec_2 text,
  ADD COLUMN IF NOT EXISTS protein_spec_3 text;
ALTER TABLE public.salsa
  ADD COLUMN IF NOT EXISTS salsa_spec_1 text,
  ADD COLUMN IF NOT EXISTS salsa_spec_2 text;

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.heal_log (
  id          bigserial PRIMARY KEY,
  ran_at      timestamptz NOT NULL DEFAULT now(),
  check_name  text NOT NULL,
  source      text NOT NULL,          -- 'write_trigger' | 'sweep' | 'spec_trigger' | 'backfill'
  table_name  text NOT NULL,
  est_id      bigint,
  column_name text,
  old_value   text,
  new_value   text,
  note        text
);
CREATE INDEX IF NOT EXISTS heal_log_ran_at_idx ON public.heal_log (ran_at DESC);

-- Service role only: RLS on, no policies.
ALTER TABLE public.heal_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.heal_log FROM anon, authenticated;

-- Drop the earlier integer-arg signature so the bigint one is unambiguous.
DROP FUNCTION IF EXISTS public.write_heal_log(text, text, text, integer, text, text, text, text);

-- Writes to heal_log go through this so a trigger never fails a write just
-- because the writing role can't see heal_log (RLS on, no policies).
CREATE OR REPLACE FUNCTION public.write_heal_log(
  p_check text, p_source text, p_table text, p_est_id bigint,
  p_column text, p_old text, p_new text, p_note text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.heal_log (check_name, source, table_name, est_id, column_name, old_value, new_value, note)
  VALUES (p_check, p_source, p_table, p_est_id, p_column, p_old, p_new, p_note)
$$;

-- ── Matching ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_spec_name(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'))), '')
$$;

-- Spec id for a name, or NULL when no spec or more than one spec matches.
CREATE OR REPLACE FUNCTION public.resolve_spec_id(p_spec_table text, p_name text)
RETURNS bigint
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  IF p_spec_table NOT IN ('item_spec', 'protein_spec', 'salsa_spec') THEN
    RAISE EXCEPTION 'resolve_spec_id: unknown spec table %', p_spec_table;
  END IF;
  IF public.normalize_spec_name(p_name) IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE format(
    'SELECT array_agg(id) FROM (SELECT id FROM public.%I
       WHERE public.normalize_spec_name(name) = public.normalize_spec_name($1) LIMIT 2) s',
    p_spec_table)
  INTO v_ids USING p_name;
  RETURN CASE WHEN cardinality(v_ids) = 1 THEN v_ids[1] END;
END;
$$;

-- ── Write-time trigger on menu/protein/salsa ─────────────────────────────────
-- TG_ARGV: [0] name slot prefix, [1] spec table, [2] slot count
CREATE OR REPLACE FUNCTION public.fill_spec_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_prefix text := TG_ARGV[0];
  v_spec   text := TG_ARGV[1];
  v_slots  int  := TG_ARGV[2]::int;
  v_row    jsonb := to_jsonb(NEW);
  v_linked bigint[] := '{}';
  v_patch  jsonb := '{}';
  v_name   text;
  v_id     bigint;
  i        int;
BEGIN
  FOR i IN 1..v_slots LOOP
    IF v_row->>('spec_id_' || i) IS NOT NULL THEN
      v_linked := v_linked || (v_row->>('spec_id_' || i))::bigint;
    END IF;
  END LOOP;

  FOR i IN 1..v_slots LOOP
    CONTINUE WHEN v_row->>('spec_id_' || i) IS NOT NULL;
    v_name := v_row->>(v_prefix || i);
    v_id := public.resolve_spec_id(v_spec, v_name);
    -- Skip specs already linked in another slot (would show twice on the card)
    CONTINUE WHEN v_id IS NULL OR array_position(v_linked, v_id) IS NOT NULL;
    v_patch := v_patch || jsonb_build_object('spec_id_' || i, v_id);
    v_linked := v_linked || v_id;
    PERFORM public.write_heal_log('spec_link', 'write_trigger', TG_TABLE_NAME::text, NEW.est_id,
                                  'spec_id_' || i, NULL, v_id::text, v_name);
  END LOOP;

  IF v_patch <> '{}' THEN
    NEW := jsonb_populate_record(NEW, v_patch);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menu_fill_spec_links ON public.menu;
CREATE TRIGGER menu_fill_spec_links
  BEFORE INSERT OR UPDATE ON public.menu
  FOR EACH ROW EXECUTE FUNCTION public.fill_spec_links('specialty_item_', 'item_spec', '3');

DROP TRIGGER IF EXISTS protein_fill_spec_links ON public.protein;
CREATE TRIGGER protein_fill_spec_links
  BEFORE INSERT OR UPDATE ON public.protein
  FOR EACH ROW EXECUTE FUNCTION public.fill_spec_links('protein_spec_', 'protein_spec', '3');

DROP TRIGGER IF EXISTS salsa_fill_spec_links ON public.salsa;
CREATE TRIGGER salsa_fill_spec_links
  BEFORE INSERT OR UPDATE ON public.salsa
  FOR EACH ROW EXECUTE FUNCTION public.fill_spec_links('salsa_spec_', 'salsa_spec', '2');

-- heal_log helpers for the sweep (definer rights, same reason as above)
CREATE OR REPLACE FUNCTION public.heal_log_watermark()
RETURNS bigint
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT coalesce(max(id), 0) FROM public.heal_log $$;

CREATE OR REPLACE FUNCTION public.relabel_heal_log(p_after bigint, p_source text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.heal_log SET source = p_source
   WHERE source = 'write_trigger' AND id > p_after;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Sweep ────────────────────────────────────────────────────────────────────
-- Fills every empty spec_id_N whose name slot resolves. Idempotent. Returns
-- the number of links filled. The touch-update fires the write-time trigger,
-- which does the resolving and logging; the sweep relabels its log rows.
CREATE OR REPLACE FUNCTION public.heal_spec_links(p_source text DEFAULT 'sweep')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_before bigint := public.heal_log_watermark();
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('menu',    'specialty_item_', 'item_spec',    3),
      ('protein', 'protein_spec_',   'protein_spec', 3),
      ('salsa',   'salsa_spec_',     'salsa_spec',   2)
    ) AS v(tbl, prefix, spec, slots)
  LOOP
    -- Rows with at least one empty slot whose name resolves
    EXECUTE format(
      'UPDATE public.%1$I SET est_id = est_id WHERE %2$s',
      t.tbl,
      (SELECT string_agg(format('(spec_id_%1$s IS NULL AND public.resolve_spec_id(%2$L, %3$I) IS NOT NULL)',
                                i, t.spec, t.prefix || i), ' OR ')
         FROM generate_series(1, t.slots) i));
  END LOOP;

  RETURN public.relabel_heal_log(v_before, p_source);
END;
$$;

-- Creating or renaming a spec back-links spots that already name it.
CREATE OR REPLACE FUNCTION public.heal_spec_links_on_spec_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.heal_spec_links('spec_trigger');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS item_spec_heal_links ON public.item_spec;
CREATE TRIGGER item_spec_heal_links
  AFTER INSERT OR UPDATE OF name ON public.item_spec
  FOR EACH STATEMENT EXECUTE FUNCTION public.heal_spec_links_on_spec_change();

DROP TRIGGER IF EXISTS protein_spec_heal_links ON public.protein_spec;
CREATE TRIGGER protein_spec_heal_links
  AFTER INSERT OR UPDATE OF name ON public.protein_spec
  FOR EACH STATEMENT EXECUTE FUNCTION public.heal_spec_links_on_spec_change();

DROP TRIGGER IF EXISTS salsa_spec_heal_links ON public.salsa_spec;
CREATE TRIGGER salsa_spec_heal_links
  AFTER INSERT OR UPDATE OF name ON public.salsa_spec
  FOR EACH STATEMENT EXECUTE FUNCTION public.heal_spec_links_on_spec_change();

-- ── Data health report (read-only) ───────────────────────────────────────────
-- CHECKS (severity: error = visibly wrong on the site, warn = probably wrong,
-- info = housekeeping):
--   spec_unlinked          error  name slot set, no spec id (no match or ambiguous;
--                          info when the same spec is already linked in another slot)
--   spec_name_mismatch     warn   linked spec's name differs from the slot's name
--   spec_duplicate_name    warn   two specs in one table normalize to the same name
--   spec_unused            info   spec no spot links to
--   menu_yes_zero_perc     error  item marked served but 0/NULL share (missing from radar)
--   menu_perc_not_served   warn   share > 0 for an item marked not served
--   perc_sum_off           warn   shares don't sum to ~1.0 (outside 0.85–1.15)
--   vetted_missing_rows    error  vetted spot with no menu/protein/salsa row
--   vetted_missing_heat    warn   vetted, open spot with no heat_overall (drops out of stats)
--   bad_coordinates        error  missing coordinates or outside the Tucson area
--   hours_half_set         warn   a day with only a start or only an end time
--   hours_zero_length      warn   a day whose start equals its end
--   duplicate_site         warn   two spots with the same normalized name or within 150 m
--   stale_pending          info   pending spot older than 60 days
--   stale_staging_approved info   staging row approved > 14 days ago, never promoted
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
      OR s.lat_1::float8 NOT BETWEEN 31.9 AND 32.6
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
END;
$$;

-- ── Permissions: none of this is for the public API ─────────────────────────
REVOKE EXECUTE ON FUNCTION public.write_heal_log(text, text, text, bigint, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heal_log_watermark() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.relabel_heal_log(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_spec_id(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heal_spec_links(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.data_health_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_spec_links() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heal_spec_links_on_spec_change() FROM PUBLIC, anon, authenticated;

-- ── One-time backfill of existing rows ───────────────────────────────────────
SELECT public.heal_spec_links('backfill') AS links_filled;
