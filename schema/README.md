# Schema Management

## Canonical View Definition

`sites_complete_view.sql` is the **single source of truth** for the `sites_complete` Postgres view.

### How to use

When creating a migration that rebuilds the view:

1. Edit `schema/sites_complete_view.sql` with your changes
2. Copy the updated SQL into your new migration file
3. Update the "Last updated" comment at the top of the canonical file

This prevents the bug where migrations were based on stale copies of previous migrations (e.g., migration 013 was accidentally based on 011 instead of 012, referencing a dropped column).

### What goes here

- `sites_complete_view.sql` — the view definition (DROP + CREATE + GRANT + COMMENT)

### What does NOT go here

- Table definitions (those live in migrations only)
- RLS policies (those live in migrations only)
- Data migrations or column drops
