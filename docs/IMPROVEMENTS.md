# CartoTaco Improvement Roadmap

This document outlines potential improvements to enhance CartoTaco's functionality, performance, and user experience.

## ✅ Completed Improvements

1. **Query Optimization** - Reduced initial data fetch from 6 queries to 1 via database view (~60-70% faster load time)
2. **Search & Filter Bar** - Added comprehensive filtering by name, proteins, type, spice level, and open hours
3. **Marker Clustering** - Efficient clustering of map markers for scalability and clean visualization
4. **Mobile Responsive Design** - Comprehensive mobile-first responsive overhaul with optimized layouts for all screen sizes
5. **User Authentication System** - Complete auth flow with transparent login/signup UI and protected routes
6. **User Location Submissions** - Community-driven submission system with geocoding, interactive map picker, and admin review workflow
7. **Dark Mode** - Theme toggle with light/dark/auto modes and time-based automatic switching (6am-8pm light, else dark)
8. **User Favorites System** - Heart icon favorites with filtering, dedicated favorites page, and map integration
9. **Vercel Deployment** - Configured adapter-vercel with Node 20, SSR guards in stores
10. **Directions Deep-Link** - `DirectionsButton.svelte` detects iOS/Android/desktop and deep-links to Apple Maps, Google Maps intent, or Google Maps web respectively
11. **Onboarding Tour** - 7-step guided tour for first-time users with spotlight overlays, auto-start on first visit, and "?" help button to restart

See [QUERY_OPTIMIZATION.md](./QUERY_OPTIMIZATION.md), [SEARCH_FILTER.md](./SEARCH_FILTER.md), and [MARKER_CLUSTERING.md](./MARKER_CLUSTERING.md) for details.

---

## 🧹 Housekeeping & Maintenance

### ✅ Update README Documentation
**Status**: Completed (2026-02-11, commit 7a3824c)

### ✅ Fix Svelte Type Checking Warnings
**Status**: Completed (2026-02-11, commit 7a3824c)

### H1. Fix Inaccurate Dead-Code Comment in stores.js
**Status**: ✅ Completed — `combineArraysByEstId()` was removed entirely in the specialty data refactor

---

### H2. Remove Hardcoded Sample Specialty Data from stores.js
**Status**: ✅ Completed — `specialtiesBySite` removed; specialty data now embedded in `processedTacoData` via `sites_complete` view (`specialty_items`, `specialty_proteins`, `specialty_salsas` arrays)

---

### H3. Update CLAUDE.md Documentation
**Status**: ✅ Completed — Migration docs updated through 006; stale `specStore` and `specialtiesBySite` store references removed; `recentlyAddedSites` documented

---

### H4. Vercel Adapter Runtime Deprecation
**Status**: Noted

**Details**:
- `svelte.config.js` uses `runtime: 'nodejs20.x'` which is valid but deprecated
- In a future adapter-vercel release, this option will be removed in favor of Vercel project-level Node version config
- No immediate action needed, but should be tracked for when the adapter is updated

**Impact**: Future compatibility

**Effort**: Minimal (when needed)

---

## 🎯 Quick Wins (High Impact, Low Effort)

### 1. Database Query Optimization
**Current Issue**: 9 sequential Supabase queries on every page load

**Improvement**: Create a database view or stored procedure that joins all related tables (sites, descriptions, menu, hours, salsa, protein) into a single query

**Impact**: Reduce initial load time by ~60-70%

**Effort**: Moderate (1-2 days)

**Technical Details**:
- Create a PostgreSQL view or function in Supabase
- Combine sites, descriptions, menu, hours, salsa, and protein tables
- Single client query instead of 6+ separate calls
- Reduce network overhead and improve data consistency

---

### 2. Add Search & Filter Bar
**Feature**: Floating search bar on the map to filter by:
- Name
- Open now / Open at specific time
- Specific proteins (e.g., "show me fish tacos")
- Spice level range
- Has specialty items

