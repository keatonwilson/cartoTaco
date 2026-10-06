# Deployment & CI/CD Workflow

CartoTaco uses a **staging → production** Git flow backed by Vercel (frontend) and
Supabase (database), with GitHub Actions applying migrations on push.

This is the canonical workflow for the project. Schema changes reach a database
by being merged, never by being pasted into the Supabase SQL editor.

---

## Environments

| Environment | Git branch | Vercel | Supabase project |
|---|---|---|---|
| Staging | `staging` | auto-deployed | `SUPABASE_DB_URL_STAGING` |
| Production | `main` | auto-deployed | `SUPABASE_DB_URL_PROD` |

Same codebase both sides; per-environment config comes from Vercel's environment
variables.

---

## Standard release flow

1. **Branch off `staging`** (`feature/thing`, or a Claude-generated branch).
2. **Open a PR → `staging`.** Vercel builds a preview URL.
3. **Merge to `staging`.** This triggers:
   - Vercel deploys to staging.
   - `migrate.yml` runs `supabase db push` against the **staging** database.
4. **Test on staging** — the staging Vercel URL against the staging database.
5. **Open a PR `staging` → `main`** when it's ready to ship.
6. **Merge to `main`.** Vercel deploys production; `migrate.yml` pushes the same
   migrations to the **production** database.

`main` and `staging` should differ only by what hasn't shipped yet. If `staging`
drifts far behind, reset it to `main` rather than merging months-old commits
forward — that's how it got abandoned the first time.

### Preview deployments do not get their own database

A Vercel preview builds the PR's **code** against whichever Supabase project is
set in Vercel's Preview environment. There is no per-branch database and
If you suspect the two databases have drifted apart, run `schema-parity.yml`.

`migrate.yml` does not run for PR branches. A PR that adds a migration will show
a preview that errors against the un-migrated schema until it merges to
`staging`. That is expected; test it on staging, not on the preview.

---

## GitHub Actions

### `migrate.yml` — database migrations

**Trigger**: push to `staging` or `main` touching `supabase/migrations/**`, or
manual dispatch.

Runs `supabase db push` against the branch's database, then prints
`supabase migration list` so a no-op can't be mistaken for success. (For months
this workflow reported "Remote database is up to date" while reading an empty
directory — the list output is there so that can't recur silently.)

### `data-health.yml` — nightly data audit

**Trigger**: 03:23 Tucson, or manual dispatch. Production only.

Runs `heal_spec_links()` then `data_health_report()`, writing findings to the job
summary and a CSV artifact. Findings never fail the job; a SQL error does.

### `seed-staging.yml` — copy prod content into staging

**Trigger**: manual only.

Copies the **content tables** (sites, menu, hours, salsa, protein, descriptions,
spec tables) from production into staging. Deliberately not a whole-database
dump: Supabase owns the auth/storage/realtime schemas and restores into them
fail. User-generated rows (favorites, votes, profiles, submissions) stay as
staging had them, since they reference `auth.users`.

Run it after a big data-entry session in production, not routinely.

### `schema-parity.yml` — prod vs staging schema diff

**Trigger**: manual only.

`pg_dump --schema-only --schema=public` from both databases, normalized and
diffed. Prints the difference to the job summary (`-` prod only, `+` staging
only) and fails the job when they disagree. Full diff in the `schema-diff`
artifact.

Migrations are applied by CI now, but `supabase migration list` only knows what
the migration-history table says. SQL run by hand in the Supabase editor leaves
no row there, so the history keeps claiming both databases agree. This job asks
Postgres instead.

A dump diff rather than an `information_schema.columns` query: less code, and it
covers views, policies, functions, indexes and constraints too, so it surfaces
drift nobody thought to check for.

Caveats:

- **Drift is often expected.** Staging legitimately runs ahead of prod between a
  `staging` merge and the `main` merge that follows. Read a failure as "look at
  this", not "something is broken". That's also why it isn't wired to `push` —
  a check that cries wolf on every release teaches everyone to ignore it.
- `public` only. Supabase owns `auth`/`storage`/`realtime` and their contents
  differ by design, so the `storage.objects` policies from migration 029 are out
  of scope here.
- Ownership and grants are stripped (`--no-owner --no-acl`). The two projects use
  different role names, which would diff on every object and bury real findings.
- The summary is capped at 300 changed lines; the artifact has the rest.

> **A new `workflow_dispatch` workflow can't be run until it reaches `main`.**
> GitHub only offers manual dispatch for workflows present on the default
> branch, so `gh workflow run schema-parity.yml --ref staging` answers `HTTP 404`
> while the file exists only on `staging`. Nothing is misconfigured — ship it to
> `main` first. The same applied to `data-health.yml` and `seed-staging.yml`.

### Repository secrets

| Secret | Description |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI personal access token |
| `SUPABASE_DB_URL_STAGING` | Staging Postgres connection string |
| `SUPABASE_DB_URL_PROD` | Production Postgres connection string |

Use the **session pooler** string (port 5432), not the direct
`db.<ref>.supabase.co` one:

```
postgresql://postgres.<project-ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres
```

Direct connections are IPv6-only and GitHub runners are IPv4 — a direct URL fails
with `ECONNREFUSED` on an IPv6 address. Port 6543 (transaction pooler) doesn't
support what migrations need; use 5432.

---

## Writing migrations

```bash
supabase migration new add_whatever   # supabase/migrations/<timestamp>_add_whatever.sql
```

Then:

1. Write the SQL. Migrations are **not** idempotent by default — guard destructive
   statements with `IF EXISTS`.
2. If it changes the `sites_complete` view, update `schema/sites_complete_view.sql`
   first — that file is the source of truth, and the migration copies from it.
3. Document it in `supabase/migrations/README.md` and the list in `CLAUDE.md`.
4. PR → `staging`, verify, then `staging` → `main`.

### Filenames

`<14-digit timestamp>_<name>.sql`, ordered by timestamp. Migrations 001-034
predate CI and carry synthetic `20200101000NNN` timestamps assigned in numeric
order, plus their historical `NNN_` in the name; new ones sort after them.

### Migration history

The CLI tracks applied migrations in `supabase_migrations.schema_migrations`.
Both databases were baselined once (`scripts/baseline-migrations.sh`) because
001-034 had been applied by hand. If that table and reality ever diverge again:

```bash
supabase migration list --db-url "$DB_URL"              # what the CLI thinks
supabase migration repair --status applied <version> --db-url "$DB_URL"
```

`repair --status applied` only writes the history table; it never runs the SQL.

---

## Environment variables

### Vercel

Settings → Environment Variables, scoped per environment:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `VITE_MAPBOX_KEY` | Mapbox public token |

### Local

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_KEY=your_mapbox_api_key
```

---

## Rollback

**Frontend**: Vercel → Deployments → re-promote a previous deployment.

**Database**: migrations don't auto-roll-back. Write a new migration that reverses
the change and ship it through `staging` → `main` like any other.

If a push fails partway, the database may be partially changed with the migration
unmarked. Fix forward, then `migration repair` so the history matches reality.
