# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CartoTaco is an interactive map-based application for exploring taco establishments in Tucson, AZ. Built with SvelteKit, it features an optimized architecture that fetches all site data in a single database query using a Supabase view. The app supports user authentication, favorites, trail building (multi-stop route planning), location submissions, theme switching, and group decision voting (Taco Summit).

## Workflow

Branch off `staging`. PR into `staging`, verify on the staging deploy, then PR
`staging` → `main` to ship. Merging to either branch deploys that environment and
applies any new migrations to its database (`.github/workflows/migrate.yml`).

Never apply SQL through the Supabase editor — CI then believes the migration
never ran. Vercel previews have no database of their own, so a PR that adds a
migration won't work on its preview URL until it reaches `staging`.

Full detail in `docs/DEPLOYMENT.md`.

## Development Commands

- `pnpm install` - Install dependencies (use pnpm, not npm)
- `pnpm dev` - Start development server at http://localhost:5175
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Run Svelte type checking
- `pnpm check:watch` - Run type checking in watch mode
- `pnpm test` - Run unit tests (vitest)
- `pnpm test:watch` - Run tests in watch mode
- `pnpm eval` - Run the concierge golden set (needs `ANTHROPIC_API_KEY`; `--limit`, `--category`, `--judge`, `--matrix`, `--local`). With `LANGSMITH_API_KEY` it syncs the golden file to the LangSmith dataset and runs each config as an experiment
- `pnpm eval:sync` - Sync `evals/golden/concierge.jsonl` to the LangSmith dataset without running anything
- `pnpm agent:chat` - Concierge REPL against the eval fixture (`--fan` signs in a user with favorites)
- `pnpm eval:fixture` - Refresh `evals/fixtures/sites_snapshot.json` from Supabase

CI (`.github/workflows/ci.yml`) runs check, test, and build on every PR. `agent-evals.yml` runs `pnpm eval --judge` on PRs touching the concierge (needs the `ANTHROPIC_API_KEY` secret; see `docs/DEPLOYMENT.md`). Node 24 (`.nvmrc`, CI, and the Vercel runtime agree).

## Environment Setup

