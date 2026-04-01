# CartoTaco Improvement Roadmap

This document outlines potential improvements to enhance CartoTaco's functionality, performance, and user experience.

## ✅ Completed Improvements

1. **Query Optimization** - Reduced initial data fetch from 6 queries to 1 via database view (~60-70% faster load time)
2. **Search & Filter Bar** - Added comprehensive filtering by name, proteins, type, spice level, and open hours
3. **Marker Clustering** - Efficient clustering of map markers for scalability and clean visualization
4. **Mobile Responsive Design** - Comprehensive mobile-first responsive overhaul with bottom sheet cards, swipe gestures, and optimized layouts for all screen sizes
5. **User Authentication System** - Complete auth flow with transparent login/signup UI and protected routes
6. **User Location Submissions** - Community-driven submission system with geocoding, interactive map picker, and admin review workflow
7. **Dark Mode** - Theme toggle with light/dark/auto modes and time-based automatic switching (6am-8pm light, else dark)
8. **User Favorites System** - Heart icon favorites with filtering, dedicated favorites page, and map integration
9. **Vercel Deployment** - Configured adapter-vercel with Node 20, SSR guards in stores
10. **Directions Deep-Link** - `DirectionsButton.svelte` detects iOS/Android/desktop and deep-links to Apple Maps, Google Maps intent, or Google Maps web respectively
11. **Taco Trail Route Builder** - Multi-stop route planning with walking/driving directions via Mapbox Directions API, stop reordering, and trail visualization on map
12. **Spot Comparison Mode** - Compare up to 3 establishments side-by-side at `/compare` with shareable URLs (`?ids=1,2,3`), winner highlighting across metrics, and mobile carousel view
13. **Taste Profile & Personalization** - k-NN based taste profile derived from favorites with 13 archetypes (Heat Seeker, Salsa Explorer, The Purist, etc.), scatter plot visualization, protein affinities, and recommendation engine
14. **Onboarding Tour System** - 7-step guided tour with targeted tooltips, localStorage persistence, and restartable from help button
15. **New Spots Badge** - Notification badge for recently added establishments with localStorage-based "seen" tracking and map fly-to on click
16. **Bottom Sheet Mobile UX** - Mobile-optimized card display with bottom sheet pattern, swipe-to-dismiss, and iOS Safari compatibility fixes

See [QUERY_OPTIMIZATION.md](./QUERY_OPTIMIZATION.md), [SEARCH_FILTER.md](./SEARCH_FILTER.md), [MARKER_CLUSTERING.md](./MARKER_CLUSTERING.md), and [USER_SUBMISSIONS.md](./USER_SUBMISSIONS.md) for details.

---

## 🧹 Housekeeping & Maintenance

### ✅ Update README Documentation
**Status**: Completed (2026-02-11, commit 7a3824c)

### ✅ Fix Svelte Type Checking Warnings
**Status**: Completed (2026-02-11, commit 7a3824c)

### ✅ H1. Fix Inaccurate Dead-Code Comment in stores.js
**Status**: Completed — `combineArraysByEstId()` was removed entirely in the specialty data refactor

### ✅ H2. Remove Hardcoded Sample Specialty Data from stores.js
**Status**: Completed — `specialtiesBySite` removed; specialty data now embedded in `processedTacoData` via `sites_complete` view

### ✅ H3. Update CLAUDE.md Documentation
**Status**: Completed — Migration docs updated through 020; stale store references removed; all new features documented

### H4. Vercel Adapter Runtime Deprecation
**Status**: Noted

**Details**:
- `svelte.config.js` uses `runtime: 'nodejs20.x'` which is valid but deprecated
- In a future adapter-vercel release, this option will be removed in favor of Vercel project-level Node version config
- No immediate action needed, but should be tracked for when the adapter is updated

**Impact**: Future compatibility | **Effort**: Minimal (when needed)

---

## 🎯 Quick Wins (High Impact, Low Effort)

### D1. "Surprise Me" Button ✅
**Status**: Completed (2026-04-01)

**Feature**: One-tap random spot selection that respects active filters. Button in the filter bar flies the map to the selected spot and opens its card.

**Technical Details**:
- Picks random item from `$filteredTacoData` (respects all active filters)
- Calls `flyToSite(map, site)` from `mapping.js` — handles mobile/desktop behavior automatically
- Button disabled when no filtered results are available
- Label hidden on small screens (emoji only)

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

## 🚀 User Engagement Features

### 4. Community Ratings & Quick Reviews
**Features**:
- 5-star rating system per establishment
- Quick tags (e.g., "Best carnitas", "Great salsa bar", "Family friendly")
- Optional short text reviews
- Display average rating on map markers

