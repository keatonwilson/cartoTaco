# Unvetted Spots — Implementation Plan

Status: **PLAN — not yet implemented**
Scope: `cartoTaco` (SvelteKit app) + `cartoTacoMenuExtract` (Streamlit admin tool)
Companion doc: `cartoTacoMenuExtract/docs/UNVETTED_SPOTS_PLAN.md` (scraping-pipeline detail)

> **Coordination with PR #46 (UI & data-viz refresh):** this plan is written against
> the PR #46 branch (`claude/carto-taco-ui-refresh-plan-6h6d03`), not `main`. That PR
> rewrites every surface this feature touches — `mapping.js` (type glyphs, lens layers,
> twin unclustered source), `FilterBar.svelte` (chip system + active-chips row),
> `stores.js` (`distributionStats`), `censusStore.js`, `Card.svelte`, and the design
> tokens in `app.css`. **Land #46 first, then rebase/branch this work from it.**
> Phase 1 (DB migrations, §2) has zero overlap with #46 and can proceed in parallel.

---

## 1. Feature Summary

Introduce a second class of establishment: **pending (unvetted) spots** — places we know
exist but haven't visited yet. They are:

- **Sourced entirely from web scraping**, run through the Streamlit admin tool
  (scrape → stage → review → promote-as-pending), never entered by hand on the main app.
- **Visually flagged on the map** as pending (muted marker, distinct glyph, legend),
  never confused with vetted spots.
- **Shown with a simpler preliminary card** — name, type, address/contact, hours if
  known, a provenance line, and a "not yet vetted" explanation. No radar chart, heat
  ladder, salsa lineup, or specialty carousel (that data doesn't exist yet by definition).
- **Upgradeable in place**: when the team visits and runs the normal menu-photo
  pipeline, promotion into the same `est_id` flips the spot to vetted with zero churn
  for users who favorited it.

### Guiding principles

1. **One source of truth, one query.** Pending spots live in the existing `sites`
   table and flow through the existing `sites_complete` view — no second fetch, no
   parallel data path. The app's single-query architecture is its core optimization;
   we keep it.
2. **Vetted data stays honest.** Pending spots are excluded from anything that implies
   editorial judgment or aggregates measurements: summary stats, distribution
   percentiles, the Taco Census, taste-profile recommendations, map data lenses,
   comparison, and Taco Summit. They remain findable, favoritable, and routable.
3. **Reversible and idempotent.** All migrations are additive; the default
   `vetting_status = 'vetted'` means shipping the DB change before the frontend is
   completely safe (nothing renders differently until a pending row exists AND the
   frontend knows about the flag).

---

## 2. Database Design (Supabase)

### 2.1 Schema change — `sites` table

Pending spots are ordinary `sites` rows with a status flag and provenance columns.
Child tables (`menu`, `protein`, `salsa`) simply have **no row** for a pending spot —
the view's `LEFT JOIN`s already tolerate that (the jsonb objects come back with null
fields). `descriptions` and `hours` rows are written only if scraping found data.

**Migration `030_add_vetting_status_to_sites.sql`:**

```sql
-- Vetting status + provenance for web-scraped preliminary spots
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS vetting_status TEXT NOT NULL DEFAULT 'vetted'
    CHECK (vetting_status IN ('vetted', 'pending')),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'editorial'
    CHECK (source IN ('editorial', 'web_scrape', 'user_submission')),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vetted_at TIMESTAMPTZ;

-- Partial index: pending rows will always be a small minority
CREATE INDEX IF NOT EXISTS idx_sites_vetting_status
  ON public.sites (vetting_status)
  WHERE vetting_status <> 'vetted';

COMMENT ON COLUMN public.sites.vetting_status IS
  'vetted = editorially reviewed/visited; pending = web-scraped preliminary spot awaiting a visit';
COMMENT ON COLUMN public.sites.source_url IS
  'Primary URL the preliminary data was scraped from (shown as provenance on the pending card)';
```

Notes:
- `TEXT + CHECK` over a Postgres enum: matches every existing pattern in this schema,
  trivially extensible (e.g. a future `'rejected'` or `'closed'` status).
