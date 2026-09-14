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

## Phase 5 — External data ingestion and automated discovery

Shape: a scheduled job writes raw rows into `raw_*` tables; dbt models on top. dbt
itself fetches nothing.

This phase is also the answer to a standing question about the scouting pipeline in
`cartoTacoMenuExtract`: **can candidate discovery be automated?** Mostly yes — but not
by auto-approving the current candidate list.

### The current bottleneck is precision, not the checkbox

`pages/5_Scout_New_Spots.py` already automates more than it appears to. Of five steps,
only two need a human:

| Step | Automated? |
|---|---|
| `discover_candidates()` — one LLM web-search pass, ≤30 candidates | yes |
| `mark_known_candidates()` — normalized name diff vs. production + staging | yes |
| **Checkbox selection** | **human** |
| `scout_spot()` → `geocode_address()` → `find_duplicates()` → `save_scraped_spot()` | yes, loops unattended |
| **Staging Review → Promote** | **human** |

The checkbox is not really a selection gate — it is a precision patch. Asking an LLM
"what taco spots exist that aren't on this list" returns a mix of real finds, closed
spots, chains, and name-variants of spots already tracked. That judgment cannot be
automated away without fixing the input.

So the goal is not to auto-tick the boxes. It is to make discovery deterministic enough
that the human gate moves to **promotion**, which is the right place for it anyway —
that is the step that puts a row in front of users.

### Source feasibility

Assessed September 2026. Endpoint-level details marked *unverified* still need a probe.

#### City of Tucson business licenses — best access, worst coverage

Published on the city's ArcGIS Hub as [Business Licenses (Open Data)][bl], ~93,483
active records. ArcGIS Hub exposes a `FeatureServer/0/query` endpoint returning GeoJSON
with `where` clauses, so this is queryable rather than download-only. The city
separately publishes [weekly files of businesses that started that week][blw] — a
genuine new-business feed.

*Unverified:* field names, whether NAICS is present, coordinate handling. One
`?f=json` call answers all three.

**Coverage gap, and it is serious.** Business licensing is fragmented by jurisdiction:

- City of Tucson issues licenses → open data available
- **City of South Tucson is a separately incorporated city** with its own licensing and
  no open data portal
- **Unincorporated Pima County issues no business licenses at all**

South Tucson is one square mile containing South 4th and South 12th — among the densest
taco corridors in the metro. A feed that structurally cannot see it has a hole exactly
where the value is. Usable as a signal, not as the sole source.

**Second gap:** licenses carry the legal entity name, not the DBA. "Rodriguez
Enterprises LLC" will not match "Tacos El Ejemplo." Name resolution is exactly the job
`scout_spot()` already does well.

#### Pima County health permits — best coverage, worst access

Every food business in Tucson, South Tucson, *and* unincorporated Pima must hold a
county health permit. That makes the [Health Inspect portal][hi] the only
jurisdictionally complete registry of food establishments in the metro — precisely the
gap business licenses cannot cover. It is also a stronger signal: a health permit means
a kitchen passed plan review and was inspected.

*Verified:* the portal covers food facilities, exposes a map view and a searchable
table of active permitted facilities, and publishes inspection results with violations.
No API is documented, and the data is **not** in the [Pima geospatial open data
portal][pima-gis].

*Unverified, and worth 20 minutes:* the portal has a `/Portal/Food/Map` route. A map
view must fetch markers from somewhere. Check the network tab for an undocumented JSON
endpoint. This single answer determines whether the best source is cheap or expensive.
Do not plan around it before looking.

**Legal note:** Arizona's public records law (A.R.S. § 39-121) distinguishes commercial
from non-commercial use, with penalties for obtaining records under a non-commercial
purpose and then using them commercially. Almost certainly moot for a free hobby
project, but it becomes real if CartoTaco ever monetizes — a records request stating
purpose is the clean path. Rate-limit politely regardless.

#### OpenStreetMap via Overpass — the free completeness backstop

[Overpass][ovp] is free, needs no key and no auth, and supports the exact query shape
wanted:

```
nwr["amenity"~"restaurant|fast_food"]["cuisine"~"mexican"](bbox:32.1,-111.1,32.35,-110.8);
out center;
```

Covers the whole metro regardless of jurisdiction, so it plugs the South Tucson hole for
free. **Weakness:** OSM lags reality — a truck that opened last month is probably absent.
Strong for recall, weak for recency, the opposite profile to the license feed, which is
why they pair well. Lowest effort of the three; start here.

#### Tucson neighborhoods — confirmed, trivial, unlocks D2

[Neighborhoods][nb] is published on Tucson's ArcGIS Hub as GeoJSON. Load once as a
static seed, point-in-polygon each spot, done. Not really an ingestion pipeline — a
one-time seed plus a join. **D2 Neighborhood Mode** becomes mostly a frontend task once
the column exists.

