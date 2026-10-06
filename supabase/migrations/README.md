# Database Migrations

This folder contains SQL migration files for the CartoTaco database.

## How to Run Migrations

You don't. CI does it: pushing to `staging` or `main` runs `supabase db push`
against that environment (`.github/workflows/migrate.yml`). Pasting SQL into the
Supabase SQL editor by hand leaves the CLI's history table out of date, so the
next push either re-runs the migration or skips one it shouldn't.

Adding one:

```bash
supabase migration new add_whatever    # creates supabase/migrations/<timestamp>_add_whatever.sql
# write the SQL, open a PR, merge to staging first, then main
```

Checking state:

```bash
supabase migration list --db-url "$DB_URL"
```

### Filenames

`<timestamp>_<NNN>_<name>.sql`. The CLI orders by the leading 14-digit timestamp.
Migrations 001-034 predate CI and were applied by hand, so they carry synthetic
`20200101000NNN` timestamps assigned in numeric order; new migrations get a real
timestamp and sort after them. The `NNN_` is the historical number, kept so the
tables below and the docs still line up.

Note: 002 was originally applied *before* 001 (see the CLAUDE.md list). The
backfilled timestamps put them in numeric order instead. Harmless — both were
baselined as applied via `scripts/baseline-migrations.sh` and never replay — but
don't read this folder's order as the historical one.

## Migration Files

Run in order. Each migration depends on the previous ones.

| # | File | Purpose |
|---|------|---------|
| 001 | `001_create_sites_view.sql` | Creates `sites_complete` view joining all site tables (60–70% faster load) |
| 002 | `002_add_contact_and_social_fields.sql` | Adds contact/social fields to sites |
| 003 | `003_create_profiles_table.sql` | Creates user profiles table with RLS (requires Supabase Auth) |
| 004 | `004_create_location_submissions.sql` | Creates `location_submissions` table for user submissions with RLS |
| 005 | `005_create_favorites_table.sql` | Creates `user_favorites` table with RLS |
| 006 | `006_enable_rls_public_tables.sql` | Enables RLS on public tables with read-only policies |
| 007 | `007_add_created_at_to_sites.sql` | Adds `created_at` timestamp to sites |
| 008 | `008_update_sites_complete_view.sql` | Updates view to include `created_at` |
| 009 | `009_add_spec_fk_columns.sql` | Adds FK columns for specialty items |
| 010 | `010_update_sites_complete_view.sql` | Updates view for spec FK columns |
| 011 | `011_remove_spec_text_cols_from_view.sql` | Removes legacy text columns from view, keeps FK references |
| 012 | `012_drop_specialty_item_id_4.sql` | Removes specific specialty item record |
| 013 | `013_add_burro_perc_to_view.sql` | Adds `burro_perc` to view (fixes burritos in radar chart) |
| 014 | `014_add_foreign_key_constraints.sql` | Adds FK constraints on `est_id` for child tables |
| 015 | `015_add_est_id_indexes.sql` | Adds indexes on `est_id` join and spec FK columns |
| 016 | `016_view_naming_cleanup.sql` | Aliases `burro`→`burrito` in view, removes unused site fields |
| 017 | `017_drop_legacy_spec_text_columns.sql` | Drops legacy `specialty_item_N` / `protein_spec_N` / `salsa_spec_N` text columns |
| 018 | `018_rename_spec_fk_columns.sql` | Renames spec FK columns to `spec_id_N` pattern, rebuilds view |
| 019 | `019_drop_summaries_table.sql` | Drops unused `summaries` table (stats now computed client-side) |
| 020 | `020_drop_unused_sites_columns.sql` | Drops unused columns from sites (`contact`, `lat_2`, `lon_2`, `days_loc_2`) |
| 021 | `021_create_group_sessions.sql` | Creates `group_sessions` table for Taco Summit (`id`, `creator_token`, `site_ids`, `title`, `closed_at`) with open RLS |
| 022 | `022_create_group_votes.sql` | Creates `group_votes` table for ranked-choice ballots (`session_id`, `voter_token`, `est_id`, `rank`) with unique constraint, index, and open RLS |
| 023 | `023_add_snacks_menu_type.sql` | Adds snacks as a menu type |
| 034 | `034_spec_link_healing.sql` | Self-healing specialty links (write-time triggers, `heal_spec_links()` sweep, `heal_log` audit table) + read-only `data_health_report()`; backfills existing rows |

## Rollback

To roll back the `sites_complete` view (migration 001):
```sql
DROP VIEW IF EXISTS public.sites_complete;
```
Then revert `src/lib/stores.js` to use the original 6 separate queries.

To roll back the Taco Summit tables (migrations 021–022):
```sql
DROP TABLE IF EXISTS public.group_votes;
DROP TABLE IF EXISTS public.group_sessions;
```

To roll back data-health self-healing (migration 034). Links it already filled
stay (see `heal_log` for what it changed):
```sql
DROP TRIGGER IF EXISTS menu_fill_spec_links ON public.menu;
DROP TRIGGER IF EXISTS protein_fill_spec_links ON public.protein;
DROP TRIGGER IF EXISTS salsa_fill_spec_links ON public.salsa;
DROP TRIGGER IF EXISTS item_spec_heal_links ON public.item_spec;
DROP TRIGGER IF EXISTS protein_spec_heal_links ON public.protein_spec;
DROP TRIGGER IF EXISTS salsa_spec_heal_links ON public.salsa_spec;
DROP FUNCTION IF EXISTS public.data_health_report(), public.heal_spec_links_on_spec_change(),
  public.heal_spec_links(text), public.relabel_heal_log(bigint, text), public.heal_log_watermark(),
  public.fill_spec_links(), public.resolve_spec_id(text, text), public.normalize_spec_name(text),
  public.write_heal_log(text, text, text, integer, text, text, text, text);
```