- `NOT NULL DEFAULT 'vetted'` backfills existing rows in the same statement.
- `vetted_at` lets us later show "Vetted on <date>" and audit the funnel.
- No RLS changes needed: migration 006's public-SELECT policies already cover the new
  columns, and writes remain service-role-only (the Streamlit tool).

### 2.2 View change — `sites_complete`

**Migration `031_add_vetting_status_to_view.sql`** rebuilds the view (copying from the
canonical `schema/sites_complete_view.sql`, per `schema/README.md` workflow) with three
additions to the `site` jsonb object:

```sql
    'vetting_status', s.vetting_status,
    'source', s.source,
    'source_url', s.source_url,
```

Also update:
- `schema/sites_complete_view.sql` (single source of truth) + its header comment
- The `COMMENT ON VIEW` trailer
- `CLAUDE.md` migration list (030, 031)

`scraped_at`/`vetted_at` are intentionally **not** exposed in the view (admin-side
concerns; keep the client payload lean). `created_at` already covers "when did it
appear on the map" for the NewSpots feature.

### 2.3 Deletion path (bulletproofing)

A pending spot that turns out to be closed/duplicate/not-real must be deletable.
Check FK behavior before shipping: migration 014 added `est_id` FKs from child tables,
and `user_favorites` / `vibe_votes` also reference sites. Include in migration 030
(after verifying current `ON DELETE` behavior in Supabase):

```sql
-- Ensure favorites/votes don't orphan or block deletion of retracted pending spots
ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_est_id_fkey,
  ADD CONSTRAINT user_favorites_est_id_fkey
    FOREIGN KEY (est_id) REFERENCES public.sites(est_id) ON DELETE CASCADE;
-- (same treatment for vibe_votes if its FK is not already ON DELETE CASCADE)
```

If the existing constraints already cascade, this section is a no-op — verify in the
Supabase dashboard first and drop whatever's unneeded from the migration.

### 2.4 Migration order

1. `030_add_vetting_status_to_sites.sql`
2. `031_add_vetting_status_to_view.sql`
3. (cartoTacoMenuExtract) `010_add_pipeline_to_staging.sql` — see §5.2

