# Query Optimization Implementation

## Summary

Optimized the initial data fetch from **6 sequential Supabase queries to 1 single query** by creating a database view that joins all site-related tables.

### Before:
```
6 separate queries executed sequentially:
1. sites
2. descriptions
3. menu
4. hours
5. salsa
6. protein

+ Client-side data combining with combineArraysByEstId()
```

### After:
```
1 single query:
- sites_complete (database view)

✓ No client-side combining needed
✓ Data arrives pre-structured
```

## Expected Performance Impact

- **~60-70% reduction in initial load time**
- **6x fewer network round trips**
- **Reduced client-side processing**
- **Lower memory overhead** (no intermediate arrays)

## Files Changed

### New Files:
1. **migrations/001_create_sites_view.sql** - Database view creation
2. **migrations/README.md** - Migration instructions
3. **QUERY_OPTIMIZATION.md** - This file

### Modified Files:
1. **src/lib/stores.js**
   - Simplified `fetchSiteData()` to use single query
   - Added comments noting the optimization
   - Kept `combineArraysByEstId()` for reference

## How to Deploy

### Step 1: Run the Database Migration

1. Open your Supabase Dashboard
2. Go to **SQL Editor** → **New Query**
3. Copy contents of `migrations/001_create_sites_view.sql`
4. Paste and click **Run**
5. Verify success message

### Step 2: Test the Application

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open browser to `http://localhost:5173`

3. Check browser console for:
   - No errors
   - Faster initial load
   - Single query to `sites_complete` instead of 6 queries

### Step 3: Verify in Network Tab

**Before Optimization:**
- 6+ requests to Supabase API
- Multiple sequential waterfalls
- ~200-400ms total time (varies by connection)

**After Optimization:**
- 1 request to `sites_complete`
- Single network call
- ~100-150ms total time (varies by connection)

## Monitoring Performance

### Browser DevTools
Open **Network tab** and filter by "supabase":
- Look for `sites_complete` query
- Should be a single POST request
- Check timing (should be faster than combined previous queries)

### Supabase Dashboard
Navigate to **Database** → **Query Performance**:
- Monitor view query execution time
- Should see `sites_complete` queries logged

## Troubleshooting

### Issue: "relation 'sites_complete' does not exist"
**Solution**: Run the migration SQL in Supabase SQL Editor

### Issue: Data structure looks different
**Cause**: The view returns JSONB objects that are auto-parsed by Supabase client
**Solution**: Verify the view created correctly with:
```sql
SELECT * FROM sites_complete LIMIT 1;
```

### Issue: Missing data in certain fields
**Cause**: LEFT JOINs will return null if related table has no matching row
**Solution**: Check that all tables have corresponding entries for each `est_id`

## Rollback Instructions

If you need to revert this optimization:

1. **Drop the view in Supabase:**
   ```sql
   DROP VIEW IF EXISTS public.sites_complete;
   ```

2. **Revert stores.js changes:**
   ```bash
   git checkout main -- src/lib/stores.js
   ```

3. **Restart dev server**

## Future Optimizations

This lays the groundwork for:
- Lazy loading popup content (improvement #8)
- Adding pagination or filtering at database level (improvement #2)
- Materialized views for even faster performance (if dataset grows large)

## Notes

- The `combineArraysByEstId()` function is retained for backwards compatibility
- The view uses LEFT JOINs to handle missing related data gracefully
- No changes required to components or derived stores - data structure is identical