**Impact**: Adds social proof and user-generated content

**Effort**: High (1 week)

**Technical Details**:
- Requires user authentication (already implemented)
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

---

### G2. Personal Taco Stats Page
**Feature**:
- User profile page with stats: spots visited, proteins tried, favorite neighborhood, hottest spot tried
- "Your taco journey" — timeline of check-ins
- Comparison mode: "You vs. the average CartoTaco user"

**Impact**: High engagement, encourages sharing

**Effort**: Moderate (3-4 days, builds on G1)

---

## 🔍 Discovery

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

### D3. Similar Spots Recommendations
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
**Feature**: Generate a beautiful shareable image card for a spot — spot name, type badge, spice level, top protein. Social media bait.

**Impact**: Organic growth through social sharing

**Effort**: Moderate (2-3 days)

**Technical Details**:
- Use `html2canvas` or `satori` to render a styled card to PNG
- Download or share via Web Share API on mobile
- Canonical shareable URL per spot (e.g., `/spot/[est_id]`) for link previews

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

---

### 11. AI-Powered Menu Data Extraction
**Feature**: Automatically extract menu information from uploaded photos using AI vision models

**Details**:
- Allow users to upload menu photos when submitting new locations
- Use AI API (Claude Vision, GPT-4V, or similar) to extract menu items, prices, protein types, salsa varieties, and heat levels
- Auto-populate submission form fields with extracted data
- User can review and edit AI-extracted information before submitting

**Impact**: Dramatically reduces submission friction, increases data quality

**Effort**: High (2-3 weeks)

---

## 🔧 Proposed Improvements (New)

### P1. Accessibility Audit
**Feature**: Comprehensive WCAG 2.1 compliance pass across the app.

**Details**:
- Screen reader support for map interactions, cards, and navigation
- Keyboard navigation for all interactive elements (filter bar, trail builder, comparison tray)
- `prefers-reduced-motion` support for map animations and tour transitions
- High contrast mode option alongside dark/light themes
- ARIA labels for icon-only buttons (favorite heart, directions, theme toggle)

**Impact**: Opens CartoTaco to users with disabilities; potential legal requirement

**Effort**: Moderate (3-4 days)

---

### P2. PWA Support
**Feature**: Progressive Web App with offline capabilities.

**Details**:
- Service worker for caching map tiles and site data
- Add-to-homescreen manifest with CartoTaco icon
- Offline fallback showing cached data with "last updated" indicator
- Background sync for favorites and submissions when back online

**Impact**: Mobile users can install as an app; works in spotty coverage areas (common while exploring taco spots)

**Effort**: Moderate (2-3 days)

---

### P3. Performance: Code Splitting & Lazy Loading
**Feature**: Dynamic imports for heavy visualization libraries.

**Details**:
- Lazy-load ECharts and Chart.js only when radar charts or gauges are visible
- Dynamic import for `TasteProfile.svelte` (only needed in favorites/profile)
- Lazy-load `ComparisonTray` and comparison page components
- Image optimization with responsive srcset if photos are added

**Impact**: Faster initial page load, reduced bundle size

**Effort**: Low-Moderate (1-2 days)

---

### P4. End-to-End Testing (Playwright)
**Feature**: Browser-level tests for critical user flows.

**Details**:
- Auth flows: sign up, sign in, sign out, protected route redirect
- Favorites: toggle favorite, filter by favorites, favorites page
- Trail builder: add/remove/reorder stops, switch transport mode
- Comparison: add spots, navigate to `/compare`, verify winner highlighting
- Filter interactions: search, protein filter, open now

**Impact**: Catch regressions before deploy; confidence for refactoring

**Effort**: Moderate (3-4 days for initial suite)

---

### P5. SEO & Social: Open Graph Meta Tags
**Feature**: Rich link previews for shareable URLs.

**Details**:
- OG tags for `/compare?ids=1,2,3` showing compared spot names
- Per-spot canonical URLs (e.g., `/spot/[est_id]`) for direct linking
- Twitter Card meta tags
- Dynamic OG images via server-side rendering or Vercel OG

**Impact**: Better social sharing, organic growth

**Effort**: Low-Moderate (1-2 days)

---

### P6. Analytics Integration
**Feature**: Track user behavior to inform product decisions.

**Details**:
- Popular spots (view counts per card open)
- Search query analytics to understand user intent
- Filter usage patterns (which filters are used most?)
- Trail builder engagement metrics
- Comparison feature usage

**Impact**: Data-driven prioritization of future features

**Effort**: Low (1 day for basic setup with Vercel Analytics or Plausible)

