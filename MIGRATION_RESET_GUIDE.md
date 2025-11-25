# Migration Reset Guide

## Context

The Drizzle migration history was corrupted with missing snapshot files for
migrations 0018-0021 and incorrectly named snapshots for migrations 0022,
0030-0033. This caused `drizzle-kit generate` to fail.

**Solution:** Reset all migrations and create a single initial migration from
the current schema state.

## What Was Done

1. **Removed all old migrations:**

   ```bash
   rm -rf frontend/drizzle/meta/*.json frontend/drizzle/*.sql
   ```

2. **Created fresh migration from current schema:**

   ```bash
   cd frontend
   mkdir -p drizzle/meta
   echo '{"version": "7", "dialect": "postgresql", "entries": []}' > drizzle/meta/_journal.json
   npx drizzle-kit generate --name="initial_schema_with_rate_limits"
   ```

3. **Made rate_limits table UNLOGGED:**
   ```bash
   sed -i 's/CREATE TABLE IF NOT EXISTS "rate_limits"/CREATE UNLOGGED TABLE IF NOT EXISTS "rate_limits"/' \
     frontend/drizzle/0000_initial_schema_with_rate_limits.sql
   ```

## Files Created

✅ Three required files per Drizzle best practices:

1. `frontend/drizzle/0000_initial_schema_with_rate_limits.sql` (24KB)
2. `frontend/drizzle/meta/0000_snapshot.json` (79KB)
3. `frontend/drizzle/meta/_journal.json` (updated)

## Applying to Staging

**⚠️ THIS WILL DROP ALL DATA IN STAGING DATABASE**

```bash
cd frontend
./reset-staging-db.sh
npm run db:migrate -- --config=drizzle.config.ts
```

## Applying to Production

**⚠️ THIS WILL DROP ALL DATA IN PRODUCTION DATABASE**

1. **Backup (optional but recommended):**

   ```bash
   # From Cloud SQL console or gcloud
   gcloud sql backups create --instance=YOUR_INSTANCE_NAME
   ```

2. **Connect to production database:**

   ```bash
   gcloud sql connect YOUR_INSTANCE_NAME --user=postgres
   ```

3. **Drop and recreate database:**

   ```sql
   DROP DATABASE IF EXISTS keyfate_prod;
   CREATE DATABASE keyfate_prod;
   \c keyfate_prod
   ```

4. **Run migrations:**
   ```bash
   cd frontend
   DATABASE_URL=<prod-connection-string> npm run db:migrate -- --config=drizzle.config.ts
   ```

## Verification

After applying migrations, verify:

```sql
-- Check rate_limits table exists and is UNLOGGED
SELECT relname, relpersistence FROM pg_class WHERE relname = 'rate_limits';
-- relpersistence should be 'u' for UNLOGGED

-- Check all tables exist
\dt

-- Check all indexes exist
\di

-- Verify migration journal
SELECT * FROM drizzle.__drizzle_migrations;
```

## Future Migrations

From now on, always follow the Drizzle workflow from `@AGENTS.md`:

1. Modify `src/lib/db/schema.ts`
2. Run `npx drizzle-kit generate --name="description_of_change"`
3. Review generated SQL
4. Test locally
5. Commit ALL three files (SQL, snapshot JSON, \_journal.json)

**Never:**

- ❌ Manually create SQL files
- ❌ Edit migration files after generation
- ❌ Skip `drizzle-kit generate`
