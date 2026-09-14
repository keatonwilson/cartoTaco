# dbt, Explained for a Data Science Brain

A plain-language reference for what dbt is and what each phase of the CartoTaco
rollout actually teaches. Companion to [DBT_PLAN.md](./DBT_PLAN.md), which has the
implementation detail.

---

## What dbt actually is

**dbt is `targets` (or `make`, or Snakemake) for SQL.**

You write a folder of named `SELECT` statements. Each one refers to others *by name*
instead of hardcoding a table. dbt reads those references, works out the dependency
order, and runs them in sequence — so a change upstream automatically flows to
everything downstream, and nothing gets stale.

On top of that it gives you:

- **`testthat`-style assertions** that run against the *results*, not the code
- **auto-generated docs** showing what feeds what

That's the whole idea. If you've ever written an analysis as a chain of `dplyr` steps
where each intermediate has a name and you can inspect it, you already have the mental
model. dbt is that, but the intermediates live in the database and the chain is
version-controlled.

### The vocabulary translation table

| dbt term | What it actually is |
|---|---|
| model | One named `SELECT` statement in a `.sql` file |
| `ref('other_model')` | "Depends on that step" — like referring to an earlier object in a pipeline |
| source | A table dbt reads but doesn't own (your app's tables) |
| materialization | Whether a step is recomputed on read (`view`) or stored (`table`) — the lazy-pipe vs. `collect()` tradeoff |
| test | An assertion on rows, re-run whenever data changes |
| snapshot | Automatic change history for a table |
| exposure | A declaration that something downstream (a web page) consumes a model |
| `dbt build` | Run the whole pipeline and all assertions |

### What dbt is *not*

dbt does not fetch anything. It only transforms what is already in the database. Any
"scrape the web on a schedule" work is a separate script that lands raw rows; dbt
models on top of them. Keeping that boundary clear saves a lot of confusion.

---

## The phases, and what each one is for

### Phase 1 — Rewrite the big view as a chain of named steps

Today `sites_complete` is one ~200-line SQL statement, and there's a "canonical copy"
in `schema/` that gets manually pasted into each new migration. `schema/README.md`
documents a real bug from this: migration 013 was based on 011 instead of 012 and
referenced a dropped column.

The rewrite breaks it into ~6 small cleaning steps (one per source table) plus an
assembly step. The cleaning steps are where the legacy junk gets fixed **once**:
`'NA'` strings become real nulls, `burro` becomes `burrito`, percentages get cast.

**What you learn:** the core loop — writing steps, wiring them by name, letting dbt
resolve the order. Choosing view vs. table per step. Reading the dependency graph in
the docs site.

**What CartoTaco gets:** the copy-paste-a-stale-file failure mode stops existing. The
app doesn't change at all — same output shape, same query.

---

### Phase 2 — Assertions on the data, run automatically

CartoTaco's data comes out of Claude Vision reading menu photos and Claude searching
the web. Nothing currently checks whether what comes back is sane.

Assertions worth writing: every spot's menu percentages sum to 1.0; no spot claims
30% tortas while `torta_yes = false`; lat/lon falls inside Tucson; heat is 0–10; no
two spots within 150m share a name.

**What you learn:** the testing layer. This is the piece most people find genuinely
new — it's not unit tests on code, it's `stopifnot()` on the actual rows, re-run every
time the data changes. Plus severity levels (warn vs. fail) and CI wiring.

**What CartoTaco gets:** the biggest one. An LLM writing rows straight into production
with zero validation is the main silent-corruption risk. A bad percentage vector
doesn't crash anything — it quietly makes a radar chart wrong forever. These catch it
the day it happens.

---

### Phase 3 — Move the statistics out of the browser

`censusStore.js`, `summaryStats`, `distributionStats`, and the feature vectors in
`tasteProfileStore.js` all compute city-wide statistics in JavaScript, in every
visitor's browser, on every page load. Every phone recomputes identical numbers.

These are all straightforward SQL: percentile ranks, histograms, group-by counts, a
7×24 open-hours matrix.

**What you learn:** window functions (`percent_rank`, `cume_dist`) — the SQL
equivalent of `dplyr::percent_rank()`, and the thing that separates people who "know
SQL" from people who use it for analysis. Also when to precompute vs. compute on
demand.

**What CartoTaco gets:** faster loads, a few hundred lines of JS deleted, and one new
feature — a precomputed nearest-neighbors table gives "Similar Spots" (D3 on the
roadmap), since the k-NN already done in JS for taste profiles becomes a distance
matrix computed once in SQL instead of per-session in the browser.