---

### P7. Photo Gallery
**Feature**: User-uploaded or curated photos per establishment.

**Details**:
- Supabase Storage bucket for establishment photos
- Photo upload in submission form and owner portal
- Swipeable gallery in `Card.svelte`
- Thumbnail on map popup
- Moderation workflow for user-submitted photos

**Impact**: Visual appeal, helps users decide where to go

**Effort**: Moderate-High (4-5 days)

---

### P8. Comparison Mode Enhancements
**Feature**: Expand the existing comparison feature.

**Details**:
- Export comparison as shareable image (html2canvas)
- Additional comparison metrics: distance from user, price tier (if added)
- "Best for X" quick comparison categories (best salsa variety, spiciest, etc.)
- Save comparison sets for later reference

**Impact**: Makes comparison more useful and shareable

**Effort**: Low-Moderate (1-2 days per enhancement)

---

### P9. Taste Profile Tuning
**Feature**: Refine the recommendation algorithm.

**Details**:
- Explanation text for why each spot is recommended ("high salsa variety like your favorites")
- Weighted features (let users indicate what matters most)
- More nuanced archetypes based on real usage data
- "Expand your palate" suggestions that deliberately push outside comfort zone

**Impact**: Better recommendations drive discovery and engagement

**Effort**: Moderate (2-3 days)

---

### P10. Tour Improvements
**Feature**: Enhance the onboarding experience.

**Details**:
- Contextual tips that appear after tour completion (e.g., first time opening a card, first filter use)
- Tour variant testing (shorter vs. longer tours)
- Feature-specific mini-tours when new features launch
- Skip individual steps while preserving tour progress

**Impact**: Better onboarding improves retention

**Effort**: Low-Moderate (1-2 days)

---

## 💡 Community & Discovery (New Ideas)

### C1. Tucson Taco Index
**Feature**: Track the average price of a taco in Tucson over time — a local economic indicator. Published on a public `/index` page with a historical price chart.

**Impact**: Press-worthy and shareable. Positions CartoTaco as the authority on Tucson taco culture beyond just a directory. Zero new map data needed.

**Effort**: Moderate (2-3 days + ongoing data collection)

**Technical Details**:
- Add `price_avg` field to `sites` table (admin-maintained)
- New `taco_index_snapshots` table: `snapshot_date`, `avg_price`, `sample_size`
- Monthly snapshot job (cron or manual admin action)
- Line chart via ECharts (already a dependency)
- "The average Tucson street taco costs $X today" headline stat

---

### C2. Neighborhood Origin Stories
**Feature**: Tap a neighborhood area on the map to surface a short editorial card about that neighborhood's taco culture — history, notable spots, what makes it distinct.

**Impact**: Hyper-local storytelling that no algorithm can replicate. Differentiates CartoTaco from generic map apps and rewards exploration.

**Effort**: Moderate (2-3 days dev + editorial writing time)

**Technical Details**:
- New `neighborhoods` table: `name`, `slug`, `story_html`, `boundary_geojson`
- Mapbox fill layer rendering neighborhood boundaries
- Click boundary → slide-in editorial panel
- Admin CMS or direct DB editing for story content
- Tag each `site` with a `neighborhood_id` foreign key

---

### C3. Group Decision Mode
**Feature**: Generate a shareable voting link for a group. Each recipient votes thumbs up/down on spots. The map highlights the consensus winner in real time as votes come in.

**Impact**: Solves the universal "where should we go?" group chat problem. High virality — every group outing is a potential new user acquisition.

**Effort**: Moderate-High (3-5 days)

**Technical Details**:
- New `group_sessions` table: `id`, `created_by`, `expires_at`, `filter_snapshot`
- New `group_votes` table: `session_id`, `voter_token`, `est_id`, `vote` (up/down)
- Shareable URL: `/vote/[session_id]`
- Real-time vote aggregation via Supabase Realtime
- Result page highlights winning spot with fly-to on map

---

### C4. Community Busyness Reports
**Feature**: One-tap report from inside a spot: "Packed / Moderate / Dead." Reports are anonymous, timestamped, and fade after 2 hours. Aggregate into a live busyness indicator shown on the card.

**Impact**: Real-time crowd signal without needing Google's data. Useful for deciding whether to head somewhere right now.

**Effort**: Moderate (2-3 days)

**Technical Details**:
- New `busyness_reports` table: `est_id`, `level` (1/2/3), `reported_at`
- Weighted average of reports in last 2 hours
- Busyness indicator dot (green/yellow/red) in `Card.svelte`
- Rate-limit by IP or session to prevent spam
- Optional: require auth to report (reduces abuse)

