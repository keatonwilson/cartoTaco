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

## Environment Setup

Required environment variables in `.env`:
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

### Data Health (self-healing)
Migration 034 makes the database repair specialty links itself. Cards only show specials whose `spec_id_N` FK is set; cartoTacoMenuExtract promotion writes the spec *name* into `specialty_item_N` / `protein_spec_N` / `salsa_spec_N` (re-added by that repo's migration 009 after 017 dropped them, so they exist in production) and links the id.
- `normalize_spec_name()` / `resolve_spec_id()` - one matching rule (lowercase, trimmed, collapsed whitespace; link only on exactly one match). Mirrored in cartoTacoMenuExtract `src/spec_tables.py`; keep them in sync
- BEFORE INSERT/UPDATE triggers on `menu`/`protein`/`salsa` fill an empty `spec_id_N` from its name slot; AFTER triggers on the spec tables run `heal_spec_links()` so creating/renaming a spec back-links existing spots. Healing only fills empty links, never overwrites or clears one. To unlink a special, clear its name slot too, or the trigger re-links it
- `heal_log` - every automatic fix (service role only)
- `data_health_report()` - read-only checks needing a human (unlinked/ambiguous specs, yes-vs-share mismatches, missing child rows/heat, bad coordinates, half-set hours, duplicate spots, stale pending/staging); severities `error`/`warn`/`info`
- `.github/workflows/data-health.yml` - nightly sweep + report into the job summary (uses `SUPABASE_DB_URL_PROD`); the same report is browsable in cartoTacoMenuExtract's Data Health page
- `.github/workflows/schema-parity.yml` - manual `pg_dump` diff of the prod and staging `public` schemas; catches hand-edits in the Supabase editor that leave no migration-history row. Staging legitimately runs ahead of prod mid-release, so a failure means "look at this", not "broken"
- All functions are revoked from `anon`/`authenticated`

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
- `filteredTacoData` - Filters `processedTacoData` based on `filterConfig` (search, protein type, establishment type, spice level, open hours, favorites, pending visibility, closed visibility). Closed spots never pass the Open Now filter, whatever their stale hours say. Spots failing `hasValidCoordinates()` are dropped first — they can't be placed on the map, so they can't be a map result either
- `summaryStats` - Computed from `processedTacoData` `{ maxSalsaNum, avgSalsaNum, maxHeatLevel, avgHeatLevel }` (open, vetted spots only)
- `distributionStats` - `Map<est_id, { heatPercentile, salsaPercentile }>` percentile ranks within the city distribution (powers "Hotter than X% of Tucson spots" context lines); pending and closed spots get no entry and don't affect the pools
- `recentlyAddedSites` - Spots added in the last 30 days, sorted newest first (used by NewSpotsBadge); excludes spots failing `hasValidCoordinates()`, since clicking one flies the map to it

### UI State Stores
- `selectedSite` - Currently selected establishment (for popup)
- `filterConfig` - User's active filters: `{ searchText, proteins, types, spiceLevel, openNow, showFavoritesOnly, showPending, showClosed }`

### Authentication Store (src/lib/authStore.js)
- `authStore` - User, session, loading, and error state
- `isAuthenticated` (derived) - Boolean auth status
- `currentUser` (derived) - Current user object
- `currentSession` (derived) - Current session object
- Functions: `signUp(email, password, metadata)`, `signIn(email, password)`, `signOut()`
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
- `flyToSite(map, site)` - Animate to location and open popup
- `updateTrailLayers(map, stops)` - Render numbered trail stops
- `updateTrailRoute(map, routeGeojson)` - Render dashed route line from Mapbox Directions API
- `clearTrailLayers(map)` - Remove all trail visualization
- `createPopupContent(siteId)` - Create Card component instance for popup
- `adjustPopupPosition(popup, map)` - Ensure popup stays within map bounds

### Interaction
- Click cluster: Zoom to expansion zoom level
- Click unclustered point: Show popup with `Card.svelte` OR add to trail (if trail mode active)
- Hover point/cluster: Change cursor to pointer; increase marker radius
- Markers update reactively via `updateMarkers()` when `filteredTacoData` changes

### Supporting Map Libraries
- `src/lib/mapStore.js` - Holds the Mapbox map instance
- `src/lib/mapStyles.js` - Mapbox style definitions for the MapStylePicker
- `src/lib/geocoding.js` - Mapbox geocoding for address/location search

## Data Processing Utilities

Located in src/lib/dataWrangling.js:

- `filterObjectByKeySubstring(obj, substring)` - Extract object entries matching key pattern (e.g., "_perc" fields)
- `getTopFive(arr, n = 5)` - Sort and return top N items, stripping '_perc' suffix from keys
- `percentageOfMaxArray(arr)` - Convert array values to percentages of max
- `convertHoursData(startTimes, endTimes)` - Transform hours data into component-ready format (Mon–Sun order with abbreviations)

## Coordinate Validation

`hasValidCoordinates(site)` in `src/lib/stores.js` gates every map-facing store
on a Tucson metro bounding box (lat 31.9–32.6, lon -111.4–-110.5). The same
numbers back the `bad_coordinates` check in `data_health_report()` (migration
034) — keep the two in sync.

Scraped pending spots arrive with NULL coordinates when the geocoder misses.
Mapbox reads `[null, null]` as `[0, 0]`, so a truthiness check hid the marker
but not the camera: searching for such a spot, or hitting Surprise Me, sailed
the map into the Gulf of Guinea (issue #67). Unplaceable spots stay in
`processedTacoData` (so the nightly data health report still reports them) but
are dropped from `filteredTacoData`, `recentlyAddedSites`, `sitesToGeoJSON()`
and `flyToSite()`.

## Supporting Utilities

- `src/lib/auth.js` - Additional Supabase auth utilities
- `src/lib/authErrors.js` - Maps Supabase auth errors to friendly messages (e.g. signup email rate limit)
- `src/lib/favorites.js` - Favorites database operations (add, remove, fetch)
- `src/lib/submissions.js` - Location submission handling and DB persistence
- `src/lib/validation.js` - Form validation functions for submissions/auth forms
- `src/lib/theme.js` - Dark/light mode management
- `src/lib/chartTheme.js` - Shared chart styling: validated categorical palettes (light/dark), sequential coral ramp, ink/grid/tooltip helpers, `CHART_FONT`. All ECharts components build their options from these. Design tokens live as CSS variables in `src/app.css` (surfaces, inks, hairlines, accent, chart tokens) and map into Tailwind as `surface-*`/`ink-*`/`line-*`/`accent-*`; dark mode flips the tokens, so new components should not need `:global(.dark)` overrides. `--header-h` is a layout token: `Header.svelte` measures the real header bar and writes it to `:root`, and map-page overlays (FilterBar, Mapbox controls) offset from it rather than hardcoding a header height. Typography: Outfit Variable (display/headings) + Inter Variable (UI/body), self-hosted via `@fontsource-variable`.
- `src/lib/deviceDetection.js` - Responsive device type detection (mobile/tablet/desktop)
- `src/lib/supabaseBrowser.js` - Browser-side Supabase client using `@supabase/ssr` `createBrowserClient` with cookie support; exports `supabaseBrowser` client and `getAuthenticatedUser()` helper
- `src/lib/profiles.js` - Profiles CRUD: `getOwnProfile()`, `getProfileByUsername()`, `updateProfile()`, `uploadAvatar()`. Public reads use only safe columns (no email). Avatar uploads write to `avatars/<user_id>/avatar.{ext}` and bust browser cache via `?t=` query param.
- `src/lib/toastStore.js` - Tiny non-blocking notification store with `toast.success/error/info()` helpers. Rendered by `<ToastHost />` mounted once in `+layout.svelte`.

## Component Organization

### Main Components (src/components/)
- `Card.svelte` - Detailed popup card shown when clicking map markers
- `CollapsibleSection.svelte` - Reusable accordion/collapsible section
- `ContactInfo.svelte` - Displays contact links (phone, website, Instagram, Facebook)
- `DirectionsButton.svelte` - Opens Google Maps directions to an establishment
- `FavoriteButton.svelte` - Heart button for toggling favorites (requires auth)
- `FilterBar.svelte` - Search and filter controls: toggle chips with live city-composition counts (proteins, types, Open Now), dual-thumb spice range slider, and a removable active-filters chip row visible even when the panel is collapsed
- `Header.svelte` - Main application header; authenticated desktop nav consolidates account actions (Submit/Favorites/Profile/Sign Out) into a user dropdown menu
- `LoadingState.svelte` - Shared loading indicator (bobbing taco + pulsing dots + message), reduced-motion aware; used by Map, census, and compare
- `HoursInput.svelte` - Input component for hours data (used in submission form)
- `HoursOpen.svelte` - Week Rhythm strip: 7 day pills with mini open-span bars on a shared 24h scale, today ring, calm open/closed status dot; overnight hours wrap
- `IconHighlight.svelte` - Icon-based feature highlights
- `LocationPicker.svelte` - Map-based location selection component
- `MapStylePicker.svelte` - Switches between Mapbox map styles
- `MapLensPicker.svelte` - Map lens switcher (Spots / Heat / Salsas / Density) with inline legends; drives `mapLens` store. Data lenses exclude pending spots (no measurements) and closed spots (measurements are history). The density heatmap uses a deliberately wide `heatmap-radius` — Tucson's spots are sparse enough that the stock radius drew one blob per spot and nothing between them
- `MapLegend.svelte` - Small floating `● Vetted / ◌ Pending / ✕ Closed` legend; only shown in the Spots lens, each row only when such spots exist
- `NewSpotsBadge.svelte` - Badge showing count of recently added establishments (pending entries get a `◌ Pending` chip)
- `ClosedBanner.svelte` - Dashed grey banner (`✕ Permanently closed` + closure month) rendered at the top of any card for a closed spot. Closed spots also lose vibe voting, comparison, and directions, but keep hours/charts as a historical record
- `PendingSpotCard.svelte` - Lightweight preliminary card for pending (unvetted) spots: pending badge, info panel, scraped hours/contact if present, source link, vetting CTA. Dashed `--pending` border; no radar/heat/salsa/vibe/compare
- `RadarChart.svelte` - Menu/protein radar (ECharts) with a fixed 0–100 scale so shapes compare across spots; supports multi-series overlays via `seriesList` prop (categorical palette + legend), used by `/compare` and TasteProfile
- `SalsaCount.svelte` - Salsa count bullet bar (ECharts): value bar over city-max track with an average tick
- `SalsaLineup.svelte` - Per-salsa chip row: named varieties (Verde, Rojo, …) plus the spot's "other" house salsas with individual heat dots and tap-to-reveal descriptions. Data comes from `salsaVarieties`/`otherSalsas` on `processedTacoData`
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
- `ContextStrip.svelte` - City-distribution dot strip: every spot as a faint dot on a shared scale with this spot highlighted (used under the mobile Card's heat ladder).
- `EmptyState.svelte` - Shared empty state (emoji + headline + message + optional CTA); used by favorites, compare, and census.
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
- `src/routes/vote/new/+page.svelte` - Taco Summit creation: pick 2–6 spots, set a title, creates a `group_sessions` row and redirects to the voting page
- `src/routes/vote/[session_id]/+page.svelte` - Taco Summit voting/results page; states: ranked-choice ballot entry, post-vote waiting with live preview, locked results with `SummitResults`; uses Supabase Realtime for live vote counts and session lock detection; anonymous via `voter_token` UUID in localStorage; creator identified by `creator_token` in localStorage
- `src/routes/u/[username]/+page.svelte` + `+page.server.js` - Public profile page; server load looks up `profiles` by username (404 if not found); renders avatar, display name, username, bio, member-since. Recent check-ins section is a placeholder until Phase 3 ships.

#### Authentication Routes (`src/routes/(auth)/`)
- `login/+page.svelte` - Login form
- `signup/+page.svelte` - Registration form
- `auth/confirm/+page.svelte` - Email confirmation callback

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
- `src/lib/mapping.test.js` - Tests for map layer/GeoJSON helpers and coordinate validation
- `src/lib/authErrors.test.js` - Tests for auth error message mapping

Run all tests with `pnpm test`.

## Documentation

Detailed feature documentation in docs/:
- `DEPLOYMENT.md` - Branch flow, CI/CD, migrations, secrets, rollback (canonical workflow)
- `IMPROVEMENTS.md` - Roadmap and planned features
- `UI_REFRESH_PLAN.md` - UI & data-viz refresh plan (shipped, PR #46)
- `UNVETTED_SPOTS_PLAN.md` - Pending/unvetted spots plan (shipped in this repo; scraping pipeline lives in `cartoTacoMenuExtract`)
- `MARKER_CLUSTERING.md` - Clustering implementation
- `QUERY_OPTIMIZATION.md` - Database view implementation
- `SEARCH_FILTER.md` - Filter system details
- `USER_SUBMISSIONS.md` - Location submission feature
- `VISUALIZATION_IMPROVEMENTS.md` - Chart enhancements
