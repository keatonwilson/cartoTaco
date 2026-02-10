# Visualization & UX Improvements

## Summary

Enhanced the popup card visualizations with better tooltips, context, and contact information to make data more understandable and actionable for users.

## Improvements Implemented

### 1. **Improved Radar Chart Tooltips**

**Before:**
- Basic hover with just the value
- No context or explanation

**After:**
- Rich tooltips with multiple lines of information
- Shows percentage of menu representation
- Explains what the data means
- Better color scheme matching app theme (teal → orange)
- Thicker lines and larger hover points for better visibility

**Technical Changes:**
- Updated Chart.js tooltip configuration with custom callbacks
- Changed color from teal (`rgb(75, 192, 192)`) to orange (`rgb(254, 121, 93)`)
- Added multi-line explanatory text in tooltips
- Improved hover styling with larger point radius

**File:** `src/components/RadarChart.svelte`

---

### 2. **Contact Information & Social Links**

**New Feature:**
- Phone number (clickable tel: link)
- Website link (opens in new tab)
- Instagram profile link
- Facebook page link
- Physical address

**Visual Design:**
- Compact, clean layout in light gray card
- Icons for each contact type
- Social media buttons with brand colors
- Hover effects and smooth transitions
- Only displays if contact info exists

**Database Changes:**
Added 5 new fields to `sites` table:
- `phone` (text) - Phone number
- `website` (text) - Full URL
- `instagram` (text) - Handle without @ symbol
- `facebook` (text) - Page name/ID
- `address` (text) - Street address

**Files:**
- NEW: `src/components/ContactInfo.svelte` - Contact display component
- NEW: `migrations/002_add_contact_and_social_fields.sql` - Database migration
- UPDATED: `migrations/001_create_sites_view.sql` - Include new fields in view
- UPDATED: `src/components/Card.svelte` - Display ContactInfo component

---

### 3. **Enhanced Spice Level Context**

**Before:**
- Just a gauge with a number
- No explanation of what the number means

**After:**
- Descriptive label (Mild, Medium, Hot, Very Hot, etc.)
- Explanation text: "Overall heat level across all salsas"
- Better visual hierarchy

**Spice Level Ranges:**
- 0: No Heat
- 1-2: Mild
- 3-4: Medium
- 5-6: Medium-Hot
- 7-8: Hot
- 9-10: Very Hot

**Technical Changes:**
- Added `getSpiceDescription()` helper function
- New layout with gauge + description + explanation
- Centered alignment for better readability

**File:** `src/components/SpiceGauge.svelte`

---

### 4. **Salsa Count Context & Statistics**

**Before:**
- Bar chart with mean line
- No numeric context or explanation

**After:**
- Stats row showing: **X salsas • Avg: Y • Max: Z**
- Explanation text: "Number of different salsas available at this location"
- Visual hierarchy with highlighted numbers in orange

**Display:**
```
[Bar Chart]
8 salsas • Avg: 6 • Max: 12
Number of different salsas available at this location
```

**Technical Changes:**
- Added stats row below chart
- Orange highlighting for key numbers
- Added explanatory text
- Better spacing and typography

**File:** `src/components/SalsaCount.svelte`

---

### 5. **Fixed Hours Display Order**

