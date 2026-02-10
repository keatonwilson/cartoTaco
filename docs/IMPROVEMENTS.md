# CartoTaco Improvement Roadmap

This document outlines potential improvements to enhance CartoTaco's functionality, performance, and user experience.

## ✅ Completed Improvements

1. **Query Optimization** - Reduced initial data fetch from 6 queries to 1 via database view (~60-70% faster load time)
2. **Search & Filter Bar** - Added comprehensive filtering by name, proteins, type, spice level, and open hours
3. **Marker Clustering** - Efficient clustering of map markers for scalability and clean visualization

See [QUERY_OPTIMIZATION.md](./QUERY_OPTIMIZATION.md), [SEARCH_FILTER.md](./SEARCH_FILTER.md), and [MARKER_CLUSTERING.md](./MARKER_CLUSTERING.md) for details.

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

## 📊 Recommended Priority Order

1. ✅ **Query optimization (#1)** - Foundation for everything else - **COMPLETED**
2. ✅ **Search & filter (#2)** - Essential as you add more spots - **COMPLETED**
3. ✅ **Marker clustering (#7)** - Prevent map clutter - **COMPLETED**
4. **Mobile responsive (#6)** - Serve your mobile users better
5. **User accounts + favorites (#3)** - Build engagement
6. **Taco trail builder (#9)** - Unique differentiator

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

**Last Updated**: 2026-02-09