> Side note: the current percentile function loops over all sites and filters the full
> array *inside* the loop — that's O(n²). One window function replaces it. Invisible at
> 200 spots; not at 2,000.

---

### Phase 4 — Keep history instead of overwriting it

dbt can watch a table and, whenever a row changes, record the old version with a
valid-from/valid-to timestamp. You end up with the full history of every spot rather
than just its current state.

**What you learn:** this concept (slowly-changing dimensions) is standard warehouse
vocabulary you'll hit constantly at work, and it's one of the few things with no real
equivalent in a typical analysis workflow. Worth knowing cold.

**What CartoTaco gets:** history, which it has none of today — `last_updated` just
clobbers. You could say "this spot's heat went 6 → 8 in March," detect closures, show
a genuine change feed, and audit exactly what changed when a pending spot got vetted.

---

### Phase 5 — Pulling in outside data

Remember: dbt doesn't fetch. "Auto-ingest web data" is two jobs — a scheduled script
that dumps raw results into a landing table, then dbt models on top.

This is also where the scouting pipeline's manual step gets addressed. Today you run a
search, then tick checkboxes. That checkbox isn't really a decision — it's you
compensating for the fact that asking an LLM "what taco spots am I missing" returns a
mix of real finds, closed places, chains, and spots you already have under a different
name. The fix isn't auto-ticking the boxes; it's feeding discovery from sources solid
enough that the human check moves to the *promote* step, where it belongs.

Sources, with the honest version of each (assessed Sept 2026):

1. **City of Tucson business licenses** — a real queryable API, ~93k records, plus a
   weekly new-business file. But licensing is per-jurisdiction, and South Tucson is its
   own incorporated city with no open data — so this feed structurally can't see South
   4th and South 12th. Great signal, incomplete frame.
2. **Pima County health permits** — every food business in the metro needs one, so this
   is the only *complete* registry, and a permit is strong evidence a place is real.
   Downside: portal only, no documented API. Worth checking whether its map view calls a
   JSON endpoint before planning around it.
3. **OpenStreetMap (Overpass)** — free, no key, covers the whole metro including the
   gaps above. Lags on brand-new spots, so it's good for recall and weak on recency —
   the opposite profile to the license feed, which is why they complement each other.
   Easiest to start with.
4. **Tucson neighborhoods** — published as GeoJSON, load once, point-in-polygon. Unlocks
   Neighborhood Mode (D2) almost for free.
5. **The existing `staging_extractions` table** — zero new plumbing. Model your own
   pipeline: where scouted spots die between staging and promotion. Free, do it first.

**On Instagram and TikTok:** both are rich in exactly this kind of knowledge and both
are largely closed. Instagram's public-content endpoints need Meta business verification
and a strict app review aimed at brand monitoring, not restaurant discovery. TikTok's
open API is for accredited academic research on a non-commercial basis — eligibility
aside, using it to populate an app isn't what you'd be agreeing to. Scraping is more
legally defensible than most people assume (courts have held public, logged-out scraping
isn't a computer-crime violation) but still breaks both platforms' terms and invites
blocking. The parts worth doing: check the Instagram handles you *already store* for
signs a spot went quiet, and let ordinary web search mine the local blogs and Reddit
threads that carry the same word-of-mouth. The thing you actually want from social —
where a truck is parked today — lives in Stories and isn't minable at all; the Owner
Portal idea on your roadmap is the better answer to that.

**The interesting architectural move:** the dedup and name-matching logic currently in
`scraping.py` is set logic and distance math against the database, written in Python.
It belongs in a dbt model — one that unions the feeds, scores candidates, and ranks
them. Multi-source agreement (a spot showing up in both a health permit and OSM) is what
replaces your checkbox.

**What you learn:** where the transform layer's boundaries are, fuzzy record linkage in
SQL, spatial joins, and unioning sources that don't share a shape.

---

### Phase 6 — Declaring what consumes what

Register the app's pages as downstream consumers of specific models. The docs graph
then runs end-to-end: raw table → cleaning → stats → the `/census` page.

**What you learn:** impact analysis — "if I change this column, what breaks?" This is
what people at a dbt shop actually open the docs site for.

**What CartoTaco gets:** no more guessing whether a schema change breaks a page.

---

## On Snowflake

Build against Postgres. Models, references, tests, snapshots, docs, CI — all identical
on Snowflake. What differs is warehouse sizing, cluster keys, and update strategies for
huge tables, none of which apply at CartoTaco's data size anyway.

For Snowflake-specific reps later, point the *same project* at a trial account as a
second target. Maintaining one codebase across two databases is good practice — it
forces portable SQL.