**Impact**: Dramatically improves usability as you add more locations

**Effort**: Moderate (2-3 days)

**Technical Details**:
- Floating UI component over map (top center or top right)
- Filter derived store data before passing to map
- Update markers dynamically based on filters
- Add URL query params for shareable filtered views

---

## 🚀 User Engagement Features

### 3. User Accounts + Favorites System
**Features**:
- Simple email/password or social login via Supabase Auth
- Save favorite spots with a heart icon
- Personal "My Taco Map" view showing only favorites
- Export favorites as a list or route

**Impact**: Creates repeat users, builds loyalty

**Effort**: High (1 week)

**Technical Details**:
- Enable Supabase Auth (email, Google, etc.)
- Create `user_favorites` table: `user_id`, `est_id`, `created_at`
- Add authentication UI components
- Toggle favorite button in popup cards
- Filter map view by favorites
- Add user profile page

---

### 4. Community Ratings & Quick Reviews
**Features**:
- 5-star rating system per establishment
- Quick tags (e.g., "Best carnitas", "Great salsa bar", "Family friendly")
- Optional short text reviews
- Display average rating on map markers

**Impact**: Adds social proof and user-generated content

**Effort**: High (1 week)

**Technical Details**:
- Requires user authentication (build with #3)
- Create `ratings` table: `user_id`, `est_id`, `stars`, `review_text`, `tags`
- Create `tags` lookup table
- Calculate average rating in database view
- Display ratings in popup and on markers (colored star overlay)
- Moderation tools for inappropriate content

---

## 🎨 Visualization & Layout Enhancements

### 5. Heat Map View Toggle
**Feature**: Toggle between marker view and heat map showing:
- Concentration of taco spots
- Average spice level by area
- Price density (if you add pricing data)

**Impact**: Provides alternative way to discover dense taco areas

**Effort**: Moderate (3-4 days)

**Technical Details**:
- Use Mapbox GL heatmap layer (already included in library)
- Add toggle button in UI
- Create heatmap data source from location coordinates
- Option to color-code by spice level or other metrics
- Smooth transition between marker and heatmap views

---

### 6. Mobile-First Responsive Overhaul
**Current Issue**: Popup is 800px wide with fixed 40/60 split - awkward on mobile

**Improvements**:
- Full-screen bottom sheet on mobile instead of popup
- Swipeable carousel for specialty items
- Collapsible sections for charts
- "Get Directions" button integrated

**Impact**: Better mobile experience (likely 50%+ of users)

**Effort**: Moderate-High (4-5 days)

**Technical Details**:
- Media queries for mobile breakpoints
- Use bottom sheet component (or build custom)
- Integrate Mapbox Directions API or Google Maps deeplinks
- Touch-optimized controls
- Test on various device sizes
- Consider PWA features (add to home screen)

---

## ⚡ Performance Improvements

### 7. Marker Clustering
**Feature**: Group nearby markers when zoomed out, split when zoomed in

**Impact**: Critical once you have 50+ locations

**Effort**: Low (1 day)

**Technical Details**:
- Use mapbox-gl-cluster or supercluster library
- Configure cluster radius and zoom thresholds
- Style cluster markers with count badges
- Smooth zoom-in on cluster click
- Maintain performance with hundreds of markers

---

### 8. Lazy Load Popup Content
**Current**: All chart data loads on page load

**Improvement**: Only fetch detailed charts/specialties when user clicks a marker

**Impact**: Faster initial page load, lower memory footprint

**Effort**: Moderate (2-3 days)

**Technical Details**:
- Initial query fetches only basic location data (name, lat/lon, type)
- On marker click, fetch detailed data (menu, protein, salsa, specialties)
- Show loading spinner in popup while fetching
- Cache fetched data to avoid re-fetching
- Destroy chart instances when popup closes

---

### 11. User-Submitted Locations
**Feature**: Allow end-users to submit new taco locations to the database

**Status**: Design complete, ready for implementation

**Details**:
- Public submission form at dedicated `/submit` page
- Moderation queue (`location_submissions` table)
- Database-level review workflow (no admin UI initially)
- Email required for spam prevention
- Geocoding integration for address → lat/lon
- All fields needed to populate basic location on the map

**Impact**: Crowdsourced data growth, community engagement, reduced admin burden

**Effort**: Moderate-High (4-5 days)

**Documentation**: See [USER_SUBMISSIONS.md](./USER_SUBMISSIONS.md) for complete design specification

**Technical Details**:
- New table: `location_submissions` with pending/approved/rejected status
- New route: `src/routes/submit/+page.svelte` with full form
- Geocoding helper using Mapbox Geocoding API
- Form captures: name, type, address, contact info, hours, descriptions
- Manual approval: review in Supabase, copy to `sites`/`descriptions`/`hours` tables
- Future: admin dashboard, email notifications, duplicate detection

---

## 🎁 Unique Feature Ideas

### 9. "Taco Trail" Route Builder
**Feature**: Let users select multiple spots and generate an optimized route

**Details**:
- Multi-select mode for markers
- Use Mapbox Directions API for routing
- "Taco crawl" mode for planning group outings
- Share route with friends

**Impact**: High engagement, shareable feature

**Effort**: High (1 week)

**Technical Details**:
- Multi-select UI mode (checkbox markers)
- Integrate Mapbox Directions API
- Route optimization (shortest path, custom waypoint order)
- Display route on map with turn-by-turn
- Generate shareable link with selected spots
- Optional: time estimates and schedule planning

---

### 10. Weekly Spotlight & Discovery Mode
**Feature**:
- Highlight a different spot each week
- "Surprise Me" button that picks a random spot matching filters
- "Off the Beaten Path" tag for lesser-known gems

**Impact**: Encourages exploration, easy content curation

**Effort**: Low-Moderate (2-3 days)

**Technical Details**:
- Admin interface to set featured spot
- Store `featured_spot_id` and `featured_date` in config table
- Random selection algorithm (weighted by ratings if available)
- "Hidden gem" tag based on visit counts or ratings
- Animated pulse on featured marker
- Social media integration for sharing weekly spotlight

---

### 11. AI-Powered Menu Data Extraction
**Feature**: Automatically extract menu information from uploaded photos using AI vision models

**Details**:
- Allow users to upload menu photos when submitting new locations
- Use AI API (GPT-4 Vision, Claude Vision, or similar) to extract:
  - Menu items and descriptions
  - Prices
  - Protein types (chicken, beef, pork, fish, vegetarian)
  - Salsa varieties and heat levels
  - Special items or house specialties
- Auto-populate submission form fields with extracted data
- User can review and edit AI-extracted information before submitting
- Reduces friction in submission process and improves data completeness

**Impact**:
- Dramatically reduces time/effort for user submissions
- Increases data quality and completeness
- Makes it easier for users to contribute comprehensive information
- Could become a unique selling point for the platform

**Effort**: High (2-3 weeks)

**Technical Details**:
- Image upload component with preview
- Integration with AI vision API (OpenAI GPT-4V, Anthropic Claude, or Google Gemini)
- Prompt engineering to extract structured data from menu photos
- JSON schema for standardized menu data extraction
- Confidence scoring for extracted data
- User interface for reviewing and correcting AI extractions
- Cost considerations (API usage fees per extraction)
- Image storage (Supabase Storage or S3)
- Rate limiting and queue system for batch processing
- Fallback to manual entry if AI extraction fails

**Future Enhancements**:
- OCR pre-processing for better accuracy
- Multi-photo support (full menu across multiple images)
- Training custom model on taco menu dataset
- Batch processing for admin to backfill existing locations
- Community validation of AI-extracted data

---

---

## 🎮 Social & Gamification

### G1. Taco Passport + Check-Ins
**Feature**:
- Users "check in" at spots they've visited (requires auth)
- Virtual passport that stamps each unique spot visited
- Badges/achievements: "Al Pastor Pilgrim" (5 spots), "Taco Conquistador" (all spots), "Heat Seeker" (all 10-spice spots), "Carnivore" (tried all protein types)
- Check-in count displayed on spot cards ("27 tacoheads have been here")

**Impact**: Major retention and engagement driver; makes CartoTaco genuinely memorable vs. just a directory

**Effort**: High (1 week)

**Technical Details**:
- New `check_ins` table: `user_id`, `est_id`, `checked_in_at`
- Aggregate check-in counts in view or cached summary
- Badges computed server-side or derived from check-in history
- Passport page showing user's visited spots on a mini-map
- Push notifications when a new spot opens near a frequently visited area

---

### G2. Personal Taco Stats Page
**Feature**:
- User profile page with stats: spots visited, proteins tried, favorite neighborhood, hottest spot tried
- "Your taco journey" — timeline of check-ins
- Comparison mode: "You vs. the average CartoTaco user"

**Impact**: High engagement, encourages sharing

**Effort**: Moderate (3-4 days, builds on G1)

**Technical Details**:
- Derived from check-in history in G1
- Stats page at `/profile` or as a modal
- Shareable stats card (see G3)

---

## 🔍 Discovery

### D1. "Surprise Me" Button
**Feature**: One-tap random spot selection that respects active filters. Prominent button in the filter bar or map overlay. Flies the map to the selected spot and opens its card.

**Impact**: Low-effort engagement feature, great for indecisive users

**Effort**: Low (half a day)

**Technical Details**:
- Pick random item from `filteredTacoData`
- Set `selectedSite` and fly map camera to coordinates
- Button lives in `FilterBar.svelte` or as a floating map control

---

### D2. Neighborhood Mode
**Feature**: Color-code map markers by Tucson neighborhood (South Tucson, Barrio Viejo, Midtown, East Side, etc.). Add a neighborhood filter dropdown. Show a neighborhood summary panel.

**Impact**: Hyper-local and very Tucson-specific — differentiates from generic map apps

**Effort**: Moderate (2-3 days)

**Technical Details**:
- Add `neighborhood` field to `sites` table
- Populate via admin or geocoding reverse lookup
- Color-code `unclustered-point` layer by neighborhood
- Neighborhood filter in `FilterBar.svelte`

---

### D3. Spot Comparison Mode
**Feature**: Select 2-3 spots and compare them side-by-side in a dedicated comparison view.

**Details**:
- "Compare" button in spot cards adds a site to the comparison tray
- Comparison tray (fixed bottom bar) shows selected spots with a "Compare Now" CTA
- Comparison view displays sites in columns with synchronized rows:
  - Radar charts (menu distribution) side-by-side
  - Protein offerings with style breakdowns
  - Spice level gauges
  - Salsa counts
  - Hours of operation
  - Establishment type
  - Specialty items
- Highlight "winner" per category (e.g., most salsas, hottest spice)
- Shareable comparison URL (e.g., `?compare=1,3,7`)
- Mobile: swipeable columns or stacked vertical cards

**Impact**: Helps users decide between similar spots; increases time-on-site and engagement

**Effort**: Moderate-High (3-5 days)

**Technical Details**:
- New `comparisonStore.js`: `comparisonSites` (array, max 3), `comparisonActive`, `addToComparison()`, `removeFromComparison()`, `clearComparison()`
- New `ComparisonTray.svelte`: fixed bottom bar showing selected spots (like TrailTray pattern)
- New `ComparisonView.svelte`: side-by-side layout with shared row structure
- "Add to Compare" button in `Card.svelte`
- URL param reconstruction on mount (like trail URL sharing)
- Reuse existing visualization components (RadarChart, SpiceGauge, SalsaCount)

---

### D4. Personal Taste Profile
**Feature**: Build a personalized flavor profile for each user based on their favorites and browsing patterns, then surface tailored recommendations.

**Details**:
- Analyze user's favorited spots to compute preference scores:
  - Preferred proteins (e.g., 60% chicken, 25% beef, 15% fish)
  - Spice tolerance (average heat level of favorites)
  - Preferred establishment types (truck vs. brick-and-mortar)
  - Salsa variety preference (avg salsa count of favorites)
- "Your Taste Profile" page/modal showing:
  - Radar chart of protein preferences
  - Spice tolerance gauge
  - "Your Type" badge (e.g., "Heat Seeker", "Salsa Explorer", "Chicken Champion")
  - Top recommended spots you haven't favorited yet
- Recommendations engine: score all spots against user's taste profile, surface top matches
- Optional: explicit taste quiz as onboarding (fallback when no favorites exist)

**Impact**: Highly personalized experience; drives exploration of new spots; increases favorites/engagement

**Effort**: Moderate (3-4 days)

**Technical Details**:
- New `tasteProfileStore.js`: derived from `favoriteIds` + `processedTacoData`
  - Computes protein affinity scores, avg spice preference, type preferences
  - Generates personality label from dominant traits
  - Scores non-favorited spots for recommendations
- New `TasteProfile.svelte`: profile visualization (radar chart, gauge, badge, recommendation list)
- Accessible from user profile page or dedicated `/taste` route
- No new DB tables needed — fully derived from existing favorites + site data
- Archetype labels: "Heat Seeker" (high spice avg), "Salsa Explorer" (high salsa avg), "The Purist" (one dominant protein), "Adventurer" (diverse proteins), etc.
- Recommendation scoring: weighted cosine similarity between user profile vector and site attribute vector

---

### D5. Similar Spots Recommendations
**Feature**: In the spot card, show 2-3 "You might also like" recommendations based on shared attributes (same protein focus, same type, similar spice level).

**Impact**: Increases time-on-site, drives discovery of lesser-known spots

**Effort**: Moderate (2-3 days)

**Technical Details**:
- Scoring function: weight by shared top protein, establishment type, spice level proximity
- Compute in `processedTacoData` or as a derived store
- Display as small clickable chips in `Card.svelte`

---

## 📢 Sharing & Utility

### S1. Share Card Generator
**Feature**: Generate a beautiful shareable image card for a spot — spot name, type badge, spice level, top protein. "I found my new favorite taco spot on CartoTaco 🌮" social media bait.

**Impact**: Organic growth through social sharing

**Effort**: Moderate (2-3 days)

**Technical Details**:
- Use `html2canvas` or `satori` to render a styled card to PNG
- Download or share via Web Share API on mobile
- Canonical shareable URL per spot (e.g., `/spot/[est_id]`) for link previews

---

### S2. Taco Tuesday Tracker
**Feature**: Tag which spots have Taco Tuesday deals. Dedicated "Taco Tuesday" filter toggle in `FilterBar.svelte`. Could expand to other recurring specials.

**Impact**: High weekly recurring engagement — users check every Tuesday

**Effort**: Low (1 day + data entry)

**Technical Details**:
- Add `taco_tuesday` boolean field to `sites` table
- Filter toggle in `FilterBar.svelte`
- Special "TT" badge on markers for participating spots

---

## 🏪 Owner & Data Features

### O1. Owner Portal
**Feature**: Let business owners claim their listing and update hours, menu highlights, and contact info. Admin approves claims.

**Impact**: Removes data maintenance burden from admin; builds goodwill with establishments

**Effort**: High (1-2 weeks)

**Technical Details**:
- `site_claims` table: `user_id`, `est_id`, `status` (pending/approved/rejected)
- Claimed owners get write access to their own site rows via RLS
- Admin approval flow (Supabase dashboard or simple admin route)
- Claim button on spot cards for logged-in users

---

## 📊 Data & Visualization

### V1. Tucson Taco Census Page
**Feature**: A public stats page at `/census` showing aggregate data: total spots on the map, most popular protein city-wide, average spice level, newest additions this month, neighborhood with most spots, etc.

**Impact**: Press-worthy, shareable, positions CartoTaco as the authority on Tucson tacos. Zero new data needed — all derived from existing DB.

**Effort**: Low-Moderate (1-2 days)

**Technical Details**:
- New route `/census`
- Query `processedTacoData` aggregates client-side, or create a Supabase view/function for server-side stats
- Charts using ECharts (already a dependency)
- "Share the Census" button linking to the page

---

### V2. Price Tier Filter ($-$$$)
**Feature**: Add affordability data to spots. New filter in `FilterBar.svelte` for price range.

**Impact**: Hugely practical — one of the most common restaurant discovery criteria

**Effort**: Low-Moderate (1-2 days + data entry)

**Technical Details**:
- Add `price_tier` field (1-3 or $ / $$ / $$$) to `sites` table
- Migration to add column
- Price filter in `FilterBar.svelte`
- Price badge in `Card.svelte` header

---

## 📊 Recommended Priority Order

1. ✅ **Query optimization (#1)** - **COMPLETED**
2. ✅ **Search & filter (#2)** - **COMPLETED**
3. ✅ **Marker clustering (#7)** - **COMPLETED**
4. ✅ **Mobile responsive (#6)** - **COMPLETED**
5. ✅ **User authentication (#3 partial)** - **COMPLETED**
6. ✅ **User-submitted locations (#11)** - **COMPLETED**
7. ✅ **Dark mode** - **COMPLETED**
8. ✅ **User favorites (#3 partial)** - **COMPLETED**
9. ✅ **Vercel deployment** - **COMPLETED**
10. ✅ **Housekeeping (H1-H3)** - **COMPLETED** (all cleaned up in refactors)
11. ✅ **Directions deep-link** - **COMPLETED** (DirectionsButton.svelte)
12. ✅ **Onboarding Tour** - **COMPLETED** (TourOverlay.svelte, tourStore.js)
13. **Spot Comparison Mode (D3)** - Side-by-side spot comparison
14. **Personal Taste Profile (D4)** - Personalized recommendations from favorites
15. **"Surprise Me" button (D1)** - Quick win, fun UX
16. **Taco Tuesday Tracker (S2)** - Weekly engagement, low effort
17. **Tucson Taco Census page (V1)** - Press-worthy, no new data needed
18. **Community ratings & reviews (#4)** - Add social proof
19. **Taco Passport + Check-ins (G1)** - Big engagement feature
20. **Personal Taco Stats (G2)** - Builds on G1
21. **Price Tier filter (V2)** - Practical, needs data entry
22. **Similar Spots (D5)** - Discovery improvement
23. **Neighborhood Mode (D2)** - Hyper-local differentiation
24. **Share Card generator (S1)** - Organic growth
25. **Heat map view (#5)** - Alternative visualization
26. **Lazy load popup content (#8)** - Performance improvement
27. **Taco trail builder (#9)** - Unique differentiator
28. **Owner Portal (O1)** - Long-term data sustainability

---

## Additional Future Considerations

### Data Enhancements
- Add pricing information ($ to $$$$)
- Add photos (user-generated and official)
- Add delivery/takeout availability
- Add parking information
- Add accessibility features

### Operational Features
- Admin dashboard for managing locations
- Bulk import tool for adding locations
- Change tracking (when did hours/menu last update?)
- Notifications for new spots in user's area

### Analytics
- Track popular spots (view counts)
- User engagement metrics
- Search analytics to understand user intent

---

**Last Updated**: 2026-03-09
