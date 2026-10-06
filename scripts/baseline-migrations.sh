#!/usr/bin/env bash
# One-time: tell the Supabase CLI that migrations 001-034 are ALREADY applied.
#
# Both databases were migrated by hand via the SQL editor, so
# supabase_migrations.schema_migrations is empty. Without this, the first
# `supabase db push` would replay all 34 from scratch — dropping tables and
# rebuilding views on a live database.
#
# Run once per environment, BEFORE merging this branch:
#   ./scripts/baseline-migrations.sh "$STAGING_DB_URL"
#   ./scripts/baseline-migrations.sh "$PROD_DB_URL"
#
# Verify after: `supabase migration list --db-url "$URL"` should show every
# migration as both Local and Remote, with nothing pending.
set -euo pipefail

DB_URL="${1:?usage: $0 <postgres-connection-url>}"
cd "$(dirname "$0")/.."

versions=$(ls supabase/migrations/*.sql | xargs -n1 basename | cut -d_ -f1)
count=$(wc -l <<< "$versions" | tr -d ' ')

# Show the host only - never the credentials in front of the '@'.
host="${DB_URL##*@}"
echo "Baselining $count migrations as applied."
read -rp "Target: ${host%%/*} - type 'yes' to continue: " ok
[[ "$ok" == "yes" ]] || { echo "aborted"; exit 1; }

# ponytail: one repair call per version; --status applied only writes the
# history table, it never runs the SQL. Batch it if 34 ever becomes 300.
while read -r v; do
  echo "  $v"
  supabase migration repair --status applied "$v" --db-url "$DB_URL"
done <<< "$versions"

echo
echo "Done. Confirm nothing is pending:"
echo "  supabase migration list --db-url \"\$DB_URL\""
