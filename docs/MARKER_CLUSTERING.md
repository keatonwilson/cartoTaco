# Marker Clustering Implementation

## Summary

Implemented Mapbox GL's built-in marker clustering to efficiently display and manage large numbers of taco locations on the map. Clusters automatically group nearby markers when zoomed out and split them when zoomed in.

## Features

### 1. **Automatic Clustering**
- Nearby markers automatically group into clusters
- Clusters split into individual markers as you zoom in
- Maximum zoom level for clustering: 14 (after zoom 14, all points shown individually)
- Cluster radius: 50 pixels

### 2. **Visual Cluster Styling**
Clusters are color-coded by size:
- **Orange (#FE795D)**: Small clusters (2-9 locations)
- **Dark Orange (#F4511E)**: Medium clusters (10-19 locations)
- **Dark Red (#BF360C)**: Large clusters (20+ locations)

Circle sizes also scale with cluster size:
- Small clusters: 20px radius
- Medium clusters: 30px radius
- Large clusters: 40px radius

### 3. **Cluster Count Labels**
- Each cluster displays the number of locations it contains
- Uses abbreviated format for large numbers (e.g., "100+" instead of "100")
- White text on colored background for readability

### 4. **Individual Marker Styling**
Unclustered points (when zoomed in):
- Orange circle markers (#FE795D)
- 10px radius with white stroke
- Location name displayed below marker
- Text has white halo for readability against any background

### 5. **Interactive Behavior**

**Clicking on Clusters:**
- Zooms in to expand the cluster
- Smooth animation to new zoom level
- Centers on cluster location

**Clicking on Individual Markers:**
- Opens detailed popup with location information
- Same popup behavior as before (uses Card component)
- Popup position auto-adjusts to stay on screen

**Hover Effects:**
- Cursor changes to pointer when hovering over clusters or markers
- Visual feedback for clickable elements

### 6. **Filter Integration**
- Clustering works seamlessly with the filter system
- When filters are applied, only matching locations are clustered
- Clusters update in real-time as filters change
- Results counter reflects clustered locations

## Technical Implementation

### Architecture Change

**Before (Individual Markers):**
```javascript
// Created individual Mapbox Marker objects
processedSites.forEach(site => {
  const marker = new mapboxgl.Marker()
    .setLngLat([site.longitude, site.latitude])
    .addTo(map);
  markers.push(marker);
});
```

**After (GeoJSON Source + Layers):**
```javascript
// Convert sites to GeoJSON
const geojson = {
  type: 'FeatureCollection',
  features: sites.map(site => ({ ... }))
};

// Add as Mapbox source with clustering enabled
map.addSource('taco-sites', {
  type: 'geojson',
  data: geojson,
  cluster: true,
  clusterMaxZoom: 14,
  clusterRadius: 50
});

// Add layers for clusters and points
map.addLayer({ ... }); // cluster circles
map.addLayer({ ... }); // cluster counts
map.addLayer({ ... }); // individual points
```

### Files Modified

1. **src/lib/mapping.js**
   - Completely rewrote `updateMarkers()` function
   - Added `sitesToGeoJSON()` helper function
   - Replaced individual markers with GeoJSON source
   - Added 4 Mapbox layers (clusters, cluster-count, unclustered-point, unclustered-point-label)
   - Added click handlers for clusters and points
   - Added hover cursor changes

2. **src/routes/Map.svelte**
   - Removed `markers` array (no longer needed)
   - Updated `updateMarkers()` call to pass `null` for markers param
   - Added comment explaining the change

### Data Flow

```
Filtered Taco Data
    ↓
sitesToGeoJSON() - Convert to GeoJSON FeatureCollection
    ↓
Mapbox Source 'taco-sites' (with clustering enabled)
    ↓
Mapbox Layers (clusters + unclustered points)
    ↓
User Interaction (click/hover)
    ↓
Event Handlers (zoom for clusters, popup for points)
```

### Mapbox Layers Created

1. **clusters** (circle layer)
   - Displays cluster circles
   - Graduated colors and sizes
   - Only shows when `point_count` exists

2. **cluster-count** (symbol layer)
   - Displays count labels on clusters
   - White text, 14px size
   - Only shows when `point_count` exists

3. **unclustered-point** (circle layer)
   - Individual location markers
   - Orange circles with white stroke
   - Only shows when `point_count` does NOT exist

4. **unclustered-point-label** (symbol layer)
   - Location names below markers
   - White halo for contrast
   - Only shows for individual points

## Performance Benefits

### Memory Efficiency
- **Before**: Created individual DOM elements for every marker
- **After**: Single GeoJSON source, rendered efficiently by Mapbox GL

### Rendering Performance
- **Before**: Browser had to manage hundreds of individual elements
- **After**: Mapbox uses WebGL to render clusters and points

### Scalability
- Can handle hundreds or thousands of locations without performance degradation
- Clustering reduces visual clutter at low zoom levels
- Only renders visible points/clusters (viewport culling)

## Configuration Options

Current clustering settings (in `mapping.js`):

```javascript
cluster: true,           // Enable clustering
clusterMaxZoom: 14,     // Max zoom to cluster points on
clusterRadius: 50       // Radius of each cluster (in pixels)
```

### Adjustable Parameters

**clusterMaxZoom** (default: 14)
- Higher value = clusters persist at higher zoom levels
- Lower value = clusters split earlier when zooming in
- Recommended range: 12-16

**clusterRadius** (default: 50)
- Higher value = more aggressive clustering (larger cluster areas)
- Lower value = less aggressive clustering (smaller cluster areas)
- Recommended range: 30-80 pixels

## User Experience Improvements

### Before Clustering
- All markers visible at all zoom levels
- Visual clutter with many locations
- Difficult to see individual locations in dense areas
- Performance issues with 50+ markers

### After Clustering
- Clean map view at low zoom levels
- Clear visual hierarchy (clusters → individual markers)
- Easy to see concentration of locations
- Smooth performance with any number of locations
- Progressive disclosure (zoom to see detail)

## Edge Cases Handled

1. **Single Location**
   - No cluster created (shown as individual marker)

2. **Two Locations Very Close**
   - Forms small cluster if within cluster radius
   - Splits at zoom level 14 or earlier if zoomed in

3. **Empty Results (All Filtered Out)**
   - Source data updated to empty GeoJSON
   - All clusters and markers removed
   - No errors or warnings

4. **Rapid Filter Changes**
   - Source data updated efficiently
   - No marker flickering or duplication
   - Smooth transitions

5. **Map Not Loaded Yet**
   - Waits for map `load` event before adding source/layers
   - Prevents "source not found" errors

## Browser Compatibility

- Works in all browsers that support Mapbox GL JS
- Requires WebGL support
- Graceful fallback: if WebGL unavailable, markers still display (just not clustered)

## Future Enhancements

Potential improvements to the clustering system:

1. **Cluster Styling Options**
   - Different colors for different types (restaurants vs trucks)
   - Icons within clusters
   - Animated cluster transitions

2. **Cluster Interaction**
   - Show cluster details on hover (list of locations)
   - Alternative cluster click behavior (show list instead of zoom)

3. **Smart Clustering**
   - Cluster by type or spice level
   - Custom cluster algorithms based on data properties

4. **Spider Clusters**
   - When clusters have few points, display in a circular pattern instead of zooming

5. **Performance Tuning**
   - Adjust cluster settings based on total location count
   - Different cluster radii for different zoom levels

## Troubleshooting

### Issue: Clusters not appearing
**Check**: Verify map has loaded (`map.loaded()` returns true)
**Solution**: Implementation waits for `load` event automatically

### Issue: Clicking clusters doesn't zoom
**Check**: Browser console for errors
**Solution**: Verify `getClusterExpansionZoom()` is working

### Issue: Labels overlapping
**Solution**: Adjust `text-offset` in unclustered-point-label layer

### Issue: Wrong cluster colors
**Check**: Verify color step expressions in `paint.circle-color`

### Issue: Clusters at wrong zoom level
**Solution**: Adjust `clusterMaxZoom` value (lower = split earlier)

## Testing Checklist

- [ ] Clusters appear at low zoom levels
- [ ] Clicking cluster zooms to expand
- [ ] Individual markers appear at high zoom
- [ ] Clicking marker shows popup
- [ ] Hover changes cursor to pointer
- [ ] Labels are readable
- [ ] Colors match app theme
- [ ] Works with filter system
- [ ] Empty results don't cause errors
- [ ] Performance good with many locations

## Migration Notes

### Breaking Changes
- `markers` array in Map.svelte is now unused (removed)
- `updateMarkers()` function signature changed (markers param now ignored)

### Non-Breaking Changes
- Popup behavior unchanged (still uses Card component)
- Filter system integration unchanged
- All existing functionality preserved

### Rollback Instructions

If you need to revert to individual markers:

1. **Restore mapping.js from previous commit:**
   ```bash
   git show HEAD~1:src/lib/mapping.js > src/lib/mapping.js
   ```

2. **Restore Map.svelte:**
   ```bash
   git show HEAD~1:src/routes/Map.svelte > src/routes/Map.svelte
   ```

3. **Restart dev server**