**Bug:** After database optimization, days were displayed in random order (JSONB doesn't guarantee key order)

**Fix:** Explicitly order days Monday through Sunday

**Before:**
```javascript
for (let i = 0; i < startTimes.length; i++) {
  // Relied on array order from database
}
```

**After:**
```javascript
const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
let result = dayOrder.map(dayPrefix => {
  // Explicitly iterate in correct order
});
```

**File:** `src/lib/dataWrangling.js`

---

## Visual Examples

### Radar Chart Tooltip
```
Taco
─────────────────
Represents 45% of menu

This shows how prominently
this item features on the menu
```

### Contact Info Card
```
┌─────────────────────────────────┐
│ Contact & Links                 │
├─────────────────────────────────┤
│ 📍 123 Main St, Tucson, AZ      │
│ 📞 (520) 123-4567               │
│ 🌐 Website                      │
│ [Instagram] [Facebook]          │
└─────────────────────────────────┘
```

### Spice Gauge
```
    ┌─────┐
    │  7  │  (gauge visual)
    └─────┘
      Hot
Overall heat level across all salsas
```

### Salsa Count
```
Salsa Count [████████░░░░]
8 salsas • Avg: 6 • Max: 12
Number of different salsas available at this location
```

---

## Migration Instructions

### Step 1: Add Contact Fields to Database
Run in Supabase SQL Editor:
```sql
-- From migrations/002_add_contact_and_social_fields.sql
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS instagram text,
ADD COLUMN IF NOT EXISTS facebook text,
ADD COLUMN IF NOT EXISTS address text;
```

### Step 2: Update Database View
Run in Supabase SQL Editor:
```sql
-- Drop and recreate the view with new fields
-- Use updated migrations/001_create_sites_view.sql
DROP VIEW IF EXISTS public.sites_complete;
CREATE VIEW public.sites_complete AS
...
```

### Step 3: Add Data for Existing Locations
Example:
```sql
UPDATE public.sites SET
  phone = '(520) 555-1234',
  website = 'https://example.com',
  instagram = 'tacoshop',
  facebook = 'tacoshoppage',
  address = '123 Main St, Tucson, AZ 85701'
WHERE est_id = 1;
```

---

## Files Changed

### New Files
1. `src/components/ContactInfo.svelte` - Contact information display
2. `migrations/002_add_contact_and_social_fields.sql` - Add contact fields
3. `VISUALIZATION_IMPROVEMENTS.md` - This documentation

### Modified Files
1. `src/components/RadarChart.svelte` - Better tooltips, orange theme
2. `src/components/SpiceGauge.svelte` - Descriptive labels & explanation
3. `src/components/SalsaCount.svelte` - Stats row & explanation
4. `src/components/Card.svelte` - Include ContactInfo component
5. `src/lib/dataWrangling.js` - Fix hours display order
6. `migrations/001_create_sites_view.sql` - Include new contact fields

---

## Color Theme Consistency

Updated visualizations to use the app's orange theme:

**Primary Color:** `#FE795D` (rgb(254, 121, 93))
**Hover Color:** `#d66548` (darker orange)

**Before:**
- Radar charts: Teal (#4BC0C0)
- Inconsistent accent colors

**After:**
- All interactive elements: Orange
- Consistent with map markers, filter bar, and branding

---

## Accessibility Improvements

1. **Tooltips:**
   - High contrast text (white on dark background)
   - Larger font sizes (13-14px)
   - Clear hierarchy with title and body

2. **Contact Links:**
   - Descriptive aria-labels for social buttons
   - Proper `rel="noopener noreferrer"` for external links
   - Adequate touch target sizes (44px minimum)
   - Keyboard accessible

3. **Text Contrast:**
   - All text meets WCAG AA standards
   - Important numbers highlighted in orange
   - Explanatory text in softer gray (#666)

---

## User Experience Impact

### Information Clarity
- **Before:** Users saw numbers without context
- **After:** Every metric has an explanation

### Actionability
- **Before:** No way to contact establishments
- **After:** Click to call, visit website, or check social media

### Visual Consistency
- **Before:** Mixed color schemes (teal, gray, orange)
- **After:** Unified orange theme throughout

### Learning Curve
- **Before:** Users had to guess what percentages meant
- **After:** Tooltips explain each data point

---

## Future Enhancements

### Contact Info
- [ ] Add email field
- [ ] Add Yelp/Google Maps links
- [ ] Add "Get Directions" button with map integration
- [ ] Add hours of operation in contact card

### Tooltips
- [ ] Add "info" icons next to section headers for additional context
- [ ] Animated tooltips on first visit
- [ ] Comparison tooltips (e.g., "15% above average")

### Visualizations
- [ ] Add animation to gauge (needle sweep)
- [ ] Interactive radar charts (click to filter by item)
- [ ] Chart export/share functionality
- [ ] Mobile-optimized chart sizes

### Data Context
- [ ] Price level indicator ($ to $$$$)
- [ ] User ratings integration
- [ ] Popular times visualization
- [ ] Photos/gallery integration

---

## Testing Checklist

- [x] Radar chart tooltips display on hover
- [x] Tooltips show percentage and explanation
- [x] Spice gauge shows descriptive label
- [x] Salsa count shows statistics
- [x] Hours display Monday → Sunday
- [x] Contact info only shows if data exists
- [x] Phone links work (tel:)
- [x] Website links open in new tab
- [x] Social links go to correct profiles
- [x] All colors match orange theme
- [x] Text is readable and well-contrasted
- [ ] Mobile layout looks good (test after deployment)

---

## Rollback Instructions

To revert these changes:

1. **Restore component files:**
   ```bash
   git checkout HEAD~1 -- src/components/RadarChart.svelte
   git checkout HEAD~1 -- src/components/SpiceGauge.svelte
   git checkout HEAD~1 -- src/components/SalsaCount.svelte
   git checkout HEAD~1 -- src/components/Card.svelte
   git checkout HEAD~1 -- src/lib/dataWrangling.js
   ```

2. **Remove new files:**
   ```bash
   rm src/components/ContactInfo.svelte
   rm migrations/002_add_contact_and_social_fields.sql
   ```

3. **Revert database changes:**
   ```sql
   -- Drop new columns
   ALTER TABLE public.sites
   DROP COLUMN IF EXISTS phone,
   DROP COLUMN IF EXISTS website,
   DROP COLUMN IF EXISTS instagram,
   DROP COLUMN IF EXISTS facebook,
   DROP COLUMN IF EXISTS address;

   -- Recreate view without new fields
   -- Use original migration file
   ```

---

## Notes

- Contact fields are optional - popup will only show contact section if at least one field has data
- Social media links assume standard URL formats (instagram.com/username, facebook.com/pagename)
- Phone number can be in any format - will be sanitized for tel: link
- Hours fix is backward compatible - works with both array and object input
