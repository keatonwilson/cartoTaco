# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CartoTaco is an interactive map-based application for exploring taco establishments in Tucson, AZ. Built with SvelteKit, it features an optimized architecture that fetches all site data in a single database query using a Supabase view.

## Development Commands

- `pnpm install` - Install dependencies (use pnpm, not npm)
- `pnpm dev` - Start development server at http://localhost:5173
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Run Svelte type checking
- `pnpm check:watch` - Run type checking in watch mode

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
- `summaries` - Aggregated statistics (max/avg salsa count, heat levels)
- `item_spec`, `protein_spec`, `salsa_spec` - Specialty item information

### Running Migrations
Migrations must be run in this order:
1. `migrations/002_add_contact_and_social_fields.sql` - Adds contact/social fields
2. `migrations/001_create_sites_view.sql` - Creates the `sites_complete` view
3. `migrations/003_create_profiles_table.sql` - Creates user profiles table with RLS policies (requires Supabase Auth)
4. `migrations/004_create_location_submissions.sql` - Creates location_submissions table for user submissions with RLS policies
5. `migrations/005_create_favorites_table.sql` - Creates user_favorites table with RLS policies

## State Management Architecture

The app uses Svelte stores (src/lib/stores.js) for centralized state:

### Core Data Stores
- `tacoStore` - Main site data from `sites_complete` view
- `summaryStore` - Summary statistics
- `specStore` - Specialty items (combined from three tables)

### Derived Stores
- `processedTacoData` - Transforms raw site data into component-ready format with pre-computed values (top 5 menu items, proteins, percentages)
- `filteredTacoData` - Filters `processedTacoData` based on `filterConfig` (search, protein type, establishment type, spice level, open hours)
- `summaryStats` - Processes summary data for context (max/avg values)
- `specialtiesBySite` - Maps specialty items to establishment IDs

### UI State Stores
- `selectedSite` - Currently selected establishment (for popup)
- `filterConfig` - User's active filters and search terms

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
3. `unclustered-point` - Individual site markers
4. `unclustered-point-label` - Site name labels

### Interaction
- Click cluster: Zoom to expansion zoom level
- Click unclustered point: Show popup with `Card.svelte` component and update `selectedSite` store
- Markers update reactively via `updateMarkers()` when `filteredTacoData` changes

## Data Processing Utilities

Located in src/lib/dataWrangling.js:

- `filterObjectByKeySubstring(obj, substring)` - Extract object entries matching key pattern (e.g., "_perc" fields)
- `getTopFive(arr)` - Sort and return top 5 items, stripping '_perc' suffix from keys
- `percentageOfMaxArray(arr)` - Convert array values to percentages of max
- `convertHoursData(startTimes, endTimes)` - Transform hours data into component-ready format

## Component Organization

### Main Components (src/components/)
- `Card.svelte` - Detailed popup card shown when clicking map markers
- `FilterBar.svelte` - Search and filter controls
- `RadarChart.svelte` - Visualizes menu and protein distributions using ECharts
- `ContactInfo.svelte` - Displays contact links (phone, website, Instagram, Facebook)
- `HoursOpen.svelte` - Operating hours display
- `SalsaCount.svelte` - Salsa variety count with context
- `SpiceGauge.svelte` - Heat level visualization
- `SpecCarousel.svelte` & `SpecCard.svelte` - Specialty item displays
- `IconHighlight.svelte` - Icon-based feature highlights

### Routes
- `src/routes/+page.svelte` - Main page (renders Map component)
- `src/routes/Map.svelte` - Map component with filter integration
- `src/routes/+page.js` - Enables prerendering

## Filter System

The filter system works through reactive updates:

1. User interacts with `FilterBar.svelte` → Updates `filterConfig` store
2. `filteredTacoData` derived store automatically recomputes filtered sites
3. `Map.svelte` receives updated filtered data and calls `updateMarkers()`
4. Map updates clustering and markers reactively

### Filter Types
- Text search (name matching)
- Protein types (chicken, beef, pork, fish, veg)
- Establishment types (Brick and Mortar, Stand, Truck)
- Spice level range (0-10)
- Open now (based on current time/day)

## Performance Considerations

- Single database query using `sites_complete` view instead of multiple joins
- Pre-computation of derived values in `processedTacoData` store
- Mapbox clustering for efficient rendering of many markers
- Static prerendering enabled for faster initial load

## Documentation

Detailed feature documentation in docs/:
- `IMPROVEMENTS.md` - Roadmap and planned features
- `QUERY_OPTIMIZATION.md` - Database view implementation
- `SEARCH_FILTER.md` - Filter system details
- `MARKER_CLUSTERING.md` - Clustering implementation
- `VISUALIZATION_IMPROVEMENTS.md` - Chart enhancements