#### Link liveness and `staging_extractions` self-modeling

Both fully feasible today with no external dependency and no legal questions.
`staging_extractions` needs no new infrastructure at all — the table already carries
`pipeline`, `scrape_confidence`, and `status`. Model the funnel
(scouted → approved → promoted → vetted), confidence distributions by field, and where
rows die. Start here; it is free.

### Reddit — the strongest word-of-mouth source, best reached without the API

Reddit is the priority social source, ahead of Instagram and TikTok. It carries the
under-the-radar knowledge those platforms have, in threaded text that is far easier to
mine, and — critically — it offers something none of the registry sources do.

Business licenses, health permits, and OSM all answer *does this place exist*. Reddit
answers **is it any good, and do people keep bringing it up**. That is the actual
"under the radar" signal: a spot named in eight threads across three years with steady
upvotes is a strong lead even if it never appears in a listicle.

**Two paths, and the unintuitive one is better.**

#### Path A — web search over Reddit (recommended, available today)

Reddit threads are heavily indexed, and `scout_spot()` / `discover_candidates()`
already use Claude's `web_search` tool. Steering those prompts at Reddit content is a
**prompt change in `DISCOVER_SYSTEM_PROMPT`, not a pipeline** — no API, no approval, no
credentials, no retention obligation, no cost.

This should be the first thing tried. It is roughly an afternoon's work and needs no
new infrastructure whatsoever.

Its limit is depth: web search surfaces the most visible threads, not the full
back-catalog. For "what are people saying," that is enough.

#### Path B — the Data API (systematic, but a rockier road than it looks)

Worth pursuing only for what Path A cannot do: systematic longitudinal mining — every
Tucson food thread over years, with scores, comment counts, and dates, so mention
frequency becomes a real time series.

Current terms (verified September 2026) are materially more restrictive than the
pre-2023 API:

- **Pre-approval is required for everything.** Reddit's [Responsible Builder
  Policy][rbp] requires explicit approval before any API access — including personal
  and hobby projects. Reported queues run 2–4 weeks, and hobby projects are reportedly
  deprioritized, with some developers concluding it is not worth attempting. Apply
  early and treat the timeline as unknown.
- **Free tier is real for non-commercial use:** 100 queries/minute per OAuth client,
  averaged over a rolling 10-minute window. OAuth is mandatory; unauthenticated
  requests are rejected. Commercial use requires a hand-reviewed contract at
  $0.24/1K calls. CartoTaco is free, so the free tier applies — but note that
  "non-commercial" is a status that could change if the project ever monetizes.
- **No training on Reddit content.** The Data API terms prohibit using User Content to
  train ML or AI models without express permission. Passing a post through Claude to
  *extract* a spot name is inference, not training, and Anthropic's API does not train
  on API inputs by default — but this is a genuinely gray boundary and worth staying
  well clear of. Extract facts; do not build datasets.
- **Retention is limited.** The terms require deleting User Content not required for
  the approved use case.

That last constraint is an architectural requirement, not a footnote, and it shapes the
pipeline in a way that happens to be good practice anyway:

> **Land raw → extract facts → discard bodies.** `raw_reddit_mentions` holds post text
> only long enough for an extraction pass. The durable table stores derived facts —
> spot name, thread permalink, score, timestamp, extracted sentiment — not the comment
> text. A scheduled post-hook prunes the raw layer.

This is a genuinely instructive thing to build: it forces a real retention policy, which
most learning projects never model, and it maps cleanly onto ephemeral models plus a
pruning post-hook.

#### What Reddit feeds, in dbt terms

Two distinct outputs, and the second is a feature that does not exist yet:

1. **Discovery** — mentioned spots anti-joined against `sites` and
   `staging_extractions`, feeding `mart_discovery_queue` alongside the registry feeds.
   A spot corroborated by *both* a health permit and repeated Reddit mentions needs no
   human checkbox.
2. **Vetting priority** — for spots *already* in the database as `pending`, mention
   frequency and score answer "which of these should be visited first?" Right now that
   ordering is implicit. A `mart_vetting_priority` model makes it explicit and turns
   the pending backlog into a ranked worklist.

[rbp]: https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy

### Instagram and TikTok — low feasibility, deprioritized

Both are rich in the same knowledge and close to inaccessible through sanctioned
channels. Deprioritized behind Reddit; revisit only if Reddit underdelivers.

**Instagram.** Basic Display reached end-of-life 4 Dec 2024. The Graph API returns data
only for Business/Creator accounts you own or manage. [Hashtag Search][ig] exists but
requires the *Instagram Public Content Access* feature — Business Verification plus a
strictly-reviewed App Review — and caps at 30 unique hashtags per 7 days. Meta's stated
allowed usages are brand and campaign monitoring; populating a restaurant map is not an
obvious fit, which matters at review time.

