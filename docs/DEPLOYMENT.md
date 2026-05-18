# Deployment & CI/CD Workflow

CartoTaco uses a **staging → production** Git flow backed by Vercel (frontend) and Supabase (database), with GitHub Actions handling automated migrations on push.

---

## Environments

| Environment | Git Branch | Vercel URL | Supabase Project |
|---|---|---|---|
| Staging | `staging` | auto-deployed by Vercel | `SUPABASE_DB_URL_STAGING` secret |
| Production | `main` | auto-deployed by Vercel | `SUPABASE_DB_URL_PROD` secret |

Both environments use the same codebase; environment-specific config is supplied via Vercel's environment variable settings per deployment target.

---

## Standard Release Flow

1. **Develop on a feature branch** (`feature/my-feature` or a Claude-generated branch).
2. **Open a PR → `staging`**. Vercel builds a preview URL for the branch automatically.
3. **Merge to `staging`**. This triggers:
   - Vercel deploys the new code to the staging environment.
   - GitHub Actions runs `.github/workflows/migrate.yml`, which applies any new migrations to the staging Supabase project via `supabase db push`.
4. **Test on staging** using the staging Vercel URL and the staging Supabase project.
5. **Open a PR from `staging` → `main`** when ready to ship.
6. **Merge to `main`**. This triggers:
   - Vercel deploys to production.
   - GitHub Actions runs `.github/workflows/migrate.yml` again, applying migrations to the production Supabase project.

---

## GitHub Actions Workflows

### `migrate.yml` — Automated Database Migrations

**Trigger**: push to `staging` or `main`

**What it does**: Runs `supabase db push` against the correct Supabase project based on the branch.

**Required repository secrets**:
| Secret | Description |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI personal access token |
| `SUPABASE_DB_URL_STAGING` | Full Postgres connection string for staging DB |
| `SUPABASE_DB_URL_PROD` | Full Postgres connection string for production DB |

The connection strings follow the format:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

### `seed-staging.yml` — Seed Staging from Production

**Trigger**: Manual only (`workflow_dispatch`)

**What it does**: Dumps the production database with `pg_dump` and restores it into staging with `psql`. Useful after a major data entry session in production, or when setting up a fresh staging environment.

**Required secrets**: same as above (`SUPABASE_DB_URL_PROD`, `SUPABASE_DB_URL_STAGING`)

**When to run**:
- After adding significant data in production that staging needs (e.g., a batch of new taco spots).
- When resetting staging to match production for a clean test baseline.

> **Warning**: This overwrites all staging data. Run it deliberately, not routinely.

---

## Writing Migrations

1. Create a new file in `migrations/` following the naming convention: `NNN_description.sql` where `NNN` is the next sequential number (zero-padded to 3 digits).
2. Update `schema/sites_complete_view.sql` if the migration changes the `sites_complete` view (this is the canonical source of truth — copy from it into the migration, not the other way around).
3. Update `migrations/README.md` to document the new migration in the table.
4. Update `CLAUDE.md` to add the migration to the ordered list.

Migrations are applied in filename order by `supabase db push`. They are **not idempotent by default** — wrap destructive operations in `IF EXISTS` guards where appropriate.

---

## Environment Variables

### Frontend (Vercel)

Set these in the Vercel dashboard under **Settings → Environment Variables**, scoped per environment:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (public) |
| `VITE_MAPBOX_KEY` | Mapbox public token |

### Local Development

Copy `.env.example` (if present) or create `.env` manually:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_KEY=your_mapbox_api_key
```

---

## Vercel Configuration

`vercel.json` at the repo root configures the Vercel deployment. The SvelteKit adapter is `@sveltejs/adapter-vercel` with `runtime: 'nodejs20.x'` set in `svelte.config.js`.

> **Note**: `runtime: 'nodejs20.x'` in the adapter config is deprecated in newer adapter versions; Node version should eventually be configured at the Vercel project level instead. No immediate action needed.

---

## Rollback Procedures

### Frontend

Revert via Vercel's **Deployments** tab — every deployment is retained and can be re-promoted to production instantly.

### Database

Migrations are not auto-rolled back. To undo a migration:
1. Write a new migration that reverses the change (e.g., `DROP TABLE`, `ALTER TABLE ... DROP COLUMN`).
2. Merge it through the normal staging → production flow.

The `migrations/README.md` documents rollback SQL for critical migrations (view, Taco Summit tables).