030/031 can ship **before any code changes** (and before/while PR #46 merges) with
zero user-visible effect.

---

## 3. Frontend — Data Layer (`src/lib`)

All line references assume the post-#46 codebase.

### 3.1 `stores.js`

**`processedTacoData`:**
- Add to each processed site:
  ```js
  vettingStatus: site.site.vetting_status || 'vetted',
  isPending: site.site.vetting_status === 'pending',
  sourceUrl: site.site.source_url,
  ```
- The existing "skip sites with missing required data" guard (`!site.menu || !site.salsa …`)
  is safe as-is — the view's `jsonb_build_object` returns an object of nulls, not null,
  for missing child rows — but make the guard explicit anyway: for `isPending` sites,
  short-circuit the menu/protein pre-computation (`topFiveMenuItems: []`,
  `salsaVarieties: []`, `otherSalsas: []`, etc.) instead of running `getTopFive`/the
  salsa-lineup mapping over all-null fields. Cheaper and self-documenting.
- `salsaCount` / `heatOverall` will be `null` for pending spots; the pending card never
  renders those components, and downstream consumers coalesce with `|| 0`.

**`summaryStats`:** filter to `!site.isPending` before computing max/avg salsa & heat.
Pending spots must not drag averages down with zeros.

**`distributionStats` (new in #46):** exclude pending sites from the percentile pools
*and* from the per-site map (a "Hotter than X%" line must never render for a spot we
haven't measured — and zero-heat pending entries would inflate every vetted spot's
percentile).

**`recentlyAddedSites`:** keep pending spots **included** — "new spots" is exactly
where scouting output should surface — but the consumer (NewSpotsBadge list) shows the
pending badge next to those entries (§4.4).

**`filterConfig`:** add `showPending: true` (default ON — discovery is the point;
users can hide them).

**`filteredTacoData`:**
- First check: `if (!$filterConfig.showPending && site.isPending) return false;`
- Leave the other filters' semantics alone. Consequences (intentional): an active
  protein/spice/style chip excludes pending spots because we can't verify they
  qualify — filters express requirements, and unvetted spots can't meet them. The
  "Open now" filter works when scraped hours exist and excludes pending spots without
  hours (correct: unknown ≠ open).
- Search matches pending spots on name/type/description — good.

### 3.2 `censusStore.js` (new in #46)

`censusStats` must aggregate **vetted spots only** — one `filter(s => !s.isPending)`
at the top of the derivation. Every census figure (avg heat, total salsas, menu
prevalence, protein leaderboard, hours grid, growth timeline) is an editorial
measurement; pending spots would silently skew all of them toward zero.

Optional phase-4 delight: a small "Scouting report" tile on `/census` — count of
pending spots currently on the map ("4 spots scouted, awaiting vetting") — which makes
the exclusion visible and honest instead of silent.

### 3.3 `tasteProfileStore.js`

Exclude `isPending` sites from the candidate pool for k-NN recommendations and from
archetype/threshold computation (their feature vectors would be all-zero and would
poison both neighbors and percentiles). One filter at the top of the derivation.

### 3.4 Feature gating matrix

| Feature | Pending spots | Rationale |
|---|---|---|
| Map marker + label (Spots lens) | ✅ (styled as pending) | Core feature |
| Map data lenses (Heat/Salsas/Density) | ❌ (filtered out of lens layers) | Lenses visualize measurements pending spots don't have (§4.1) |
| Preliminary card | ✅ | Core feature |
| Search / filters | ✅ (see §3.1) | Findability |
| Favorites | ✅ | "Watch this spot" is the natural use |
| Vibe votes | ❌ v1 | Votes on unvisited spots muddy the signal; revisit later as a "have you been? vote to help us vet" mechanic |
| Trail stops | ✅ | It's routing; a scouting trail is a legit use |
| Comparison | ❌ (hide Compare button) | Nothing to compare — card has no metrics |
| Taco Summit | ❌ (exclude from picker in `/vote/new`) | Voting needs real data |
| Taste profile / recs | ❌ | §3.3 |
| Summary stats / distribution percentiles / census | ❌ | §3.1, §3.2 |

Each ❌ is a one-line guard at the feature's entry point (card selection renders
`PendingSpotCard` instead, `/vote/new` picker filters `!isPending`, lens layers get a
Mapbox filter expression, etc.).

---

## 4. Frontend — UI/UX

### 4.1 Map treatment (`mapping.js`, post-#46)

`mapping.js` after #46 has: type glyphs (`ensureTypeGlyphs`, canvas-drawn
restaurant/stand/truck icons on each marker), cluster colors from `chartTheme.js`'s
`SEQUENTIAL` ramp, and lens layers (`lens-points`, `lens-points-label`,
`lens-heatmap`) fed by the unclustered twin source `taco-sites-all`.

**GeoJSON (`sitesToGeoJSON`):** add `vetting_status: site.vettingStatus` to the flat
feature `properties` (alongside the existing `heat`/`salsas` scalars) so paint/filter
expressions can key on it.

**Pending marker color:** add to `chartTheme.js` (keeps mapping.js's convention of
importing chart colors from one place):

```js
/** Muted marker color for unvetted (pending) spots — outside the data palettes on purpose. */
export const PENDING = { light: '#94A3B8', dark: '#64748B' }; // slate-400 / slate-500
```

Slate sits outside both the categorical palette and the sequential coral ramp, so a
pending marker can never be misread as a data encoding.

**`unclustered-point` paint** becomes data-driven (no new layer — clustering, hover
feature-state, and click handlers keep working unchanged):

```js
'circle-color': [
  'case',
  ['==', ['get', 'vetting_status'], 'pending'], PENDING.light,
  '#FE795D'
],
```

plus a slightly lower non-hover `circle-opacity` (0.7) for pending.

**Glyph:** extend `ensureTypeGlyphs` with a `glyph-pending` (a drawn `?` — two short
strokes + dot, same white-on-marker style as the existing three), and make the
`unclustered-point-glyph` layer's `icon-image` check `vetting_status` first:

