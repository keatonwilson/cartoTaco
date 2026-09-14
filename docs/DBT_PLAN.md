# dbt Adoption Plan

Introducing dbt to CartoTaco as a transformation layer over the existing Supabase
Postgres database. Two goals, weighted equally: build real dbt fluency (the day-job
stack is dbt + Snowflake), and remove genuine pain from the current pipeline.

For the conceptual "what is dbt and why does each phase matter" version of this
document, see [DBT_PRIMER.md](./DBT_PRIMER.md).

---

## Why this project is a good fit

Three things already in the repo make the on-ramp unusually short:

1. **A dev/prod split already exists.** `.github/workflows/migrate.yml` holds
   `SUPABASE_DB_URL_STAGING` and `SUPABASE_DB_URL_PROD` as secrets, and
   `seed-staging.yml` clones prod into staging on demand. Those map directly onto dbt
   targets, and the seed workflow makes staging realistic enough to test against.
2. **There is a documented bug that dbt exists to prevent.** `schema/README.md`
   records that migration 013 was based on 011 instead of 012 and referenced a dropped
   column. The current mitigation — a hand-maintained canonical file copy-pasted into
   each migration — is a compiler implemented by discipline.
3. **Transformation logic has leaked into the browser.** `cleanNA()` in
   `src/lib/stores.js` converts the literal string `'NA'` to null at render time; the
   `burro`→`burrito` rename lives in the view; `censusStore.js` recomputes every
   city-wide statistic on every page load in every visitor's browser.

## Non-goals

- **dbt does not manage the app's writable tables.** `sites`, `menu`, `protein`,
  `salsa`, `hours`, `descriptions`, `user_favorites`, `vibe_votes`, `group_votes`,
  `profiles`, `location_submissions` stay under `supabase db push` via `migrations/`.
- **dbt does not fetch data.** It transforms what is already in the database. Ingestion
  (Phase 5) is a separate scheduled job that lands raw rows.
- **dbt is never in the request path.** Every model is batch-built; the app reads the
  output through PostgREST like any other table or view.

## The ownership boundary

| Owner | Objects | Mechanism |
|---|---|---|
| Migrations | Base tables, RLS policies, indexes, FK constraints, auth/storage config | `supabase db push` (`migrate.yml`) |
| dbt | Derived views, aggregate tables, snapshots — all in an `analytics` schema | `dbt build` |

The app keeps reading `public.sites_complete`. From Phase 1 onward that name is
produced by dbt rather than by a migration, but the contract is unchanged.

---

## Layout

```
analytics/                       # dbt project, committed inside cartoTaco
  dbt_project.yml
  profiles.yml                   # targets: dev (staging DB), prod
  models/
    staging/                     # one cleaning step per source table
      _sources.yml               # declares public.* tables as sources
      stg_sites.sql
      stg_menu.sql
      stg_protein.sql
      stg_salsa.sql
      stg_hours.sql
      stg_descriptions.sql
    intermediate/
      int_site_specialties.sql   # unpivots spec_id_1/2/3 into long rows
    marts/
      sites_complete.sql         # same output contract as today's view
      mart_city_stats.sql
      mart_site_percentiles.sql
      mart_census.sql
      mart_site_features.sql
      mart_similar_spots.sql
      mart_vibe_agg.sql
  tests/                         # singular (custom SQL) tests
  snapshots/
  macros/
```

---

## Phase 1 — Rebuild `sites_complete` as a model chain

**Scope.** Port `schema/sites_complete_view.sql` into staged models. The six staging
models do the cleaning currently spread between the view and the browser:

- `'NA'` string sentinel → real `NULL` (currently `cleanNA()` in `stores.js`)
- `burro_*` → `burrito_*` (currently aliased inline in the view)
- `_perc` columns cast to numeric, nulls coalesced to 0
- `flour_corn` normalized to a consistent set of values

`int_site_specialties` unpivots `menu.spec_id_1/2/3`, `protein.spec_id_1/2/3`, and
`salsa.spec_id_1/2` into long rows joined once against the three `*_spec` tables. This
collapses the nine-way `LEFT JOIN is1/is2/is3/ps1/ps2/ps3/ss1/ss2` in the current view
into a single join plus an aggregate.

`sites_complete` assembles the same JSONB column shape the app expects. **No frontend
change in this phase** — `fetchSiteData()` keeps its single `from('sites_complete')`
call.

**Known wrinkles to solve here, not later:**

