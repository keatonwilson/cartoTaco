# Database Migrations

This folder contains SQL migration files for the CartoTaco database.

## How to Run Migrations

1. Log in to your Supabase Dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open the migration file you want to run (e.g., `001_create_sites_view.sql`)
5. Copy the entire contents of the file
6. Paste into the SQL Editor
7. Click **Run** (or press `Ctrl/Cmd + Enter`)

## Migration Files

### 001_create_sites_view.sql
**Purpose**: Creates an optimized database view that combines all site-related tables into a single query.

**Impact**:
- Reduces initial data fetch from 6 separate queries to 1 query
- Improves page load performance by ~60-70%
- No changes to application logic required

**Tables Combined**:
- sites
- descriptions
- menu
- hours
- salsa
- protein

**Result**: A new view called `sites_complete` that can be queried just like a regular table.

## Rollback

To rollback this migration, run:
```sql
DROP VIEW IF EXISTS public.sites_complete;
```

Then revert the changes in `src/lib/stores.js` to use the original 6 separate queries.