```js
'icon-image': [
  'case',
  ['==', ['get', 'vetting_status'], 'pending'], 'glyph-pending',
  ['match', ['get', 'type'],
    'Brick and Mortar', 'glyph-restaurant',
    'Stand', 'glyph-stand',
    'Truck', 'glyph-truck',
    'glyph-restaurant']
]
```

The `?` glyph is the color-independent affordance (accessibility: never color alone),
and it wins over the type glyph — "we haven't verified this" outranks "it's a truck".

**Label:** data-driven `text-color` on `unclustered-point-label` → `--ink-3`-ish gray
(`#9ca3af`) for pending spots.

**Lenses:** pending spots carry `heat: 0` / `salsas: 0`, which would render as the
lightest ramp step and lie. Add a filter to all three lens layers:

```js
filter: ['!=', ['get', 'vetting_status'], 'pending']
```

(`lens-points`, `lens-points-label`, `lens-heatmap`). Density also excludes pending —
the heatmap claims "where the taco spots concentrate" and unverified spots shouldn't
thicken it. Add one line to the lens legend strings in `mapLensStore.js`
(e.g. Heat legend: "Color = heat level (0–10) · pending spots hidden").

**Clusters:** remain mixed-status (fine — expanding reveals the distinction; a
cluster-level split adds complexity for no real signal).

**Map legend:** small legend chip (bottom-left, matching the floating-control styling
of `MapLensPicker`): `● Vetted  ◌ Pending`, shown only in the Spots lens and only when
at least one pending spot exists in the current data. New tiny `MapLegend.svelte`
using the `--surface-*`/`--ink-*` tokens.

### 4.2 Preliminary card — new `PendingSpotCard.svelte`

**Decision: a separate component, not conditionals inside `Card.svelte`.**
Post-#46 `Card.svelte` is even richer (SalsaLineup, Heat Ladder + percentile line,
VibeFingerprint, ContextStrip) and none of it applies to a pending spot. The pending
card shares only HoursOpen (the new Week Rhythm pills work fine with scraped hours),
ContactInfo, DirectionsButton, and FavoriteButton — all standalone components.

Selection point: wherever the card is instantiated — `createPopupContent()` in
`mapping.js` (desktop popup) and the mobile bottom sheet in `Map.svelte` — branch on
`$selectedSite.isPending`.

