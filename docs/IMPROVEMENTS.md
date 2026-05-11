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
17. **Anti-Review Vibe Votes (C6)** - Four binary emoji chips per Card (Heat Legit, Authentic, Value, Vibe) replacing star ratings. Phosphor icons, optimistic toggle, aggregate counts public. Tour step explains the system.
18. **Profile Foundations** - `username` (UNIQUE slug) + `bio` on `profiles`; auto-generated usernames on signup; public `/u/[username]` route with SSR 404; avatar uploads via Supabase Storage `avatars` bucket; profile editor with live username validation.
19. **Toast Notification System** - Tiny non-blocking notification store + `ToastHost` mounted once in `+layout`. Phosphor icons for success/error/info; auto-dismiss; dismissable.
20. **iPad Header Layout Fix** - Bumped desktop-nav breakpoint from 768px → 1100px so iPad portrait and split-view widths get the hamburger menu instead of an overflowing 8-item nav.

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

### 4. Community Ratings & Quick Reviews — ❌ Superseded
**Status**: Replaced by the **Social Features Arc** (see above). The Anti-Review Vibe Votes (C6, ✅ shipped) intentionally avoids star ratings; user-generated commentary moves into Phase 3 check-in notes (≤280 chars, optional). No 5-star system planned.

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

## 🤝 Social Features Arc

A coherent multi-phase plan to turn CartoTaco from a solo discovery tool into a social-fabric app. Phases are sequenced so each one unlocks the next; ship in order.

| Phase | Status | Scope | Effort |
|---|---|---|---|
| 1. Anti-Review (C6) | ✅ Shipped 2026-05-04 | 4 emoji-chip votes per Card | ~2 days |
| 2. Profile Foundations | ✅ Shipped 2026-05-04 | username, bio, avatar, public `/u/[username]` | ~2 days |
| 3. Check-ins + Aficionado (G1+G2) | ⏳ Next up | geo-fenced check-ins with notes, tier badges, recent-on-Card | ~4–5 days |
| 4. Meetups | ⏸ Planned | in-person events as a map layer with RSVPs | ~3–4 days |
| 5. Follow / Feed / Reactions | ⏸ Planned | social graph + activity feed + check-in reactions | ~2–3 days |
| 6. Challenges / Badges | ⏸ Stretch | client-derived achievements from check-in data | ~2 days |

### Carry-over from Phase 2 (small)
- **Header → public profile link**: surface `@username` (clickable to `/u/[username]`) in the desktop user-info area and mobile menu. Needs a tiny `profileStore` that loads the current user's username on auth. ~15 min follow-up; bundle with Phase 3.

---

### Phase 3 — G1. Geo-fenced Check-ins + G2. Aficionado Tiers ⏳ Next up
**Feature**: Users check in at the spot they're physically at, optionally leave a ≤280-char note, and earn tier badges as they accumulate verified visits. Recent check-ins appear on each Card; full timeline lives on `/u/[username]`. Replaces and supersedes the original G1/G2 entries.

**Impact**: The core social data substrate. Every later phase (feed, reactions, challenges) compounds on this.

**Effort**: High (~4–5 days)