Required environment variables in `.env` (`.env.example` also lists the optional concierge keys: `ANTHROPIC_API_KEY`, `LANGSMITH_*`, per-tier model overrides):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_KEY=your_mapbox_api_key
```

## Database Architecture

The application uses Supabase with a critical performance optimization:

### Primary Data Source
- **`sites_complete` view**: Optimized database view that joins all site-related tables (sites, descriptions, menu, hours, salsa, protein) in a single query, providing 60-70% faster load times
- Data is fetched once on app initialization in `stores.js` via `fetchSiteData()`

### Supporting Tables
- `item_spec`, `protein_spec`, `salsa_spec` - Specialty item information
- `summaries` - Dropped in migration 019 (summary stats now computed client-side from `processedTacoData`)
- `salsa_styles` / `site_salsas` - Salsa catalog and spot↔salsa links (see Salsa Atlas below)

### Running Migrations
Migrations live in `supabase/migrations/` as `<timestamp>_<NNN>_<name>.sql` and are
applied by CI on merge to `staging`, then to `main` (see Workflow above and
`docs/DEPLOYMENT.md`). Never paste SQL into the Supabase editor.

New migration: `supabase migration new <name>` (real timestamp, sorts after the
backfilled `20200101…` ones). The `NNN_` in the name is the historical number kept
for readability; the timestamp is what the CLI orders by.

Historical order, as originally applied:
1. `002_add_contact_and_social_fields.sql` - Adds contact/social fields
2. `001_create_sites_view.sql` - Creates the `sites_complete` view
3. `003_create_profiles_table.sql` - Creates user profiles table with RLS policies (requires Supabase Auth)
4. `004_create_location_submissions.sql` - Creates location_submissions table for user submissions with RLS policies
5. `005_create_favorites_table.sql` - Creates user_favorites table with RLS policies
6. `006_enable_rls_public_tables.sql` - Enables RLS on public data tables (sites, descriptions, menu, hours, salsa, protein, summaries, specs) with read-only access policies
7. `007_add_created_at_to_sites.sql` - Adds created_at timestamp to sites table
8. `008_update_sites_complete_view.sql` - Updates view to include created_at field
9. `009_add_spec_fk_columns.sql` - Adds foreign key columns for specialty items
10. `010_update_sites_complete_view.sql` - Updates view again (spec-related)
11. `011_remove_spec_text_cols_from_view.sql` - Removes text columns, keeps FK references
12. `012_drop_specialty_item_id_4.sql` - Removes specific specialty item record
13. `013_add_burro_perc_to_view.sql` - Adds missing burro_perc to view (fixes burritos not showing in radar chart)
14. `014_add_foreign_key_constraints.sql` - Adds FK constraints on est_id for child tables (run orphan checks first)
15. `015_add_est_id_indexes.sql` - Adds indexes on est_id join columns and spec FK columns
16. `016_view_naming_cleanup.sql` - Aliases burro→burrito in view, removes unused site fields (contact, lat_2, lon_2, days_loc_2)
17. `017_drop_legacy_spec_text_columns.sql` - Drops legacy text columns (specialty_item_N, protein_spec_N, salsa_spec_N) replaced by FK columns
18. `018_rename_spec_fk_columns.sql` - Renames spec FK columns to consistent spec_id_N pattern, rebuilds view
19. `019_drop_summaries_table.sql` - Drops the unused summaries table (stats now computed client-side)
20. `020_drop_unused_sites_columns.sql` - Drops unused columns from sites table (contact, lat_2, lon_2, days_loc_2)
21. `021_create_group_sessions.sql` - Creates `group_sessions` table for Taco Summit feature (id, creator_token, site_ids, title, closed_at) with open RLS policies
22. `022_create_group_votes.sql` - Creates `group_votes` table for ranked-choice ballots (session_id, voter_token, est_id, rank) with unique constraint and index
23. `023_add_snacks_menu_type.sql` - Adds snacks as a menu type
24. `024_enable_rls_staging_extractions.sql` - Enables RLS on staging_extractions table (admin data-entry helper app); authenticated users get SELECT/INSERT/UPDATE, anonymous blocked
25. `025_fix_sites_complete_security_invoker.sql` - Fixes SECURITY DEFINER warning on sites_complete view by setting security_invoker = true (PostgreSQL 15+)
26. `026_add_quesadilla_to_view.sql` - Adds quesadilla_yes/quesadilla_perc to sites_complete view (columns already exist in menu table)
27. `027_create_vibe_votes.sql` - Creates `vibe_votes` table for the anti-review feature (binary emoji votes across four dimensions: heat_legit, authentic, value, vibe). Public SELECT for aggregate counts; INSERT/DELETE gated on `auth.uid() = user_id`
28. `028_extend_profiles.sql` - Adds `username` (UNIQUE slug, `[a-z0-9_]{3,20}`) and `bio` (≤280 chars) to `profiles`; updates the signup trigger to auto-generate a unique username from the email local-part; backfills existing rows; opens SELECT to anon/authenticated for `/u/[username]` browsing
29. `029_create_avatars_bucket.sql` - Creates the `avatars` Storage bucket (public-read, 1 MB cap, image/* mime types) and RLS on `storage.objects` so users can only write to their own folder (`avatars/<user_id>/`)
30. `030_add_vetting_status_to_sites.sql` - Adds `vetting_status` ('vetted'/'pending'), `source`, `source_url`, `scraped_at`, `vetted_at` to `sites` for the unvetted-spots feature; adds ON DELETE CASCADE FKs from `user_favorites`/`vibe_votes` to `sites` (with orphan cleanup) so retracting a pending spot is safe
31. `031_add_vetting_status_to_view.sql` - Rebuilds `sites_complete` view exposing `vetting_status`/`source`/`source_url` in the site jsonb
32. `032_add_closed_at_to_sites.sql` - Adds nullable `closed_at` to `sites` (NULL = open) for the closed-spots feature; partial index on closed rows
33. `033_add_closed_at_to_view.sql` - Rebuilds `sites_complete` view exposing `closed_at` in the site jsonb
34. `034_spec_link_healing.sql` - Self-healing specialty links + data health report (see Data Health below); backfills existing rows on apply
35. `035_widen_tucson_bounds.sql` - Widens the `bad_coordinates` box south to 31.8 so Green Valley is in scope
36. `036_create_salsa_styles.sql` - Salsa Atlas backend: `salsa_styles` catalog (ingredients, history, palette of hex codes, optional photo), `site_salsas` join table (per-spot heat/house name/note, no cap), `sync_site_salsas()` trigger, `salsas` storage bucket, and the seed of ~20 styles
37. `037_add_salsa_styles_to_view.sql` - Rebuilds `sites_complete` exposing `salsa.styles` (`[{slug, name, color, heat, house_name, note}]` plus the style's flavour scores, so the taste profile can match on them)
38. `038_create_user_favorite_salsas.sql` - `user_favorite_salsas` (user_id, style_id) with own-rows-only RLS, for favouriting salsas from the atlas
39. `039_salsa_field_sightings.sql` - Field sightings and draft styles: `site_salsas` gains `photo_url`/`palette`/`observed_at` (written by cartoTacoMenuExtract's Salsa Field Notes page) and `synced` (backfilled true for links to keyed styles); `salsa_styles` gains `status` (`draft`/`published`, public reads see published only); `sync_site_salsas()` now removes only links it created and keeps those carrying curated data; view exposes the sighting fields
40. `040_ai_usage.sql` - `ai_usage` (user_id, Tucson day, requests, tokens, escalations, cost_usd) with own-rows SELECT, and SECURITY DEFINER `record_ai_usage(...)` (authenticated only; adds to the caller's row, negatives clamped) for the concierge's per-user daily budget

### Data Health (self-healing)
Migration 034 makes the database repair specialty links itself. Cards only show specials whose `spec_id_N` FK is set; cartoTacoMenuExtract promotion writes the spec *name* into `specialty_item_N` / `protein_spec_N` / `salsa_spec_N` (re-added by that repo's migration 009 after 017 dropped them, so they exist in production) and links the id.
- `normalize_spec_name()` / `resolve_spec_id()` - one matching rule (lowercase, trimmed, collapsed whitespace; link only on exactly one match). Mirrored in cartoTacoMenuExtract `src/spec_tables.py`; keep them in sync
- BEFORE INSERT/UPDATE triggers on `menu`/`protein`/`salsa` fill an empty `spec_id_N` from its name slot; AFTER triggers on the spec tables run `heal_spec_links()` so creating/renaming a spec back-links existing spots. Healing only fills empty links, never overwrites or clears one. To unlink a special, clear its name slot too, or the trigger re-links it
- `heal_log` - every automatic fix (service role only)
- `data_health_report()` - read-only checks needing a human (unlinked/ambiguous specs, yes-vs-share mismatches, missing child rows/heat, bad coordinates, half-set hours, duplicate spots, stale pending/staging); severities `error`/`warn`/`info`
- `.github/workflows/data-health.yml` - nightly sweep + report into the job summary (uses `SUPABASE_DB_URL_PROD`); the same report is browsable in cartoTacoMenuExtract's Data Health page
- `.github/workflows/schema-parity.yml` - manual `pg_dump` diff of the prod and staging `public` schemas; catches hand-edits in the Supabase editor that leave no migration-history row. Staging legitimately runs ahead of prod mid-release, so a failure means "look at this", not "broken"
- All functions are revoked from `anon`/`authenticated`

### Salsa Atlas (salsa catalog)
Migrations 036/037/039. `salsa_styles` is the catalog behind `/salsa`; `site_salsas` says which spot serves which style.
- A style is tied to legacy data by `variety_key` (`verde` → `salsa.verde_yes`) or `spec_id` (→ `salsa_spec`). Styles with neither are hand-curated
- The `salsa` row is still what cartoTacoMenuExtract writes. `sync_site_salsas()` (AFTER trigger on `salsa`) adds `site_salsas` rows for keyed styles (marked `synced`) and removes only synced rows the salsa row no longer implies, and only while they carry no curated data (sighting photo/palette/date or a hand-set `heat`/`house_name`/`note`). Hand-made links (`synced = false`) are never touched. To add a salsa to a spot that has no boolean or spec for it, insert the `site_salsas` row directly
- Inserting or re-keying a style re-syncs every spot (statement trigger on `salsa_styles`), so a new keyed style picks up existing spots by itself
- `smoke`/`acid`/`sweet`/`chunk`/`rich` are 0–10 flavour scores (editorial estimates). With typical heat they are the six `AXES` in `src/lib/salsa.js`: they place a salsa on `SalsaMap` and `neighbours()` ranks relatives by distance across them
- `region` is a coarse bucket (`north`/`west`/`central`/`south`/`everywhere`) used only to cluster the atlas; `origin` is the display text
- `palette` is 3–5 lowercase hex codes, first one definitive (CHECK-enforced). Any palette colour can become a page background; `inkFor()` picks black or white text, and `salsa.test.js` asserts 4.5:1 against every seeded colour
- Curation happens in cartoTacoMenuExtract's Salsa Field Notes page (service role): the Sightings tab turns a photo with a grey card into a `site_salsas` sighting (photo, white-balanced palette, date); the Catalog tab edits a style's text, ingredients, flavour scores, palette, hero photo (`img_url` + `img_credit`) and `status`. New styles start as drafts, hidden from the public API (and from the view, which is security_invoker) until published. Until a style has a photo, `SalsaArt.svelte` draws a bowl from the palette
- The 036 seed is only the starting text; edits made in Field Notes live in the database, not in migrations

### Schema Management
- **`schema/sites_complete_view.sql`** is the single source of truth for the `sites_complete` view definition
- Any migration that rebuilds the view should copy from this canonical file
- See `schema/README.md` for full workflow

## State Management Architecture

The app uses Svelte stores (src/lib/stores.js) for centralized state:

### Core Data Stores
- `tacoStore` - Main site data from `sites_complete` view `{ data: [], loading: false, error: null }`

### Derived Stores
- `isLoading` - Loading state from tacoStore
- `hasError` - Error state from tacoStore
- `processedTacoData` - Transforms raw site data into component-ready format with pre-computed values (top 5 menu items, proteins, percentages, and specialty items embedded from view). Each site carries `vettingStatus`/`isPending`/`sourceUrl` and `isClosed`/`closedAt`; pending (unvetted, web-scraped) spots skip the menu/protein/salsa pre-computation and get empty arrays, while closed spots keep everything recorded while they were open
- `filteredTacoData` - Filters `processedTacoData` based on `filterConfig` (search, protein type, establishment type, spice level, open hours on Tucson's clock via `isOpenNow`, favorites, pending visibility, closed visibility). Closed spots never pass the Open Now filter, whatever their stale hours say. Spots failing `hasValidCoordinates()` are dropped first — they can't be placed on the map, so they can't be a map result either
- `summaryStats` - Computed from `processedTacoData` `{ maxSalsaNum, avgSalsaNum, maxHeatLevel, avgHeatLevel }` (open, vetted spots only)
- `distributionStats` - `Map<est_id, { heatPercentile, salsaPercentile }>` percentile ranks within the city distribution (powers "Hotter than X% of Tucson spots" context lines); pending and closed spots get no entry and don't affect the pools
- `recentlyAddedSites` - Spots added in the last 30 days, sorted newest first (used by NewSpotsBadge); excludes spots failing `hasValidCoordinates()`, since clicking one flies the map to it

### UI State Stores
- `selectedSite` - Currently selected establishment (drives the side panel on desktop/tablet and the bottom sheet on mobile)
- `filterConfig` - User's active filters: `{ searchText, proteins, types, spiceLevel, openNow, showFavoritesOnly, showPending, showClosed }`
  - `salsaStyle` (a `salsa_styles` slug, default `null`) is set from `/?salsa=<slug>` by the Salsa Atlas's "Show on the map"; `processedTacoData` sites carry `salsaStyles` from the view

### Authentication Store (src/lib/authStore.js)
- `authStore` - User, session, loading, and error state
- `isAuthenticated` (derived) - Boolean auth status
- `currentUser` (derived) - Current user object
- `currentSession` (derived) - Current session object
- Functions: `signUp(email, password, metadata)`, `signIn(email, password)`, `signOut()`, `requestPasswordReset(email)`, `verifyRecoveryLink({ tokenHash, type, code })`, `updatePassword(password)`
- Auto-initializes on module load with session restoration and real-time auth listener

### Favorites Store (src/lib/favoritesStore.js)
- `favoriteIds` - Set of favorited establishment IDs
- `favoritesLoading` - Loading state
- `favoritesCount` (derived) - Count of favorited sites
- Functions: `loadFavorites()`, `addFavorite(estId)`, `removeFavorite(estId)`, `toggleFavorite(estId)`, `isFavorited(estId)`

### Vibe Votes Store (src/lib/vibeVotesStore.js)
- `userVibeVoteKeys` - Set of `"${estId}:${dimension}"` strings for the current user's votes
- `vibeCountsByEst` - `Map<estId, {heat_legit, authentic, value, vibe}>` aggregate cache, populated lazily when a Card opens
- `VIBE_DIMENSIONS` - `['heat_legit', 'authentic', 'value', 'vibe']`
- Functions: `loadUserVibeVotes()`, `loadVibeCounts(estId, { force })`, `toggleVibeVote(estId, dimension)`, `hasVoted(estId, dimension)`
- Optimistic UI: toggle flips the user state and bumps the count immediately, reverting on DB failure

### Salsa Favorites Store (src/lib/salsaFavoritesStore.js)
- `favoriteSalsas` - Array of favourited `salsa_styles` rows (with flavour scores), newest first; `favoriteSalsaSlugs` (derived Set)
- Functions: `loadSalsaFavorites()`, `toggleSalsaFavorite(style)` (optimistic, reverts with a toast on failure)
- Feeds `tasteProfile`: with favourite salsas, k-NN adds `salsaAffinity()` (distance from the user's salsa taste to a spot's closest salsa) to the 7 spot dimensions, pulls spots serving a favourite closer, and returns `salsaTaste` plus `matchedSalsas` on each recommendation. Without any, recommendations are unchanged. A profile still needs at least one favourite *spot*

### Trail Store (src/lib/trailStore.js)
- `trailModeActive` - Whether trail building mode is active
- `trailStops` - Ordered array of trail stop site objects
- `trailTransportMode` - `'walking'` | `'cycling'` | `'driving'` for routing (Mapbox Directions profiles; share URLs use `mode=walk|bike|drive`)
- `trailRoute` - GeoJSON LineString from Mapbox Directions API
- `trailStopCount` (derived)
- Functions: `enterTrailMode()`, `exitTrailMode()`, `addStop(site)`, `addLocationStop(site, position)`, `removeStop(estId)`, `moveStop(fromIndex, toIndex)`, `clearStops()`, `fetchRoute(stops, mode)`

### New Spots Store (src/lib/newSpotsStore.js)
- `lastSeenNewSpotsTime` - Last time user viewed new spots (persisted in localStorage)
- `unseenNewSpotsCount` (derived) - Count of spots added since last view
- Functions: `markNewSpotsAsSeen()`

### Comparison Store (src/lib/comparisonStore.js)
- `comparisonSites` - Array of up to 3 sites selected for comparison
- `comparisonActive` - Whether the comparison tray is visible
- `comparisonCount` (derived) - Number of sites in comparison
- `MAX_COMPARE = 3` constant
- Functions: `addToComparison(site)`, `removeFromComparison(estId)`, `clearComparison()`, `closeComparison()`, `openComparison()`

### Taste Profile Store (src/lib/tasteProfileStore.js)
- `tasteProfile` (derived from `favoriteIds`, `processedTacoData`, `summaryStats`) - Full taste profile computed from user's favorites
  - k-NN recommendations (K=5) using 7-dimensional feature vectors (5 protein ratios, heat, salsa)
  - Protein affinities: chicken/beef/pork/fish/veg percentages, dominant protein, diversity score
  - Average spice level and salsa count from favorites centroid
  - Type preferences: restaurant/stand/truck fractions
  - Archetype scoring across 13 archetypes: `heat_seeker`, `salsa_explorer`, `the_purist`, `adventurer`, `street_food_fan`, `street_fire`, `connoisseur`, `spicy_purist`, `minimalist`, `mild_explorer`, `salsa_purist`, `loyalist`, `taco_enthusiast`
  - Scatter plot data points for visualization (heat vs salsa, favorites in blue, recommendations in orange)
  - Runner-up archetype (if score > 20)
- Returns `null` if no favorites or no data available
- Data-driven thresholds (p25/p50/p75 percentiles) for scoring

### Tour Store (src/lib/tourStore.js)
- `tourActive` - Whether the tour overlay is showing
- `tourStep` - Current step index (0-based)
- `tourExpandFilters` - Whether to expand filters during the filters tour step
- `TOUR_STEPS` - Array of 11 step definitions: `welcome`, `search`, `surprise`, `filters`, `trail`, `summit`, `map`, `vibe`, `theme`, `signup`, `done`
  - Each step has `id`, `target` (CSS selector or null for centered modal), `title`, `description`, optional `onEnter` action
- Functions: `startTour()`, `endTour()`, `nextStep()`, `prevStep()`, `shouldAutoStart()`
- Persistence: localStorage key `cartoTaco_tourCompleted`

### Map Lens Store (src/lib/mapLensStore.js)
- `mapLens` - Active map lens: `'spots'` (default clustered markers) | `'heat'` (points colored by heat on the sequential ramp) | `'salsa'` (points sized by salsa count) | `'density'` (Mapbox heatmap)
- `LENSES` - Lens definitions with labels and legend text

### UI Store (src/lib/uiStore.js)
- `filterPanelOpen` - Whether the FilterBar filter panel is expanded
- `mobileNavOpen` - Whether the mobile navigation menu is open
- `peekSite` - `{ site, lngLat } | null`: the spot the peek card is showing (set by mapping.js on pin hover, or first tap on touch tablets)
- `quickSearchOpen` - Whether the QuickSearch palette is open (header search button, ⌘K/Ctrl+K, or `/`)
- `chatOpen` - Whether the concierge `ChatPanel` is open (adds right map padding on desktop/tablet); `CHAT_PANEL_WIDTH` its docked width

### Concierge Chat Store (src/lib/agentStore.js)
- `chatMessages` - `[{ id, role, content, tier?, run_id?, feedback?, undo?, error? }]`; `chatPending`
- Functions: `ask(query)` (POSTs `{ query, history }` to `/api/agent`, last 12 non-error turns), `applyActions(actions)` (`show_spot` → `flyToTarget`, closing the chat on phones; `apply_filters` → `applyIntentFilters` over the current `filterConfig`; returns the config to restore), `undoMessage(id)`, `sendFeedback(id, 0|1)`, `clearChat()`

### Site Model (src/lib/siteModel.js)
The pure logic behind the stores, with no stores or Supabase client, so the server and offline evals can share it (see `docs/AI_CONCIERGE_PLAN.md`): `processSite(row)` / `processSites(rows)` (the body of `processedTacoData`), `computeSummaryStats`, `computeDistributionPool`, `computeDistributionStats`, `hasValidCoordinates`, `isOpenNow(hours, now)`, `matchesFilters(site, cfg, favIds, now)` (the `filteredTacoData` predicate), and `defaultFilterConfig()` (the `filterConfig` starting value). `stores.js` derives from these and re-exports `hasValidCoordinates`/`isOpenNow`. Change the logic here, not in the stores.

### Key Pattern
Data flows: Raw DB → Store → Derived/Processed → Components. Components rarely transform data; they consume pre-processed values from derived stores.

## Mapping System

The map implementation (src/lib/mapping.js) uses Mapbox GL with clustering:

### Configuration
- Clustering enabled with `clusterMaxZoom: 14` and `clusterRadius: 50`
- Three cluster size tiers with graduated colors (orange → dark orange → dark red)
- GeoJSON source with site data embedded in properties

### Layers
1. `clusters` - Cluster circles with graduated sizes
2. `cluster-count` - Cluster count labels
3. `unclustered-point` - Individual site markers with hover effects
4. `unclustered-point-label` - Site name labels (closed prefixed `✕`, pending `◌`)
5. `lens-points` / `lens-points-label` - Unclustered points for the heat/salsa lenses (from the non-clustered `taco-sites-all` twin source, hidden in spots lens)
6. `lens-heatmap` - Density heatmap lens layer
7. `trail-stop-circles` - Numbered orange circles for trail stops
8. `trail-stop-numbers` - Stop number labels (1, 2, 3…)
9. `trail-route-line` - Dashed route line connecting trail stops

### Key Functions
- `updateMarkers(processedSites, map)` - Add/update clusters and markers, attach event listeners
- `applyLens(map, lensId)` - Switch marker styling for the active map lens (visibility + data-driven paint on `heat`/`salsas` feature properties)
- `resetListeners(map)` - Clean up all event handlers
- `sitesToGeoJSON(processedSites)` - Convert sites to GeoJSON with embedded properties (incl. `closed`/`vetting_status` flags for data-driven styling); skips spots failing `hasValidCoordinates()`
- `flyToSite(map, site)` - Fly to a spot and open its card on arrival (side panel on desktop/tablet, bottom sheet on mobile)
- `openSpot(map, site)` - Open a spot's card from outside the map handlers (the peek card)
- `closeSpot(map)` - Close the open spot and give the map back its full width (see Interaction)
- `computeMapPadding()` / `syncMapPadding(map)` - Camera padding for whatever covers the map (mobile sheet, spot panel, concierge panel, trail/comparison tray). Every overlay-aware camera move uses it; Map.svelte re-syncs on store/resize changes, skipping mid-animation
- `spotPanelWidth(vw)` - The panel's width (360–560px, 38vw). SpotPanel renders at it and the camera pads by it
- `updateTrailLayers(map, stops)` - Render numbered trail stops
- `updateTrailRoute(map, routeGeojson)` - Render dashed route line from Mapbox Directions API
- `clearTrailLayers(map)` - Remove all trail visualization

### Interaction
- Click cluster: Zoom to expansion zoom level
- Click unclustered point: open the spot (side panel on desktop/tablet, bottom sheet on mobile) OR add to trail (if trail mode active). Touch tablets (no hover) peek on the first tap and open on the second
- Hover point (hover-capable desktop/tablet): after 150ms show `PeekCard`; it stays while the pointer is on it. Cursor and marker radius change as before
- Opening on desktop/tablet eases the spot into the middle of the uncovered map (`padding.left` = panel width, `top` = header) and zooms to 15 when further out than 13. Clicking another pin swaps the panel in place
- Back to exploring: ×, Esc (closes the peek first), a click on empty map (no pin/cluster under it; a drag never counts), or browser Back. Closing returns to the pre-open view if opening zoomed in and the user hasn't moved the map since (a user `movestart` has an `originalEvent`); otherwise it drops the padding in place so nothing slides. Clearing `selectedSite` any other way (e.g. the header menu) releases the camera the same way
- The open spot is in the URL as `?location=<id>` via SvelteKit shallow routing (`pushState`/`replaceState` in Map.svelte): one history entry per visit, swaps replace it, Back closes, Forward reopens. A `?location=` deep link opens the spot on its own entry, so closing rewrites the URL instead of leaving the app. Anything else writing the URL must keep `history.state` (see ComparisonTray)
- Markers update reactively via `updateMarkers()` when `filteredTacoData` changes

### Supporting Map Libraries
- `src/lib/mapStore.js` - Holds the Mapbox map instance
- `src/lib/geocoding.js` - Mapbox geocoding for address/location search

## Data Processing Utilities

Located in src/lib/dataWrangling.js:

- `filterObjectByKeySubstring(obj, substring)` - Extract object entries matching key pattern (e.g., "_perc" fields)
- `getTopFive(arr, n = 5)` - Sort and return top N items, stripping '_perc' suffix from keys
- `percentageOfMaxArray(arr)` - Convert array values to percentages of max
- `convertHoursData(startTimes, endTimes)` - Transform hours data into component-ready format (Mon–Sun order with abbreviations)
- `describeHeat(value)` - Words for a 0–10 heat level ("Medium-Hot"), shared by `SpiceGauge` and `SpotStats`

## Search & Intent (model-free)

The free first tier of the planned AI concierge (`docs/AI_CONCIERGE_PLAN.md`). No model and no network.
- `src/lib/search.js` - `searchSpots(query, sites, { limit })` → `[{ site, score, matchedOn: { field, label } }]`. Accent-insensitive (`normalize()`), typo-tolerant (Damerau `editDistance()`; 1 typo from 4 letters, 2 from 7, none below), weighted by field (name > specialty > protein style/protein > menu > region/type > address > description), with Spanish protein synonyms. Every query word must match something. Closed spots rank after open ones and unplaceable spots are skipped. Field text is cached per spot object in a WeakMap
- `src/lib/intentRules.js` - `parseIntent(query)` → `{ filters, extras, matched, remainder, covered }`: proteins, types (with negation: "no trucks" selects every other type), spice ("spicy" 7+, "very spicy" 8+, "mild"/"not spicy" ≤4; "hot dog" protected), open now, favorites, plus `extras.handmadeTortillas` / `extras.near`. English and Spanish. `covered` means no words were left over. `applyIntentFilters(cfg, filters)` merges the parsed filters into a filterConfig
- `src/lib/voice.js` - Web Speech API wrapper: `speechSupported()`, `listen({ onResult, onEnd, onError, lang })` → stop fn, `describeVoiceError(code)`. There is no Firefox support, so callers hide the mic. `speechSupported()` is also false on iPhone/iPad (`isAppleMobile()`, which also catches iPadOS posing as a Mac via `maxTouchPoints`): WebKit there records once, then every later `start()` goes deaf with no result, error or end (open WebKit bug), so QuickSearch points people at the keyboard's dictation mic instead. One session at a time (a new `listen()` aborts the old one), and a session ends on our side, with `onEnd` exactly once, on its final result, an error, a stop, or a 15s watchdog. Never wait on the browser's `end` event: Safari often doesn't send it, which once left the mic stuck after one use

## AI Concierge

`src/lib/server/agent/` is the server-only harness; `/api/agent` and `ChatPanel` ship it (phase 3). Plan and deviations in `docs/AI_CONCIERGE_PLAN.md` → "Phase 2 as built" / "Phase 3 as built".
- `src/routes/api/agent/+server.js` - `POST { query, history }` → `{ reply, actions, tier, run_id }`. Signed-in only (401), query 1–500 chars (400), history trimmed to 12 `user`/`assistant` turns of ≤2000 chars (anything else the client sends is dropped). Loads the catalog and the user's favorites, checks today's `ai_usage` against `AI_DAILY_TOKENS` (default 200k; an unreadable row fails closed except in dev) and runs `runConcierge` with `rulesOnly` when over. A failed model call (e.g. the Anthropic workspace spend limit, the global kill switch) retries rules-only. Records usage via `record_ai_usage` when a model ran. `maxDuration` 60. JSON, not SSE (replies take ~2 s)
- `src/routes/api/agent/feedback/+server.js` - `POST { run_id, score: 0|1 }` → LangSmith feedback `user_score` on the trace; no-op without `LANGSMITH_API_KEY`
- `src/lib/server/catalog.js` - `getCatalog(supabase)`: `sites_complete` → `processSites`, cached 5 minutes per server instance
- `hooks.server.js` copies `ANTHROPIC_*`/`LANGSMITH_*`/`AGENT_*` from `$env/dynamic/private` into `process.env`, since LangChain/LangSmith read `process.env` and Vite's dev server doesn't fill it from `.env`
- `concierge.js` - `runConcierge({ query, history, catalog, now, user, models, llm, allowEscalation, rulesOnly })` → `{ reply, actions, tier, route, escalation_reason, calls, cost, run_id }`. `rulesOnly` stops after T0 with a "budget used up" reply. When the router names a spot, T2/T3 start with that `search_spots` already run (a seeded tool call). `cleanReply()` strips leading/trailing "Let me show you…" narration and `**bold**` from each turn, and text written alongside a read-tool call is dropped. Tiers: T0 rules (`parseIntent` fully covers the query, or the query is a spot name) → T1 Haiku router (structured output) with deterministic handlers for chitchat/off_topic/find_spot/filter → T2 Haiku tool loop (intent-scoped tools, 4 steps) → T3 Sonnet when T2 hits the cap, replies empty, or cites an `[#est_id]` no tool returned. Wrapped in LangSmith `traceable`; the tier/route go on the run's metadata
- `tools.js` - `makeTools({ catalog, now, user })` → `{ fns, tools, actions }`: `search_spots` (its `total` counts every match, not just the rows returned), `get_spot`, `city_stats` (read), `show_spot`, `apply_filters` (record actions; unknown est_ids throw `ToolError`; `dish` sets the map's `searchText`, which `matchesFilters` also checks against protein styles). `fns` are the plain functions, `tools` the LangChain wrappers
- `prompt.js` - router/agent system prompts and `PROMPT_VERSION` (bump on any wording change). `models.js` - model ids per tier (env-overridable) and `callCost()`
- Replies cite spots as `Name [#est_id]`; evals and the T2 check parse that
- `evals/` - `run.js` (runner + evaluators; LangSmith `evaluate()` when keyed, local loop otherwise), `sync-dataset.js` (upserts the golden file into the `cartotaco-concierge-golden` dataset by golden id, category as split; the repo file is the source of truth), `chat.js`, `refresh-fixture.js`, `golden/concierge.jsonl` (one example per line: `query`, `category`, optional `user`/`now`/`history` (prior `{role, content}` turns), `expect.{tiers,intent (string or list of accepted intents),actions,must_ids,must_any_ids,must_not_ids,reply_matches}`, `rubric`), `fixtures/sites_snapshot.json`. Results in `evals/results/` (gitignored)
- The harness imports `siteModel`/`search`/`intentRules`/`hours`/`dataWrangling` from plain Node, so imports among those use explicit `.js` extensions; keep it that way or `pnpm eval` breaks

## Coordinate Validation

`hasValidCoordinates(site)` in `src/lib/stores.js` gates every map-facing store
on a Tucson metro bounding box (lat 31.8–32.6, lon -111.4–-110.5; the south edge takes in Green Valley). The same
numbers back the `bad_coordinates` check in `data_health_report()` (migrations
034/035) — keep the two in sync.

Scraped pending spots arrive with NULL coordinates when the geocoder misses.
Mapbox reads `[null, null]` as `[0, 0]`, so a truthiness check hid the marker
but not the camera: searching for such a spot, or hitting Surprise Me, sailed
the map into the Gulf of Guinea (issue #67). Unplaceable spots stay in
`processedTacoData` (so the nightly data health report still reports them) but
are dropped from `filteredTacoData`, `recentlyAddedSites`, `sitesToGeoJSON()`
and `flyToSite()`.

## Supporting Utilities

- `src/lib/auth.js` - Server-side Supabase client with cookie handling (used by `hooks.server.js`)
- `src/lib/censusStore.js` - `censusStats` derived store backing `/census`
- `src/lib/hours.js` - Opening hours on Tucson's clock (`America/Phoenix`, no DST) whatever the browser's zone: `tucsonNow()`, `parseTime()`, `formatTime()`, `getOpenStatus(hours[, endHours], date)` → `{ isOpen, state: 'open'|'closing-soon'|'opens-later'|'closed'|'unknown', label }` with labels like "Open til 10 PM", "Closes soon · 9:30 PM" (≤60 min), "Opens at 8 AM", "Opens tomorrow at 8 AM", "Opens Mon at 11 AM". Overnight spans count after midnight. `todayHours()` gives "8 AM – 10 PM" / "Closed today" / "Open 24 hours" for the card's Today line. `minuteClock` ticks each minute so labels roll over live. `isOpenNow` (stores.js) and `HoursOpen` both use it
- `src/lib/directions.js` - `directionsUrl(spot)` / `openDirections(spot)`: Apple Maps on iOS, a `geo:` intent on Android, Google Maps on the web. Used by `DirectionsButton` and `SpotHeader`
- `src/lib/vibeVotes.js` - Vibe vote database operations (the store wraps these)
- `src/lib/authErrors.js` - Maps Supabase auth errors to friendly messages (e.g. email rate limit, expired reset link, reused password)
- `src/lib/favorites.js` - Favorites database operations (add, remove, fetch)
- `src/lib/submissions.js` - Location submission handling and DB persistence
- `src/lib/validation.js` - Form validation functions for submissions/auth forms
- `src/lib/theme.js` - Dark/light mode management
- `src/lib/chartTheme.js` - Shared chart styling: validated categorical palettes (light/dark), sequential coral ramp, ink/grid/tooltip helpers, `CHART_FONT`. All ECharts components build their options from these. Design tokens live as CSS variables in `src/app.css` (surfaces, inks, hairlines, accent, chart tokens) and map into Tailwind as `surface-*`/`ink-*`/`line-*`/`accent-*`; dark mode flips the tokens, so new components should not need `:global(.dark)` overrides. `--header-h` is a layout token: `Header.svelte` measures the real header bar and writes it to `:root`, and map-page overlays (FilterBar, Mapbox controls) offset from it rather than hardcoding a header height. Typography: Outfit Variable (display/headings) + Inter Variable (UI/body), self-hosted via `@fontsource-variable`. Fraunces Variable (`--font-serif`) is the editorial serif, used sparingly for spot names on the panel and peek card (the same face as the Salsa Atlas); `--font-mono` sets the uppercase kicker labels. `--spot-panel-offset` is set on `:root` by Map.svelte while the desktop panel is open, so MapLegend and the bottom trays start beside it. `--glass-bg`/`--glass-filter` give the spot panel and mobile sheet a frosted, slightly see-through surface over the map; components apply them only under `@supports (backdrop-filter)` and fall back to `--surface-1` for `prefers-reduced-transparency`.
- `src/lib/deviceDetection.js` - Responsive device type detection (mobile/tablet/desktop)
- `src/lib/supabaseBrowser.js` - Browser-side Supabase client using `@supabase/ssr` `createBrowserClient` with cookie support; exports `supabaseBrowser` client and `getAuthenticatedUser()` helper
- `src/lib/profiles.js` - Profiles CRUD: `getOwnProfile()`, `getProfileByUsername()`, `updateProfile()`, `uploadAvatar()`. Public reads use only safe columns (no email). Avatar uploads write to `avatars/<user_id>/avatar.{ext}` and bust browser cache via `?t=` query param.
- `src/lib/toastStore.js` - Tiny non-blocking notification store with `toast.success/error/info()` helpers. Rendered by `<ToastHost />` mounted once in `+layout.svelte`.

## Component Organization

### Main Components (src/components/)
- `Card.svelte` - Spot card body, identical on the desktop panel and the mobile sheet (`SpotHeader` sits above it). One column, sized to fill it: Hours (`HoursOpen size="lg"` + a "Today" line) and About first, then `SpotStats` tiles, What they serve (the radar, large, with per-axis percentages, Menu/Protein toggle), Vibe check, and Specialties (`SpecCarousel`, cards at 85% of the column) last. Sections are labelled bands split by hairlines with a staggered entrance
- `SpotHeader.svelte` - Shared card header: mono kicker (type · region), Fraunces name with the restaurant/stand/truck icons, Tucson-time status + address, with Favorite + Compare grouped beside them, then Directions / Call / Website / socials as their own group of pill buttons. Each group wraps as a unit. Closed spots drop Directions and Compare; pending spots drop Compare. `showClose={false}` in the mobile sheet (its drag bar has the ×)
- `SpotStats.svelte` - At-a-glance tiles: Heat (48px number, full-width 10-notch ladder, city percentile, `ContextStrip`), Salsas (number, bar against the city max with an average tick, `SalsaLineup`), Tortillas (spans the row). Two columns when the column fits two 220px tiles, stacked otherwise
- `SpotPanel.svelte` - Desktop/tablet spot panel docked left under the header, full height, own scroll, with `SpotHeader` fixed at the top. Renders `Card` or `PendingSpotCard hideHeader`, keyed by spot so swaps re-run the entrance. The mobile bottom sheet (in Map.svelte) renders the same `SpotHeader` + `Card` inside its scroll area
- `PeekCard.svelte` - Small floating summary over the hovered pin: status, name, "Known for" (first listed specialty), a quick-facts line (salsa count, handmade/corn/flour tortillas) and top 3 proteins; pending/closed notes instead for those spots. Everything is derived at render from `processedTacoData`, nothing stored. "Open card" opens the panel, morphing the name across with a view transition where supported; in trail mode it offers "Add as stop N"/"Remove stop N". Placed above the pin, flipped below near the top, kept clear of the panel
- `CollapsibleSection.svelte` - Reusable accordion/collapsible section
- `ContactInfo.svelte` - Displays contact links (phone, website, Instagram, Facebook)
- `DirectionsButton.svelte` - Opens Google Maps directions to an establishment
- `FavoriteButton.svelte` - Heart button for toggling favorites (requires auth)
- `FilterBar.svelte` - Search and filter controls: toggle chips with live city-composition counts (proteins, types, Open Now), dual-thumb spice range slider, and a removable active-filters chip row visible even when the panel is collapsed
- `Header.svelte` - Main application header; authenticated desktop nav consolidates account actions (Submit/Favorites/Profile/Sign Out) into a user dropdown menu
- `LoadingState.svelte` - Shared loading indicator (bobbing taco + pulsing dots + message), reduced-motion aware; used by Map, census, and compare
- `HandmadeBadge.svelte` - "Handmade Tortillas" pill shown on Card
- `HoursInput.svelte` - Input component for hours data (used in submission form)
- `HoursOpen.svelte` - Week Rhythm strip: 7 day pills with mini open-span bars on a shared 24h scale, today ring (Tucson's day), status dot with the `getOpenStatus` label; overnight hours wrap. `showTitle`/`showStatus` props hide the heading and label when the surrounding card has them; `size="lg"` stretches the days across the full width with taller bars
- `IconHighlight.svelte` - Icon-based feature highlights
- `LocationPicker.svelte` - Map-based location selection component
- `MapLensPicker.svelte` - Map lens switcher (Spots / Heat / Salsas / Density) with inline legends; drives `mapLens` store. Data lenses exclude pending spots (no measurements) and closed spots (measurements are history). The density heatmap uses a deliberately wide `heatmap-radius` — Tucson's spots are sparse enough that the stock radius drew one blob per spot and nothing between them
- `MapLegend.svelte` - Small floating `● Vetted / ◌ Pending / ✕ Closed` legend; only shown in the Spots lens, each row only when such spots exist
- `NewSpotsBadge.svelte` - Badge showing count of recently added establishments (pending entries get a `◌ Pending` chip)
- `ClosedBanner.svelte` - Dashed grey banner (`✕ Permanently closed` + closure month) rendered at the top of any card for a closed spot. Closed spots also lose vibe voting, comparison, and directions, but keep hours/charts as a historical record
- `PendingSpotCard.svelte` - Lightweight preliminary card for pending (unvetted) spots: pending badge, info panel, scraped hours/contact if present, source link, vetting CTA. Dashed `--pending` border; no radar/heat/salsa/vibe/compare. `hideHeader` (panel and sheet) also drops its contact block, since `SpotHeader` carries those actions
- `RadarChart.svelte` - Menu/protein radar (ECharts), the app's signature chart: keep it. Supports multi-series overlays via `seriesList` (categorical palette + legend), used by `/compare` and TasteProfile. `labelSize` sets the axis label size; `showValues` (single series) prints each axis's percentage under its name and sizes the radar from its box so the two-line labels never clip
- `SalsaCount.svelte` - Salsa count bullet bar (ECharts): value bar over city-max track with an average tick
- `SalsaLineup.svelte` - Per-salsa chip row: catalog styles as colour-dotted links to `/salsa/[slug]` (falling back to the named varieties on a database without `salsa.styles`) plus the spot's "other" house salsas with individual heat dots and tap-to-reveal descriptions. Data comes from `salsaVarieties`/`otherSalsas` on `processedTacoData`
- `SalsaHex.svelte` - One salsa as a hexagon (definitive colour, lower tip in colours 2 and 3, hatched when no Tucson spot serves it). Must sit in a `.hex-cell` inside `.honeycomb > .comb`; those layout styles are global-under-`.salsa-atlas` in `src/routes/salsa/+layout.svelte`
- `SalsaFavoriteButton.svelte` - Heart for a salsa style on its atlas page (signed-out users go to login); colours come from `currentColor`
- `SalsaMap.svelte` - Scatter on a salsa's page: every salsa as a dot (in its own colour) on two reader-picked axes from `AXES` (heat + the five flavour columns), this salsa and its four nearest relatives labelled and joined, hover/focus tooltip, and a table of the same numbers. Opens on the two axes that spread the group widest
- `SalsaArt.svelte` - Generated stand-in for a salsa photo: top-down bowl drawn from the palette, seeded by slug so SSR and client match
- `SpecCarousel.svelte` & `SpecCard.svelte` - Specialty item displays
- `SpiceGauge.svelte` - Heat Ladder: 10-notch sequential-coral meter with hero number and optional city-percentile context line (pure Svelte/CSS, no chart lib)
- `ThemeToggle.svelte` - Dark/light mode toggle button
- `TrailTray.svelte` - Taco trail builder interface (stop list, reordering, transport mode, route display)
- `ComparisonTray.svelte` - Floating tray for selecting up to 3 spots for side-by-side comparison
- `TasteProfile.svelte` - Personal taste profile visualization with archetype display, protein affinities, and scatter plot (heat vs salsa)
- `TourOverlay.svelte` - Multi-step onboarding tour with targeted tooltips, step highlighting, and next/prev/skip navigation
- `SummitResults.svelte` - Taco Summit results view: ECharts stacked horizontal bar showing rank distribution per spot (orange gradient), winner callout, dark-mode reactive, optional PNG card download
- `VibeVotes.svelte` - Anti-review chip row on each Card: 🔥 Heat Legit · 🌮 Authentic · 💸 Value · 🎭 Vibe. Click toggles your vote (anonymous users redirected to login); displays aggregate counts. Accepts `compact` prop for tight desktop layouts.
- `VibeFingerprint.svelte` - Compact 4-bar profile of a spot's vibe votes (normalized to its own total) so vibe shapes compare across spots; hidden with no votes unless `showEmpty`. On Card beside the chips and as a `/compare` row.
- `ContextStrip.svelte` - City-distribution dot strip: every spot as a faint dot on a shared scale with this spot highlighted (used in the `SpotStats` heat tile).
- `QuickSearch.svelte` - ⌘K / `/` command palette, mounted once in `+layout.svelte`. Results from `searchSpots` update on every keystroke, each showing type, Tucson-time status and why it matched. A "Filter the map" row appears when `parseIntent` finds filters: its results are the remainder searched within the matching spots, and choosing it sets `filterConfig` and opens the filter panel. A mic button appears where speech recognition works (not iPhone/iPad, whose placeholder points at the keyboard's 🎤). Picking a spot sets `flyToTarget` on the map page, or goes to `/?location=<id>` elsewhere. Esc is handled on the dialog so it never also closes the open spot. On phones it's a full-screen sheet
- `EmptyState.svelte` - Shared empty state (emoji + headline + message + optional CTA); used by favorites, compare, and census.
- `ChatPanel.svelte` - The concierge chat, mounted in Map.svelte. An "Ask" launcher bottom right (above an open trail/comparison tray, hidden on phones while a spot sheet is up) opens a full-height panel docked right under the header on desktop/tablet (the mirror of `SpotPanel`, `CHAT_PANEL_WIDTH` = 380px; `--chat-panel-offset` on `:root` moves the FilterBar, Mapbox controls and trays left of it), or a 70dvh bottom sheet on phones. Signed-out users get a sign-in link. Replies turn `Name [#est_id]` into a link on the name that opens the spot; filter replies get "Undo filters"; traced replies get 👍/👎; a "New chat" button in the header clears the conversation; mic where `speechSupported()` (a final result sends). Example prompts when empty
- `ToastHost.svelte` - Renders the `toasts` store as a stack of dismissable notifications, mounted once in `+layout.svelte`. Uses Phosphor `CheckCircle/WarningCircle/Info/X` icons.

### Routes
- `src/routes/+layout.svelte` - Root layout (Header, theme initialization)
- `src/routes/+layout.js` - Root layout loader
- `src/routes/+page.svelte` - Main page (renders Map component)
- `src/routes/+page.js` - Route config (prerendering disabled; app requires Supabase at runtime)
- `src/routes/Map.svelte` - Map component with filter integration and trail mode support

#### Public Routes
- `src/routes/census/+page.svelte` - Tucson Taco Census: public city-wide stats dashboard (hero tiles, menu prevalence, protein leaderboard, heat histogram, tortilla split, 7×24 open-hours grid, growth timeline), all client-side from `censusStats` (`src/lib/censusStore.js`). The growth timeline is the one figure built from open/close *events* over all vetted spots, closed included — it describes history, so it must not be recomputed from today's survivors or every closure retroactively erases the spot's past (issue #62)
- `src/routes/compare/+page.svelte` - Side-by-side comparison of up to 3 spots (shareable via `?ids=1,2,3` query params). Desktop renders Menu/Protein as single overlaid radars with shared axes. Sticky command bar (+ mobile spot tabs) and a sticky spot-name header row keep navigation reachable at any scroll depth; an "at a glance" verdict strip (leader per metric with margin) sits above the grid. NOTE: `overflow-x` on these pages must stay `clip`, never `hidden` — hidden creates a scrollport that silently breaks the sticky positioning
- `src/routes/compare/+page.js` - Route config for comparison page
- `src/routes/salsa/` - Salsa Atlas. `+layout.server.js` loads the whole `salsa_styles` catalog once (server-rendered); `+layout.svelte` scopes the Fraunces display face to these routes, holds the honeycomb CSS, and runs View Transitions between atlas pages. `+page.svelte` is the honeycomb index: `clusterStyles()` groups the salsas by the feature in `?by=` (family, colour, region, heat, in Tucson) and `honeycombLayout()` places each group as a blob on one shared hex lattice, at least one empty cell apart; hexagons are absolutely positioned so re-clustering animates with a CSS transform transition. The atlas re-points the surface/ink tokens to a corn-yellow theme (toasted corn in dark mode) inside `.salsa-atlas`. `[slug]/+page.svelte` is one salsa: hero, click-to-copy palette, ingredients, history, spots serving it (from `processedTacoData`), neighbours and ←/→ paging. Helpers in `src/lib/salsa.js`
- `src/routes/vote/new/+page.svelte` - Taco Summit creation: pick 2–6 spots, set a title, creates a `group_sessions` row and redirects to the voting page
- `src/routes/vote/[session_id]/+page.svelte` - Taco Summit voting/results page; states: ranked-choice ballot entry, post-vote waiting with live preview, locked results with `SummitResults`; uses Supabase Realtime for live vote counts and session lock detection; anonymous via `voter_token` UUID in localStorage; creator identified by `creator_token` in localStorage
- `src/routes/u/[username]/+page.svelte` + `+page.server.js` - Public profile page; server load looks up `profiles` by username (404 if not found); renders avatar, display name, username, bio, member-since. Recent check-ins section is a placeholder until Phase 3 ships.

#### Authentication Routes (`src/routes/(auth)/`)
- `login/+page.svelte` - Login form
- `signup/+page.svelte` - Registration form
- `auth/confirm/+page.svelte` - Email confirmation callback
- `forgot-password/+page.svelte` - Requests a password reset email (linked from login). Shows the same "check your email" message whether or not the address has an account
- `reset-password/+page.svelte` - Landing page for the reset email (`token_hash` + `type=recovery`, or a PKCE `code`), then a new-password form. Without a link it works only for a signed-in user, which is how the profile page's "Change password" row uses it. Email template: `supabase/templates/reset-password.html`; dashboard setup in `docs/DEPLOYMENT.md` → Auth email templates

#### Protected Routes (`src/routes/(protected)/`)
- `favorites/+page.svelte` - User's favorited establishments list
- `favorites/+page.server.js` - Server-side favorites loading
- `profile/+page.svelte` - User profile management
- `profile/+page.server.js` - Server-side profile operations
- `submit/+page.svelte` - New location submission form
- `submit/+page.server.js` - Server-side submission handling

## Filter System

The filter system works through reactive updates:

1. User interacts with `FilterBar.svelte` → Updates `filterConfig` store
2. `filteredTacoData` derived store automatically recomputes filtered sites
3. `Map.svelte` receives updated filtered data and calls `updateMarkers()`
4. Map updates clustering and markers reactively

### Filter Types
- Text search (name, description, menu items, proteins, specialties)
- Protein types (chicken, beef, pork, fish, veg)
- Establishment types (Brick and Mortar, Stand, Truck)
- Spice level range (0-10)
- Open now (based on current time/day)
- Show favorites only (requires auth)
- Pending spots toggle (default on; chip only renders when pending spots exist)
- Closed spots toggle (default on; chip only renders when closed spots exist)

## Performance Considerations

- Single database query using `sites_complete` view instead of multiple joins
- Pre-computation of derived values in `processedTacoData` store
- Mapbox clustering for efficient rendering of many markers
- Prerendering disabled (Supabase auth runs in hooks.server.js on every request)

## Testing

Test files are co-located in src/lib/:
- `src/lib/stores.test.js` - Unit tests for core stores
- `src/lib/dataWrangling.test.js` - Tests for data transformation functions
- `src/lib/geocoding.test.js` - Tests for geocoding functions
- `src/lib/validation.test.js` - Tests for form validation functions
- `src/lib/pendingSpots.test.js` - Tests for pending-spot processing/filtering
- `src/lib/closedSpots.test.js` - Tests for closed-spot processing/filtering/map styling
- `src/lib/mapping.test.js` - Tests for map layer/GeoJSON helpers, coordinate validation, and the spot panel's fly-to/close camera
- `src/lib/hours.test.js` - Tests for Tucson-time open status and today's hours (uses UTC instants so it passes in any runner time zone)
- `src/lib/directions.test.js` - Tests for the per-platform directions link
- `src/lib/salsa.test.js` - Tests for Salsa Atlas helpers (contrast on every seeded palette colour, sorting, spot lists)
- `src/lib/authErrors.test.js` - Tests for auth error message mapping
- `src/lib/search.test.js` - Quick Search golden queries (query → expected top spot), ranking and edge cases. Add a golden row when a real query ranks wrong
- `src/lib/intentRules.test.js` - Filter parsing (English/Spanish, negation, hot dog vs heat, remainder)
- `src/lib/voice.test.js` - Voice session lifecycle against a fake SpeechRecognition (missing `end` events, stale events, start failures, watchdog)
- `src/lib/agentStore.test.js` - Chat store: filters applied and undone, spots opened, history sent, errors kept out of history
- `src/routes/api/agent/server.test.js` - Endpoint: 401/400, client-supplied fields dropped, favorites passed, usage recorded, rules-only over budget and on model failure
- `src/lib/server/agent/concierge.test.js` - Concierge tier routing with scripted fake models (T0 hits, router handlers, tool loop, escalation reasons) and tool behaviour, against the eval fixture. No API calls

Run all tests with `pnpm test`.

## Documentation

Detailed feature documentation in docs/:
- `DEPLOYMENT.md` - Branch flow, CI/CD, migrations, secrets, rollback (canonical workflow)
- `IMPROVEMENTS.md` - Roadmap and planned features
- `UNVETTED_SPOTS_PLAN.md` - Pending/unvetted spots plan (shipped in this repo; scraping pipeline lives in `cartoTacoMenuExtract`)
- `USER_SUBMISSIONS.md` - Location submission design and the manual approval process
- `AI_CONCIERGE_PLAN.md` - Cost-first AI concierge: tiered router (rules → Haiku router → Haiku agent → Sonnet escalation) on LangChain/LangGraph, LangSmith tracing, golden-dataset evals. Phase 1 (search/intent/voice) shipped; phase 2 harness and phase 3 chat built
