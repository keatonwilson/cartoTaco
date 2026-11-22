-- 041: let salsa_styles inserts through the API
--
-- 036's resync trigger ran `UPDATE public.salsa SET est_id = est_id` with no
-- WHERE. Supabase loads pg_safeupdate for API requests, which rejects that
-- ("UPDATE requires a WHERE clause"), so every new style from Salsa Field
-- Notes failed. The seed only worked because it ran inside the migration.

CREATE OR REPLACE FUNCTION public.resync_site_salsas_on_style_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.salsa SET est_id = est_id WHERE true;  -- every spot, on purpose; WHERE satisfies pg_safeupdate
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resync_site_salsas_on_style_change() FROM PUBLIC, anon, authenticated;
