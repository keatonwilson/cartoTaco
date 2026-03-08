# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CartoTaco is an interactive map-based application for exploring taco establishments in Tucson, AZ. Built with SvelteKit, it features an optimized architecture that fetches all site data in a single database query using a Supabase view. The app supports user authentication, favorites, trail building (multi-stop route planning), location submissions, and theme switching.

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
- `summaries` - Legacy table (no longer used; summary stats are computed client-side from `processedTacoData`)

### Running Migrations
Migrations must be run in this order:
1. `migrations/002_add_contact_and_social_fields.sql` - Adds contact/social fields
2. `migrations/001_create_sites_view.sql` - Creates the `sites_complete` view
3. `migrations/003_create_profiles_table.sql` - Creates user profiles table with RLS policies (requires Supabase Auth)
4. `migrations/004_create_location_submissions.sql` - Creates location_submissions table for user submissions with RLS policies
5. `migrations/005_create_favorites_table.sql` - Creates user_favorites table with RLS policies
6. `migrations/006_enable_rls_public_tables.sql` - Enables RLS on public data tables (sites, descriptions, menu, hours, salsa, protein, summaries, specs) with read-only access policies
7. `migrations/007_add_created_at_to_sites.sql` - Adds created_at timestamp to sites table
8. `migrations/008_update_sites_complete_view.sql` - Updates view to include created_at field
9. `migrations/009_add_spec_fk_columns.sql` - Adds foreign key columns for specialty items
10. `migrations/010_update_sites_complete_view.sql` - Updates view again (spec-related)
11. `migrations/011_remove_spec_text_cols_from_view.sql` - Removes text columns, keeps FK references
12. `migrations/012_drop_specialty_item_id_4.sql` - Removes specific specialty item record
13. `migrations/013_add_burro_perc_to_view.sql` - Adds missing burro_perc to view (fixes burritos not showing in radar chart)
14. `migrations/014_add_foreign_key_constraints.sql` - Adds FK constraints on est_id for child tables (run orphan checks first)
15. `migrations/015_add_est_id_indexes.sql` - Adds indexes on est_id join columns and spec FK columns
16. `migrations/016_view_naming_cleanup.sql` - Aliases burro→burrito in view, removes unused site fields (contact, lat_2, lon_2, days_loc_2)
17. `migrations/017_drop_legacy_spec_text_columns.sql` - Drops legacy text columns (specialty_item_N, protein_spec_N, salsa_spec_N) replaced by FK columns
18. `migrations/018_rename_spec_fk_columns.sql` - Renames spec FK columns to consistent spec_id_N pattern, rebuilds view

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
- `processedTacoData` - Transforms raw site data into component-ready format with pre-computed values (top 5 menu items, proteins, percentages, and specialty items embedded from view)
- `filteredTacoData` - Filters `processedTacoData` based on `filterConfig` (search, protein type, establishment type, spice level, open hours, favorites)
- `summaryStats` - Computed from `processedTacoData` `{ maxSalsaNum, avgSalsaNum, maxHeatLevel, avgHeatLevel }`
- `recentlyAddedSites` - Spots added in the last 30 days, sorted newest first (used by NewSpotsBadge)

### UI State Stores
- `selectedSite` - Currently selected establishment (for popup)
- `filterConfig` - User's active filters: `{ searchText, proteins, types, spiceLevel, openNow, showFavoritesOnly }`

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

### Trail Store (src/lib/trailStore.js)
- `trailModeActive` - Whether trail building mode is active
- `trailStops` - Ordered array of trail stop site objects
- `trailTransportMode` - `'walking'` | `'driving'` for routing
- `trailRoute` - GeoJSON LineString from Mapbox Directions API
- `trailStopCount` (derived)
- Functions: `enterTrailMode()`, `exitTrailMode()`, `addStop(site)`, `addLocationStop(site, position)`, `removeStop(estId)`, `moveStop(fromIndex, toIndex)`, `clearStops()`, `fetchRoute(stops, mode)`

### New Spots Store (src/lib/newSpotsStore.js)
- `lastSeenNewSpotsTime` - Last time user viewed new spots (persisted in localStorage)
- `unseenNewSpotsCount` (derived) - Count of spots added since last view
- Functions: `markNewSpotsAsSeen()`

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
4. `unclustered-point-label` - Site name labels
5. `trail-stop-circles` - Numbered orange circles for trail stops
6. `trail-stop-numbers` - Stop number labels (1, 2, 3…)
7. `trail-route-line` - Dashed route line connecting trail stops

### Key Functions
- `updateMarkers(processedSites, map)` - Add/update clusters and markers, attach event listeners
- `resetListeners(map)` - Clean up all event handlers
- `sitesToGeoJSON(processedSites)` - Convert sites to GeoJSON with embedded properties
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

## Supporting Utilities

- `src/lib/auth.js` - Additional Supabase auth utilities
- `src/lib/favorites.js` - Favorites database operations (add, remove, fetch)
- `src/lib/submissions.js` - Location submission handling and DB persistence
- `src/lib/validation.js` - Form validation functions for submissions/auth forms
- `src/lib/theme.js` - Dark/light mode management
- `src/lib/deviceDetection.js` - Responsive device type detection (mobile/tablet/desktop)

## Component Organization

### Main Components (src/components/)
- `Card.svelte` - Detailed popup card shown when clicking map markers
- `CollapsibleSection.svelte` - Reusable accordion/collapsible section
- `ContactInfo.svelte` - Displays contact links (phone, website, Instagram, Facebook)
- `DirectionsButton.svelte` - Opens Google Maps directions to an establishment
- `FavoriteButton.svelte` - Heart button for toggling favorites (requires auth)
- `FilterBar.svelte` - Search and filter controls
- `Header.svelte` - Main application header with auth state and navigation
- `HoursInput.svelte` - Input component for hours data (used in submission form)
- `HoursOpen.svelte` - Operating hours display
- `IconHighlight.svelte` - Icon-based feature highlights
- `LocationPicker.svelte` - Map-based location selection component
- `MapStylePicker.svelte` - Switches between Mapbox map styles
- `NewSpotsBadge.svelte` - Badge showing count of recently added establishments
- `RadarChart.svelte` - Visualizes menu and protein distributions using ECharts
- `SalsaCount.svelte` - Salsa variety count with context
- `SpecCarousel.svelte` & `SpecCard.svelte` - Specialty item displays
- `SpiceGauge.svelte` - Heat level visualization
- `ThemeToggle.svelte` - Dark/light mode toggle button
- `TrailTray.svelte` - Taco trail builder interface (stop list, reordering, transport mode, route display)

### Routes
- `src/routes/+layout.svelte` - Root layout (Header, theme initialization)
- `src/routes/+layout.js` - Root layout loader
- `src/routes/+page.svelte` - Main page (renders Map component)
- `src/routes/+page.js` - Route config (prerendering disabled; app requires Supabase at runtime)
- `src/routes/Map.svelte` - Map component with filter integration and trail mode support

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

Run all tests with `pnpm test`.

## Documentation

Detailed feature documentation in docs/:
- `IMPROVEMENTS.md` - Roadmap and planned features
- `MARKER_CLUSTERING.md` - Clustering implementation
- `QUERY_OPTIMIZATION.md` - Database view implementation
- `SEARCH_FILTER.md` - Filter system details
- `USER_SUBMISSIONS.md` - Location submission feature
- `VISUALIZATION_IMPROVEMENTS.md` - Chart enhancements