---

### C5. The Midnight Map
**Feature**: A dedicated late-night mode that surfaces only spots open past midnight or 24 hours, with a distinct UI — dark starfield background, glowing orange markers, reduced clutter.

**Impact**: Serves a real underserved use case (post-concert, post-bar hunger). Visually striking and very shareable as a screenshot.

**Effort**: Low-Moderate (1-2 days)

**Technical Details**:
- Filter derived from existing hours data in `filteredTacoData`
- Toggle button in header or map overlay
- Custom Mapbox style or CSS overlay for starfield aesthetic
- Distinct marker glow effect via Mapbox paint properties
- Activates automatically between 10pm–4am (with manual override)

---

### C6. The Anti-Review
**Feature**: Instead of 1–5 star ratings, each visit earns one vote across four emoji dimensions: 🔥 Heat Legit / 🌮 Authentic / 💸 Value / 🎭 Vibe. Aggregated counts display as a vibe fingerprint on each card.

**Impact**: Faster to submit than a written review, more expressive than stars, highly visual. Encourages repeat engagement and generates richer per-spot character data.

**Effort**: Moderate (2-3 days)

**Technical Details**:
- Requires auth (already implemented)
- New `vibe_votes` table: `user_id`, `est_id`, `dimension` (heat/authentic/value/vibe), `voted_at`
- One vote per dimension per user per spot (upsertable)
- Aggregate counts displayed as icon + number in `Card.svelte`
- No moderation burden (no text content)

---

## 📊 Recommended Priority Order

1. ✅ **Query optimization** — COMPLETED
2. ✅ **Search & filter** — COMPLETED
3. ✅ **Marker clustering** — COMPLETED
4. ✅ **Mobile responsive** — COMPLETED
5. ✅ **User authentication** — COMPLETED
6. ✅ **User-submitted locations** — COMPLETED
7. ✅ **Dark mode** — COMPLETED
8. ✅ **User favorites** — COMPLETED
9. ✅ **Vercel deployment** — COMPLETED
10. ✅ **Directions deep-link** — COMPLETED
11. ✅ **Taco trail route builder** — COMPLETED
12. ✅ **Spot comparison mode** — COMPLETED
13. ✅ **Taste profile & personalization** — COMPLETED
14. ✅ **Onboarding tour** — COMPLETED
15. ✅ **New spots badge** — COMPLETED
16. ✅ **Bottom sheet mobile UX** — COMPLETED
17. ✅ **"Surprise Me" button (D1)** — Quick win, fun UX
18. **Taco Tuesday Tracker (S2)** — Weekly engagement, low effort
19. **Tucson Taco Census page (V1)** — Press-worthy, no new data needed
20. **Accessibility audit (P1)** — Important for inclusivity
21. **SEO/Open Graph tags (P5)** — Low effort, better sharing
22. **Analytics integration (P6)** — Data-driven decisions
23. **Community ratings & reviews (#4)** — Add social proof
24. **PWA support (P2)** — Install as app, offline capability
25. **Price Tier filter (V2)** — Practical, needs data entry
26. **E2E testing with Playwright (P4)** — Confidence for shipping
27. **Code splitting (P3)** — Performance improvement
28. **Taco Passport + Check-ins (G1)** — Big engagement feature
29. **Personal Taco Stats (G2)** — Builds on G1
30. **Comparison enhancements (P8)** — Expand existing feature
31. **Taste profile tuning (P9)** — Better recommendations
32. **Similar Spots (D3)** — Discovery improvement
33. **Neighborhood Mode (D2)** — Hyper-local differentiation
34. **Share Card generator (S1)** — Organic growth
35. **Photo gallery (P7)** — Visual appeal
36. **Heat map view (#5)** — Alternative visualization
37. **Tour improvements (P10)** — Better onboarding
38. **Owner Portal (O1)** — Long-term data sustainability
39. **AI menu extraction (#11)** — Advanced automation
40. **Tucson Taco Index (C1)** — Economic indicator, press-worthy
41. **Neighborhood Origin Stories (C2)** — Hyper-local storytelling
42. **Group Decision Mode (C3)** — Viral group UX, solves real problem
43. **Community Busyness Reports (C4)** — Real-time crowd signal
44. **The Midnight Map (C5)** — Late-night discovery, visually striking
45. **The Anti-Review (C6)** — Richer engagement than star ratings

---

## Additional Future Considerations

### Data Enhancements
- Add pricing information ($ to $$$$)
- Add photos (user-generated and official)
- Add delivery/takeout availability
- Add parking information
- Add accessibility features data per establishment

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

**Last Updated**: 2026-04-01