**Schema (migration 030)**:
```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  est_id INTEGER NOT NULL,
  note TEXT CHECK (char_length(note) <= 280),
  latitude NUMERIC(10,8) NOT NULL,
  longitude NUMERIC(11,8) NOT NULL,
  distance_m INTEGER NOT NULL,        -- server-computed via trigger
  verified BOOLEAN NOT NULL DEFAULT false, -- distance_m <= 200
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Geo-fence verification** — two layers:
1. **Client**: `navigator.geolocation` + existing `calculateDistance()` in `src/lib/geocoding.js`. Live "✓ You're here" / "⚠ 1.2 km away" pill in the check-in modal. Allow submit either way.
2. **Server**: `BEFORE INSERT` Postgres trigger looks up the site's lat/lon, recomputes distance from submitted coords, writes `distance_m`, sets `verified = (distance_m <= 200)`. Honor system, not fraud-proof; geo can be spoofed in DevTools.

**Aficionado tiers** (client-derived from `verified` count only):
- 🌮 Taco Tourist (5+)
- 🌮🌮 Regular (15+)
- 🌮🌮🌮 Aficionado (30+ across 15+ unique spots)
- 👑 Conquistador (all spots checked in)

**Components / files**:
- `src/lib/checkIns.js` — CRUD + `getRecentForSite(est_id)` + `getForUser(user_id)`
- `src/lib/checkInsStore.js` — own check-ins + site-scoped cache (60s TTL)
- `src/components/CheckInButton.svelte` + `CheckInModal.svelte`
- `src/components/RecentCheckIns.svelte` — slot on `Card.svelte` between description and Menu Summary
- `src/components/AficionadoBadge.svelte` — reusable chip
- Fill in the Phase 2 placeholder on `/u/[username]` with the timeline

**Reuses**: `calculateDistance()`, `navigator.geolocation` pattern from `TrailTray.svelte:27`, favorites store template, `ToastHost` for confirmation, `CollapsibleSection` on Card.

---

### Phase 4 — Meetups
**Feature**: Anyone authenticated can create an in-person taco meetup at a spot (or a freeform location), set a start/end time, and others RSVP. Appears as a distinct map pin from ~24h before start through end time, then disappears.

**Impact**: First feature that brings users physically together. Map-native usage of CartoTaco's strength.

**Effort**: Moderate (3–4 days)

**Schema**:
- `meetups(id, creator_id, est_id?, title, description, starts_at, ends_at, latitude, longitude, cancelled_at?, created_at)`
- `meetup_rsvps(id, meetup_id, user_id, status ENUM('going','interested'))` with `UNIQUE(meetup_id, user_id)`

**Map integration**: mirror the trail-layer pattern in `src/lib/mapping.js:462-559` — new `meetup-events` source + circle/symbol layers. Reactive store `upcomingMeetupsStore` populated at app init + Supabase Realtime on `meetups`.

**Routes**:
- `(protected)/meetups/new` — creation form with `LocationPicker` or site picker
- `meetups/[id]` — detail + RSVP list

**Moderation surface**: highest of any phase so far (free-text title + description). MVP gets a "Report" button writing to a simple `reports` table; admin review is manual.

---

### Phase 5 — Follow + Feed + Reactions
**Feature**: Three small additions that compound hard on Phase 3:
1. **Follows** — `user_follows(follower_id, followed_id)` with unique pair. Follow button on `/u/[username]`.
2. **Activity feed** at `/feed` — UNION of check-ins and upcoming meetups from followed users, sorted DESC, paginated.
3. **Reactions on check-ins** — `check_in_reactions(check_in_id, user_id, reaction TEXT CHECK in ('drool','fire','taco'))`. Aggregate count beside each check-in; tap to toggle. Zero prose = zero moderation.

**Effort**: Moderate (2–3 days)

---

### Phase 6 — Challenges / Badges (Stretch)
**Feature**: Pure client-derived achievements from existing check-in data. No DB writes; just a function that takes `checkIns + sites` and returns `{id, name, progress, completed}` records. Rendered on `/u/[username]` and own profile.

Sample challenges:
- **Protein Sweep** — try every protein (chicken/beef/pork/fish/veg) at verified check-ins
- **Truck Stop** — 5 check-ins at food trucks
- **Weekend Warrior** — check in every Saturday for 4 weeks
- **Heat Seeker** — 3 check-ins at spots with heat ≥ 8

**Effort**: Low (~2 days)

---

### Cross-cutting risks & call-outs
- **Geolocation spoofing** — accepted, not engineered around. Aficionado tiers only count `verified=true`.
- **Storage costs** — Supabase free tier handles MVP. 1 MB avatar cap enforced client + server.
- **Realtime quota** — 200 concurrent connections on free tier. Lazy-subscribe (only when Card open, only for relevant `est_id`).
- **Note moderation** — 280-char limit only. Add report button + length filter at Phase 3 launch; build admin tooling if abuse materializes.

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

### C3. Group Decision Mode ✅
**Status**: Completed (2026-04-02)

**Feature**: Shareable ranked-choice voting link for a group ("Taco Summit"). Each participant drags spots into their preferred order. Borda count tallies the ballots and reveals the winner with an ECharts rank-distribution visualisation.

**Technical Details**:
- Migrations 021/022: `group_sessions` and `group_votes` tables with RLS
- `/vote/new` — creation page: pick 2–6 spots, name the summit, get a shareable link
- `/vote/[session_id]` — voting/results page with Supabase Realtime subscriptions
- `SummitResults.svelte` — ECharts stacked horizontal bar (rank distribution per spot) + winner callout; dark-mode reactive
- Anonymous participation via `voter_token` UUID stored in localStorage
- Creator identified by `creator_token` stored in localStorage; can lock results
- "🌮 Summit" button in Header (desktop + mobile) for quick access

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

### C6. The Anti-Review ✅ COMPLETED (2026-05-04)
**Feature**: Instead of 1–5 star ratings, each visit earns one vote across four emoji dimensions: 🔥 Heat Legit / 🌮 Authentic / 💸 Value / 🎭 Vibe. Aggregated counts display as a vibe fingerprint on each card.

**Impact**: Faster to submit than a written review, more expressive than stars, highly visual. Encourages repeat engagement and generates richer per-spot character data.

**Implementation**:
- `migrations/027_create_vibe_votes.sql` — `vibe_votes(user_id, est_id, dimension, created_at)` with `UNIQUE(user_id, est_id, dimension)`. Public SELECT for aggregates; INSERT/DELETE gated on `auth.uid() = user_id`.
- `src/lib/vibeVotes.js` — CRUD: `addVibeVote`, `removeVibeVote`, `getUserVibeVoteKeys`, `getVibeCountsForEst`.
- `src/lib/vibeVotesStore.js` — `userVibeVoteKeys` Set, `vibeCountsByEst` Map cache, `toggleVibeVote()` with optimistic UI.
- `src/components/VibeVotes.svelte` — chip row mounted on `Card.svelte` (mobile + desktop). Anonymous users redirect to login on click.
- Counts load lazily per est_id when a Card opens; user's own vote keys load once on auth.

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
18. ✅ **Group Decision Mode (C3)** — Completed 2026-04-02
19. ✅ **Anti-Review Vibe Votes (C6)** — Completed 2026-05-04 (Social Arc Phase 1)
20. ✅ **Profile Foundations** — Completed 2026-05-04 (Social Arc Phase 2)
21. **Check-ins + Aficionado Tiers (G1+G2)** — ⏳ Next up (Social Arc Phase 3)
22. **Meetups** — Planned (Social Arc Phase 4)
23. **Follow / Feed / Reactions** — Planned (Social Arc Phase 5)
24. **Challenges / Badges** — Stretch (Social Arc Phase 6)
25. **Taco Tuesday Tracker (S2)** — Weekly engagement, low effort
26. **Tucson Taco Census page (V1)** — Press-worthy, no new data needed
27. **Accessibility audit (P1)** — Important for inclusivity
28. **SEO/Open Graph tags (P5)** — Low effort, better sharing
29. **Analytics integration (P6)** — Data-driven decisions
30. **PWA support (P2)** — Install as app, offline capability
31. **Price Tier filter (V2)** — Practical, needs data entry
32. **E2E testing with Playwright (P4)** — Confidence for shipping
33. **Code splitting (P3)** — Performance improvement
34. **Comparison enhancements (P8)** — Expand existing feature
35. **Taste profile tuning (P9)** — Better recommendations
36. **Similar Spots (D3)** — Discovery improvement
37. **Neighborhood Mode (D2)** — Hyper-local differentiation
38. **Share Card generator (S1)** — Organic growth
39. **Photo gallery (P7)** — Visual appeal
40. **Heat map view (#5)** — Alternative visualization
41. **Tour improvements (P10)** — Better onboarding
42. **Owner Portal (O1)** — Long-term data sustainability
43. **AI menu extraction (#11)** — Advanced automation
44. **Tucson Taco Index (C1)** — Economic indicator, press-worthy
45. **Neighborhood Origin Stories (C2)** — Hyper-local storytelling
46. **Community Busyness Reports (C4)** — Real-time crowd signal
47. **The Midnight Map (C5)** — Late-night discovery, visually striking

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

**Last Updated**: 2026-05-04 — Added Social Features Arc section (Phases 1–6); marked C6, Profile Foundations, Toast system, iPad header fix as shipped; superseded ratings/reviews item in favor of the arc.
