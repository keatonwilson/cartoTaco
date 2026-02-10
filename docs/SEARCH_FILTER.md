# Search and Filter Implementation

## Summary

Added a comprehensive search and filter bar to help users discover taco spots based on multiple criteria. The filter bar appears in the top-right corner of the map and provides real-time filtering of map markers.

## Features

### 1. **Text Search**
- Search by establishment name
- Case-insensitive matching
- Real-time results as you type

### 2. **Protein Filters**
Filter locations that serve specific proteins:
- Chicken
- Beef
- Pork
- Fish
- Vegetarian

**Logic**: Shows locations that have ANY of the selected proteins (OR logic)

### 3. **Type Filters**
Filter by establishment type:
- Restaurant (Brick and Mortar)
- Stand
- Truck

**Logic**: Shows locations matching ANY of the selected types (OR logic)

### 4. **Spice Level Range**
Filter by heat level (0-10 scale):
- Adjustable min/max range sliders
- Default: 0-10 (shows all)

**Logic**: Shows locations within the selected spice range

### 5. **Open Now**
- Toggle to show only currently open locations
- Uses current day and time
- Handles times that cross midnight

### 6. **Results Counter**
- Shows "X of Y locations" matching current filters
- Updates in real-time
- Located at bottom of expanded filter panel

## User Interface

### Compact Mode (Default)
- Search input visible
- "Filters" button with expand/collapse icon
- Red dot indicator when filters are active
- Minimal screen space usage

### Expanded Mode
- All filter options visible
- Organized into clear sections
- Results counter
- "Clear All Filters" button (only visible when filters are active)

### Design
- White background with subtle shadow
- Orange accent color (#FE795D) matching app theme
- Smooth expand/collapse animation
- Responsive design for mobile and desktop

## Technical Implementation

### Files Created
1. **src/components/FilterBar.svelte** - Main filter UI component
2. **SEARCH_FILTER.md** - This documentation

### Files Modified
1. **src/lib/stores.js**
   - Added `filterConfig` writable store for filter state
   - Added `filteredTacoData` derived store for filtered results
   - Added `isOpenNow()` helper function

2. **src/routes/Map.svelte**
   - Imported `FilterBar` component
   - Imported `filteredTacoData` store
   - Updated markers to use filtered data
   - Conditionally render FilterBar when data is loaded

### Data Flow

```
User Input (FilterBar)
    ↓
filterConfig store (updates)
    ↓
filteredTacoData (derived store - auto-recomputes)
    ↓
Map markers update (reactive statement)
    ↓
Visual update on map
```

### Filter Logic

All filters use **AND** logic between different filter types:
- Search text AND proteins AND types AND spice level AND open now

Within each filter type:
- Proteins: OR logic (match any selected protein)
- Types: OR logic (match any selected type)

**Example**: If you select "Chicken" + "Open Now", you'll see locations that:
- Have chicken available AND
- Are currently open

## Performance Considerations

- Filtering happens client-side using derived stores
- Svelte's reactivity ensures efficient re-computation
- Markers are updated only when filtered data changes
- No additional API calls when filtering

## Edge Cases Handled

1. **Empty Results**
   - Map shows no markers
   - Results counter shows "0 of X locations"

2. **No Filters Active**
   - Shows all locations (default state)
   - "Clear All Filters" button hidden

3. **Missing Data**
   - Gracefully handles missing hours/protein data
   - Won't crash if a location lacks certain fields

4. **Time Parsing**
   - Handles both 12-hour (with AM/PM) and 24-hour time formats
   - Handles times that cross midnight (e.g., 11 PM - 2 AM)

## Future Enhancements

Potential improvements for the filter system:

1. **URL Parameters**
   - Save filter state in URL query params
   - Allow sharing filtered map views

2. **Saved Filters**
   - Let users save favorite filter combinations
   - Quick-access filter presets

3. **Distance Filter**
   - Filter by proximity to current location
   - "Within X miles" slider

4. **Price Range**
   - Filter by price level ($ to $$$$)
   - Requires adding pricing data to database

5. **Advanced Search**
   - Search by specialty items
   - Search by salsa types
   - Search in descriptions

6. **Sort Options**
   - Sort by distance
   - Sort by rating (when ratings added)
   - Sort by spice level

7. **Filter Analytics**
   - Track popular filter combinations
   - Suggest filters based on user behavior

## Usage Examples

### Find Fish Taco Spots Open Now
1. Check "Fish" in Proteins
2. Check "Open Now"
3. Map shows only fish taco locations currently open

### Find Mild Taco Trucks
1. Check "Truck" in Type
2. Set spice level max to 3
3. Map shows only food trucks with low heat

### Search for Specific Location
1. Type "El" in search box
2. See all locations with "El" in the name

## Accessibility

- Keyboard navigation supported
- All interactive elements are focusable
- ARIA labels on buttons
- Color is not the only indicator (text labels included)
- High contrast ratios for text

## Mobile Responsiveness

- Filter bar width adjusts for mobile
- "Filters" text hidden on small screens (icon only)
- Touch-friendly input sizes
- Proper tap target sizes (min 44px)

## Testing Checklist

- [ ] Search filters locations by name
- [ ] Each protein filter shows correct locations
- [ ] Each type filter shows correct locations
- [ ] Spice level sliders work correctly
- [ ] Open Now shows only open locations
- [ ] Results counter updates correctly
- [ ] Clear All Filters resets everything
- [ ] Expand/collapse animation smooth
- [ ] Active filter indicator appears
- [ ] Mobile layout looks good
- [ ] No console errors

## Troubleshooting

### Issue: "Open Now" not working correctly
**Check**: Verify hours data format in database (should be "HH:MM" or "HH:MM AM/PM")

### Issue: No results showing
**Check**: Clear all filters and verify base data is loading

### Issue: Filter bar overlaps map controls
**Solution**: Adjust `right` position in FilterBar.svelte styles

### Issue: Protein/Type filters not working
**Check**: Verify field names match database schema (e.g., `chicken_yes`, `beef_yes`)