**TikTok.** The Research API is free but requires non-profit academic affiliation, a
defined research proposal, and a commitment to non-commercial public-interest research.
Eligibility aside, using research credentials to populate a consumer app falls outside
the terms one agrees to. Not a route to take.

**Scraping.** More legally defensible than commonly assumed — *hiQ v. LinkedIn* held the
CFAA does not cover public data, and in January 2024 Judge Chen granted summary judgment
to Bright Data, holding Meta's terms do not bar logged-off scraping of public data. But
ToS still ban automated access, supporting immediate blocking and a civil
breach-of-contract claim, and both platforms invest heavily in anti-bot. Logged-off is
the defensible posture; logged-in is not. Reddit's terms likewise prohibit scraping as
an API workaround.

**The one Instagram task still worth doing:** `sites.instagram` is already populated. A
logged-out liveness check — does the profile still resolve, when was the last post — is
a closure signal and a re-scout trigger at essentially zero risk. This folds into the
link-liveness work above rather than being a separate pipeline.

**The unmet need underneath all of this** is truck location and hours — trucks move, and
they announce it in Stories, the least accessible surface on any of these platforms. No
mining strategy solves that. The **O1 Owner Portal** already on the roadmap does: let the
truck tell you.

### Architecture: move the judgment into dbt

`_normalize_name()`, `mark_known_candidates()`, and `find_duplicates()` in
`src/scraping.py` are set logic and distance math against the database, re-querying
`sites` on every call — the 150 m check pulls *all* sites into memory per candidate.
That is SQL wearing a Python costume.

Split it:

**Python does what only Python can** — call the ArcGIS / Overpass / portal endpoints and
land raw rows in `raw_business_licenses`, `raw_osm_food`, `raw_health_permits`. Then,
separately, run `scout_spot()` enrichment over a shortlist dbt hands back.

**dbt does the judgment** — `mart_discovery_queue`:

- unions the raw feeds into one candidate pool at a common grain
- normalizes names in SQL (the `_normalize_name` logic becomes a macro)
- anti-joins against `sites` and non-rejected `staging_extractions`
- does proximity dedup as a spatial join rather than an N×M Python loop
- scores each candidate on source authority (health permit > license > OSM), recency,
  name pattern (taco/taquería/birria/mariscos), and **multi-source agreement**
- emits a ranked worklist

The Streamlit page then becomes "here are 12 scored candidates, scout the top N" — or
skips the UI entirely: a nightly job scouts everything above a score threshold and
stages it, with the human gate staying at Promote.

Multi-source agreement is what replaces the human judgment. A spot appearing in both a
health permit and OSM needs no checkbox.

**Learning goals.** Incremental models (the raw feeds genuinely grow), fuzzy record
linkage, spatial joins, unioning heterogeneous sources to a common grain, and scoring
logic that is far easier to test in SQL than in Python — "no queued candidate matches an
existing site" becomes a dbt test that runs nightly.

### Before committing to this phase

**Do first, because it has a lead time:** submit the Reddit API access request. Approval
reportedly takes 2–4 weeks and hobby projects sit low in the queue, so start the clock
before it is needed. Meanwhile Path A (web search over Reddit) is unblocked and needs
nothing.

Then three checks, none of which take long:

1. Does `healthinspect.pima.gov/Portal/Food/Map` call a JSON endpoint? (network tab)
2. What fields does the business license layer expose — NAICS? license start date?
   (`.../FeatureServer/0?f=json`)
3. How many Mexican-food POIs does Overpass actually return for a Tucson bbox? If it is
   ~400 it is a strong backstop; if ~40, OSM coverage here is too thin to matter.

Cheapest first step in the whole phase, ahead of any ingestion work: point
`DISCOVER_SYSTEM_PROMPT` at Reddit threads and local food media, and compare the
candidates against a normal run. That measures the ceiling of the no-infrastructure
approach before any pipeline gets built.

[bl]: https://gisdata.tucsonaz.gov/datasets/cotgis::business-licenses-open-data/about
[blw]: https://www.tucsonaz.gov/Departments/Business-Services-Department/Taxpayer-Assistance-Division/Business-License-and-Tax-Information/Business-License-Downloads
[hi]: https://healthinspect.pima.gov/portal/
[pima-gis]: https://gisopendata.pima.gov/
[ovp]: https://wiki.openstreetmap.org/wiki/Overpass_API
[nb]: https://gisdata.tucsonaz.gov/datasets/f4224cf3ede84b0c8780610aac8901f2
[ig]: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/hashtag-search/

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