**Layout (both mobile sheet and desktop popup, single column — it's short):**

```
┌──────────────────────────────────────────┐
│  ◌ PENDING VETTING              [♡ fav]  │   ← muted badge chip, top-left
│  Taquería El Ejemplo                     │   ← name, display font (Outfit), same scale as Card
│  Truck · South Tucson                    │   ← type + region if scraped
├──────────────────────────────────────────┤
│  ⓘ  We found this spot online but        │   ← info panel, always visible
│     haven't visited yet. Details may be  │
│     incomplete or out of date.           │
├──────────────────────────────────────────┤
│  Short description (AI-generated from    │
│  scraped sources), 2–3 sentences max     │
├──────────────────────────────────────────┤
│  Hours (HoursOpen)          — if scraped │
│  Contact (ContactInfo)      — if scraped │
│  Directions (DirectionsButton)           │
├──────────────────────────────────────────┤
│  Source: elejemplo.com ↗                 │   ← provenance link (source_url)
│  Been here? Help us vet it → /submit     │   ← CTA into existing submission flow
└──────────────────────────────────────────┘
```

**Visual language ("pending" design tokens):** PR #46 deliberately retired the
competing amber accent — do **not** reintroduce amber. Stay inside the token system:

- Add semantic tokens to `app.css` (both modes) and map them in `tailwind.config.js`:
  ```css
  --pending: #94a3b8;                        /* slate-400; dark: #64748b */
  --pending-soft: rgba(148, 163, 184, 0.15); /* chip/panel fill */
  ```
  Reuse these for the badge, info panel, map legend, and FilterBar chip so "pending"
  reads as one consistent signal everywhere.
- Badge: pill chip, `--pending-soft` background, `--ink-2` text, `◌` glyph +
  "Pending vetting".
- Card container: standard `--surface-1` card but with a **dashed 1.5px border**
  (`border-color: var(--pending)`) — the single strongest "not finalized" affordance,
  and it survives both themes without relying on hue.
- No RadarChart, SpiceGauge/Heat Ladder, SalsaCount, SalsaLineup, SpecCarousel,
  VibeVotes/VibeFingerprint, ContextStrip, or Compare button.
- Empty-data handling: sections render only if data exists; if neither hours nor
  contact were scraped, the info panel carries the card so it never looks broken
  (reuse #46's `EmptyState.svelte` pattern if a fit).

**Copy (draft):**
- Badge: "Pending vetting"
- Info panel: "We found this spot online but haven't visited yet. Details may be
  incomplete or out of date."
- CTA: "Been here? Tell us about it" → links to `/submit` with spot name query-param
  prefilled (the existing submission form; optional param wiring is a nice-to-have).

### 4.3 FilterBar (post-#46 chip system)

- Add a **"Pending" filter chip** in the toggles `chip-group` (next to "Open Now" /
  "Favorites"), bound to `filterConfig.showPending`, default **on**, with the live
  count badge the other chips have (`pendingCount = sites.filter(s => s.isPending).length`).
  Render the chip only when `pendingCount > 0` — no dead UI when nothing is pending.
- Active-chips row: when toggled **off**, push a removable chip
  `{ id: 'pending', label: 'Hiding pending', remove: () => showPending = true }`
  (mirrors the existing openNow/favorites chip pattern — note the inverted sense:
  the chip appears when the default is *changed*, consistent with "active filters").
- `clearAll()` resets `showPending: true`.
- Chip helper/tooltip: "Spots we've found but not vetted yet".

### 4.4 NewSpotsBadge / list

`recentlyAddedSites` includes pending spots (§3.1); in the badge's dropdown list,
render the small `◌` pending chip next to pending entries. No other change.

### 4.5 Tour (optional, ship last)

Insert a short step after the `map` step only if pending spots exist in the data:
"Grayed-out markers with a ? are scouted spots we haven't vetted yet." Skippable for
v1; gate on data at `startTour()` time or defer entirely.

---

## 5. Streamlit Admin Tool (`cartoTacoMenuExtract`)

Full detail in `cartoTacoMenuExtract/docs/UNVETTED_SPOTS_PLAN.md`; summary here for
the cross-repo picture. (PR #46 does not touch this repo — no coordination needed.)

### 5.1 New pipeline: scrape → stage → review → promote-as-pending

- **`src/scraping.py`** — fetch + normalize public web content about a candidate spot
  (input: URL(s) and/or name + "Tucson AZ" search). `requests` + `beautifulsoup4`;
  optional search-API step (Tavily/SerpAPI) behind an env var. Compliance rule:
  scrape the business's own site / public listings; do **not** scrape Google Maps
  (ToS); geocode via Mapbox or Nominatim.
- **Claude structuring** — reuse the extraction pattern: scraped text → Claude →
  a new `ScrapedSpot` Pydantic model = `SiteData` + `HoursData` + `DescriptionData`
  subset + per-field `confidence`. No menu/protein/salsa extraction (that's what
  vetting is for).
- **Geocoding + dedup** — geocode the address; fuzzy-check `find_sites_by_name()` and
  a lat/lon proximity check (~150 m) against existing sites before staging; surface
  matches in the UI to prevent duplicate spots.
- **Staging** — reuse `staging_extractions` with a new `pipeline` column
  (`'menu_photo' | 'web_scrape'`) rather than a second table; the review UI is 90%
  reusable. New page `5_Scrape_New_Spots.py`; `2_Staging_Review.py` gains a pipeline
  filter.
- **Promotion** — `promote()` gains a pending path: for `pipeline='web_scrape'` rows,
  write `sites` (with `vetting_status='pending'`, `source='web_scrape'`,
  `source_url`, `scraped_at`) + `descriptions` + `hours` (if data), and **skip**
  `menu`/`protein`/`salsa` entirely.

### 5.2 Staging migration (`migrations/010_add_pipeline_to_staging.sql`)

```sql
ALTER TABLE public.staging_extractions
  ADD COLUMN IF NOT EXISTS pipeline TEXT NOT NULL DEFAULT 'menu_photo'
    CHECK (pipeline IN ('menu_photo', 'web_scrape')),
  ADD COLUMN IF NOT EXISTS source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scrape_confidence JSONB;
```

(Also update `009_master_schema.sql` and the repo's CLAUDE.md.)

### 5.3 The vetting loop (pending → vetted)

When the team visits a pending spot and runs the normal **Upload & Extract** flow:

1. In **Promote**, the est_id picker highlights pending sites ("⏳ pending" suffix)
   and the dedup name-match surfaces the pending row as the default target.
2. Promoting full menu-photo data into a pending `est_id` **flips
   `vetting_status='vetted'` and sets `vetted_at=now()`** in the same `sites` upsert.
3. A "Retract spot" button on pending sites (new small section in `3_Promote.py` or
   the Staging Review page) deletes the site row for closed/bogus spots (§2.3 makes
   this safe).

This closes the lifecycle: scraped → pending on map → visited → vetted, same
`est_id` throughout, favorites intact.

---

## 6. Testing

**cartoTaco (`pnpm test` — 78 tests post-#46, keep green):**
- `stores.test.js`: pending site passes through `processedTacoData` with
  `isPending=true` and empty top-five/salsa-lineup arrays; `summaryStats` and
  `distributionStats` ignore pending rows; `filteredTacoData` respects `showPending`;
  protein/spice filters exclude pending.
- `censusStore` test: census aggregates unchanged by adding a pending row.
- New `mapping` unit coverage for `sitesToGeoJSON` `vetting_status` property
  (extract `sitesToGeoJSON` for testability if needed).
- Component smoke: `PendingSpotCard` renders with minimal data (name only) without
  errors.
- Gate on the same checks #46 used: `pnpm check`, `pnpm test`, `pnpm build`.

**cartoTacoMenuExtract (`pytest`):**
- `ScrapedSpot` model validation (times normalized via existing `normalize_time`).
- Scrape-text → prompt assembly (fixture HTML → cleaned text).
- `promote()` pending path: writes sites/descriptions/hours only; sets status fields;
  vetting flip on second promotion. (Mock the Supabase client, matching existing
  test style.)

**Manual E2E before enabling for real:** run migrations on a Supabase branch/staging
project → hand-insert one pending row → verify map/card/filters/lenses/census →
scrape a real candidate through the Streamlit flow → promote → verify → vet it with a
menu photo → verify flip. Like #46, actual Mapbox marker rendering needs a real-token
preview deploy for final sign-off.

---

## 7. Rollout Phases

| Phase | Contents | Risk gate |
|---|---|---|
| **0. Land PR #46** | Merge the UI refresh; rebase this feature branch onto it | Avoids conflicting rewrites of mapping.js/FilterBar/stores |
| **1. Schema** | Migrations 030, 031 (+ menuextract 010); update `schema/sites_complete_view.sql`, both CLAUDE.mds | Zero user-visible change; verify view returns new fields. **No #46 dependency — can run in parallel** |
| **2. Frontend rendering** | stores/census/lens gating (§3), map styling + glyph + legend (§4.1), `--pending` tokens, `PendingSpotCard` (§4.2), FilterBar chip (§4.3), tests | Test with one hand-inserted pending row; delete it after |
| **3. Scraping pipeline** | `scraping.py`, `ScrapedSpot`, page 5, staging review filter, promote-as-pending | Admin-only surface; service-role writes as today |
| **4. Vetting loop + polish** | Vetting flip in promote, retract button, NewSpots badge styling, census "Scouting report" tile, submit-CTA prefill, optional tour step, feature doc | — |

Each phase is independently shippable and reversible (phase 1 columns are inert
without phase 2; phase 2 renders nothing new without pending rows from phase 3).

## 8. Explicit Non-Goals (v1)

- No public "suggest a spot" scraping trigger — scraping is admin-initiated only.
- No vibe votes / comparison / summit / lens participation for pending spots (§3.4).
- No confidence scores shown to end users (kept in staging for admin review only).
- No automated recurring scrape jobs — one-off, human-in-the-loop runs.
