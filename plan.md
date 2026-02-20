# Implementation Plan: Lazy Load Popup + Recently Added Notification

## Feature 1: Lazy Load Popup Content

### Problem
Currently, all site data (menu distributions, protein charts, specialties, salsa details) is fetched upfront on page load via `initializeStores()` in `+layout.svelte`. This means we fetch full detail data for every establishment even though users only click on a handful.

### Approach
Split data into two tiers:
- **Tier 1 (eager)**: Basic data needed for map markers and filtering — name, type, coordinates, descriptions, hours, protein yes/no flags, spice level. This is already what `sites_complete` provides, so we keep this.
- **Tier 2 (lazy)**: Chart/visualization data only needed when the popup opens — specialty items (item_spec, protein_spec, salsa_spec). Currently fetched via `fetchSpecialtyData()` on page load.

### Changes

1. **`src/lib/stores.js`** — Remove `fetchSpecialtyData()` from `initializeStores()`. Add a new `fetchSiteSpecialties(estId)` function that fetches specialties for a single site on demand. Add a cache (`siteSpecialtyCache`) so we don't re-fetch.

2. **`src/components/Card.svelte`** — When `$selectedSite` changes, call `fetchSiteSpecialties(estId)` for the selected site. Show a small loading spinner in the specialties section while fetching. Use cached data if available.

3. **`src/lib/stores.js`** — Keep `specStore` and `specialtiesBySite` working, but populate them lazily per-site rather than all-at-once. Add a `siteSpecLoading` writable store to track per-site loading state.

### Data flow after change
```
App init → fetchSiteData() + fetchSummaryData() (no specialty fetch)
User clicks marker → selectedSite set → Card.svelte renders
  → fetchSiteSpecialties(estId) called
  → Specialties section shows spinner
  → Data arrives → specialtiesBySite updates → spinner replaced with content
  → Data cached for subsequent views
```

---

## Feature 2: Recently Added Establishments Notification

### Problem
When new taco spots are added, users have no way to discover them. We need a notification bell/badge in the header that shows recently added establishments.

### Approach
- Add a `created_at` timestamp column to the `sites` table (via migration) so we can track when establishments were added
- Include `created_at` in the `sites_complete` view so it flows through to the frontend
- Create a derived store (`recentlyAddedSites`) that filters for sites added in the last 30 days
- Build a `NewSpotsBadge.svelte` component for the header — a bell icon with a count badge that opens a dropdown panel listing the new spots
- Clicking a spot in the dropdown flies the map to that location and opens its popup
- Track "seen" state in localStorage so the badge count only shows genuinely unseen spots

### Changes

1. **`migrations/007_add_created_at_to_sites.sql`** — New migration:
   - Add `created_at TIMESTAMPTZ DEFAULT now()` to `sites` table
   - Backfill existing rows with a reasonable default (e.g. `'2025-01-01'`)

2. **`migrations/008_update_sites_complete_view.sql`** — Update the `sites_complete` view to include `s.created_at` in the `site` JSONB object.

3. **`src/lib/stores.js`** — Add a `recentlyAddedSites` derived store from `processedTacoData` that filters for sites where `created_at` is within the last 30 days, sorted newest first.

4. **`src/lib/newSpotsStore.js`** — New file for managing "seen" state:
   - `lastSeenTimestamp` — persisted in localStorage
   - `unseenCount` — derived from `recentlyAddedSites` vs `lastSeenTimestamp`
   - `markAsSeen()` — updates timestamp to now

5. **`src/components/NewSpotsBadge.svelte`** — New component:
   - Bell icon with count badge (orange dot with number)
   - Click opens a dropdown panel listing recently added spots (name, type, date added)
   - Each entry is clickable — flies map to location and opens popup
   - "Mark all as seen" action
   - Responsive: dropdown on desktop, full-width panel on mobile

6. **`src/components/Header.svelte`** — Add `NewSpotsBadge` to the desktop nav and mobile menu.

7. **`src/lib/mapping.js`** — Export a `flyToSite(map, site)` helper that centers the map on a site and opens its popup programmatically.

8. **`src/routes/Map.svelte`** — Expose the map instance so `flyToSite` can be called from the notification dropdown. Use a store or context to share the map reference.

### Data flow
```
App init → fetchSiteData() → processedTacoData includes created_at
  → recentlyAddedSites derived store filters last 30 days
  → newSpotsStore compares against localStorage lastSeenTimestamp
  → Header shows badge with unseen count
User clicks badge → dropdown shows recent spots
User clicks a spot → map flies to location, popup opens
User clicks "Mark as seen" → badge clears
```

---

## File Change Summary

| File | Action | Feature |
|------|--------|---------|
| `src/lib/stores.js` | Edit: lazy specialty fetch, add recentlyAddedSites | Both |
| `src/components/Card.svelte` | Edit: lazy load specialties with spinner | Lazy Load |
| `migrations/007_add_created_at_to_sites.sql` | New | Recently Added |
| `migrations/008_update_sites_complete_view.sql` | New | Recently Added |
| `src/lib/newSpotsStore.js` | New | Recently Added |
| `src/components/NewSpotsBadge.svelte` | New | Recently Added |
| `src/components/Header.svelte` | Edit: add NewSpotsBadge | Recently Added |
| `src/lib/mapping.js` | Edit: export flyToSite helper | Recently Added |
| `src/routes/Map.svelte` | Edit: expose map ref via store | Recently Added |