- dbt creates objects owned by its own role. The view needs
  `WITH (security_invoker = true)` (migration 025's fix) reapplied — use a
  `post_hook`, plus dbt's `grants` config for `anon` and `authenticated`.
- Decide where the object lives. Simplest path: build into `analytics`, then have a
  thin `public.sites_complete` view select from it, so PostgREST exposure and RLS
  behavior stay exactly as they are today.
- Retire `schema/sites_complete_view.sql` only once the dbt version is verified
  row-for-row against the existing view.

**Verification.** `EXCEPT` both directions between the old view and the new model on a
seeded staging database. Zero rows either way, or it doesn't ship.

**Learning goals.** `ref()` / `source()`, staging → intermediate → mart layering,
`view` vs `table` materialization, `dbt docs generate`, and the DAG view.

**CartoTaco benefit.** Eliminates the stale-copy bug class. Moves `'NA'` handling out
of the render path.

---

## Phase 2 — Data quality assertions

CartoTaco's rows originate from Claude Vision (menu photos) and Claude web search
(scouted pending spots). Nothing validates them today. This is where dbt pays rent
fastest.

### Generic tests (schema YAML)

| Test | Applied to |
|---|---|
| `unique`, `not_null` | `est_id` on every source table |
| `relationships` | `menu`/`protein`/`salsa`/`hours`/`descriptions` → `sites` |
| `accepted_values` | `sites.type`, `sites.vetting_status`, `sites.source`, `menu.flour_corn` |

Migration 014 already added the matching FK constraints, so these pass on day one and
serve as a regression baseline.

### Singular tests (custom SQL) — the ones that catch real failures

| Assertion | Failure it catches |
|---|---|
| `menu` `_perc` columns sum to ~1.0 per `est_id` (±0.02) | CLAUDE.md states this invariant; nothing enforces it. A bad extraction silently corrupts every radar chart. |
| `protein` `_perc` columns sum to ~1.0 per `est_id` | Same, for the protein radar and the taste-profile feature vectors |
| No `x_perc > 0` where `x_yes = false` | Contradiction between the two parallel representations |
| `lat_1` / `lon_1` inside a Tucson bounding box | Nominatim geocoding misses in the scout pipeline |
| `salsa.heat_overall` between 0 and 10 | Feeds `SpiceGauge` and every percentile |
| `total_num` ≥ count of true variety flags | Salsa count inconsistent with the lineup |
| Pending sites have no `menu`/`protein`/`salsa` rows | The stated invariant of the unvetted-spots flow |
| No two sites within 150 m with similar normalized names | Mirrors `find_duplicates()` in `cartoTacoMenuExtract/src/scraping.py`; catches what the pre-insert check missed |
| No `'NA'` string survives into any staging model | Regression guard on the Phase 1 cleanup |

Start the ambiguous ones at `severity: warn` and promote to `error` once the existing
data is clean.

**CI wiring.** Extend `.github/workflows/ci.yml` with a job that runs `dbt build`
against the staging database on pull requests. `seed-staging.yml` refreshes staging
from prod when the fixture drifts.

**Learning goals.** Generic vs. singular tests, `severity` / `error_if` / `warn_if`,
`store_failures` for triage, `dbt build` (interleaves run and test) vs. `run` + `test`.

**CartoTaco benefit.** The highest-value phase. Silent data corruption from an LLM
pipeline is the project's main structural risk and is currently entirely unchecked.

---

## Phase 3 — Aggregate models that replace client-side computation

Each model here deletes JavaScript that currently runs in every visitor's browser.

| Model | Replaces | Notes |
|---|---|---|
| `mart_city_stats` | `summaryStats` in `stores.js` | max/avg salsa count and heat, vetted spots only |
| `mart_site_percentiles` | `distributionStats` in `stores.js` | `percent_rank()` replaces the current O(n²) nested filter |
| `mart_census` | essentially all of `censusStore.js` | menu prevalence, protein leaderboard, heat histogram, tortilla split, 7×24 open grid, growth timeline |
| `mart_site_features` | feature-vector construction in `tasteProfileStore.js` | 5 protein ratios + heat + salsa per spot |
| `mart_similar_spots` | *nothing yet* | top-5 neighbors per `est_id` by cosine distance over `mart_site_features` |
| `mart_vibe_agg` | per-card `loadVibeCounts()` round-trip | vote counts per `est_id` × dimension |

The 7×24 open-hours grid is the most interesting modeling exercise: cross-join days
against `generate_series(0, 23)`, parse the `HH:MM` strings, and handle the overnight
wrap that `censusStore.js` currently does with a `(d + 1) % 7` index.

`mart_similar_spots` ships **D3 "Similar Spots Recommendations"** from
`IMPROVEMENTS.md`, which is currently unbuilt — the k-NN that runs per-session in the
browser becomes a distance matrix computed once.

**Operational notes.** Table-materialized marts need an explicit `anon` grant and an
RLS read policy to be reachable through PostgREST, plus a refresh cadence (nightly
`dbt build`). Use views where the compute is trivial and tables only where it isn't.
Frontend changes land as separate follow-up PRs, one store at a time, so each can be
reverted independently.

**Learning goals.** Window functions, materialization tradeoffs, `dbt_utils` macros,
incremental models (build one deliberately as an exercise — the data is far too small
to need it).

**CartoTaco benefit.** Faster loads, several hundred lines of JS removed, one roadmap
feature shipped.

---

## Phase 4 — Snapshots for change history

CartoTaco currently has no history. `last_updated` overwrites, and `created_at` is the
only temporal signal.

Snapshot `sites`, `menu`, `salsa`, and `hours` on a `check` strategy against the
columns that matter. Each change writes a new row with valid-from / valid-to bounds.

**Unlocks:**

- "This spot's heat went 6 → 8 in March" on the card
- Closure detection (a spot whose hours went empty and stayed empty)
- A genuine change feed, replacing `recentlyAddedSites`' `created_at` ordering
- An audit trail of exactly what changed when a pending spot was vetted
- A real growth timeline on `/census`

**Ordering constraint.** Snapshots must run *before* the models that read them in any
scheduled build.

**Learning goals.** Slowly-changing-dimension Type 2 — standard warehouse vocabulary
with no close analogue in a typical analysis workflow.

**CartoTaco benefit.** Highest value-per-effort on this list. A capability the app
simply does not have today.

---

## Phase 5 — External data ingestion

Shape: a scheduled GitHub Actions job writes raw JSON into `raw_*` tables; dbt models
on top. dbt itself fetches nothing.

Ranked by value to CartoTaco:

1. **Pima County health inspections.** Public open data portal with an API — use the
   API, not scraping. Matching inspections to sites by normalized name plus address
   proximity is a substantial modeling exercise (`int_inspection_matches`, with a
   confidence score and a manual-override table for the ones fuzzy matching gets
   wrong). Surfaces as an inspection chip on the card.
2. **`staging_extractions` as a source.** Zero new plumbing — the table already exists
   in the Supabase project with `pipeline`, `scrape_confidence`, and `status` columns.
   Model the pipeline itself: confidence distributions by field, the
   scouted → approved → promoted → vetted funnel, and where rows die. Immediate
   visibility into where the extraction pipeline leaks.
3. **Link liveness.** Periodic HTTP status checks on `website` / `instagram` →
   `raw_link_checks` → a `mart_stale_links` worklist of spots needing re-scouting. Rate
   limit politely; this is the one item that touches third-party servers directly.
4. **Census / ACS tract data.** Spatial join spots to Tucson neighborhoods. Unlocks
   **D2 Neighborhood Mode** from `IMPROVEMENTS.md` plus per-capita taco density.

Start with (2) — it is free, needs no new infrastructure, and the modeling is
immediately useful.

**Learning goals.** The transform-layer boundary, fuzzy record linkage in SQL, handling
a source that updates on someone else's schedule.

---

## Phase 6 — Exposures, documentation, and scheduling

- **Exposures.** Declare the SvelteKit app, `/census`, `/compare`, and `/vote` as
  consumers of specific models, so the docs graph runs end-to-end from the `sites`
  table to the rendered page. This is the impact-analysis workflow — "if I change this
  column, what breaks?"
- **Scheduled build.** Nightly `dbt build` against prod (snapshots first, then models,
  then tests), with failures surfaced rather than swallowed.
- **PR CI.** `dbt build` against staging on every pull request. Add
  `--select state:modified+` with deferral once the project is large enough to justify
  it.

---

## Suggested first PR

Phase 1 in full, plus three Phase 2 assertions (`_perc` sums, lat/lon bounds, no `'NA'`
leakage), plus the CI job.

Self-contained, exercises the whole core loop, and the app is untouched — the
`EXCEPT`-both-directions check against the current view is the entire acceptance
criterion.

## Sequencing note

Phases 1, 2, 4, and 6 are independent of the frontend and can land without touching
`src/`. Phase 3 changes the frontend and should follow its models in separate PRs.
Phase 5 is optional and can slot in any time after Phase 2.

## Adapter choice

Build on `dbt-postgres` against Supabase. Models, `ref`, sources, tests, snapshots,
exposures, docs, and CI transfer to Snowflake unchanged; what differs is warehouse
config, cluster keys, and incremental merge strategies, none of which apply at this
data size. For Snowflake-specific practice later, point the same project at a trial
account as a second target — maintaining one codebase across two adapters forces
portable SQL. `dbt-duckdb` against a local dump is the fastest local dev loop.
