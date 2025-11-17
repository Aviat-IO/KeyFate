# Database Migration Guide

## Root Cause of Recent Issues

The GDPR migrations (0017-0021) were manually created as SQL files but were not properly registered in the drizzle meta system. This caused drizzle-kit to be out of sync with the actual database state.

**What went wrong:**
1. Migration SQL files were created manually in `drizzle/` directory
2. These migrations were added to the database `drizzle.journal` table
3. BUT they were missing from `drizzle/meta/_journal.json`
4. This caused drizzle-kit to skip or incorrectly handle these migrations

**The fix applied:**
1. ✅ Added missing entries to `drizzle/meta/_journal.json` for migrations 17-21
2. ✅ Manually ran SQL to create missing tables (`data_export_jobs`, `account_deletion_requests`)
3. ✅ Added missing enum values to `audit_event_type` enum
4. ✅ Updated `drizzle-production.config.ts` with correct database password

## Correct Migration Workflow

### Creating New Migrations (ALWAYS use this process)

1. **Update the schema file:**
   ```bash
   # Edit src/lib/db/schema.ts with your changes
   ```

2. **Generate migration:**
   ```bash
   npm run db:generate
   ```

   This creates:
   - New SQL file in `drizzle/XXXX_name.sql`
   - New snapshot in `drizzle/meta/XXXX_snapshot.json`
   - Updates `drizzle/meta/_journal.json`

3. **Review the generated SQL:**
   ```bash
   cat drizzle/XXXX_new_migration.sql
   ```

4. **Test locally first:**
   ```bash
   npm run db:migrate
   ```

5. **Deploy to staging:**
   ```bash
   # Start staging proxy
   npm run db:proxy-staging

   # In another terminal:
   npm run db:migrate:staging
   ```

6. **Deploy to production:**
   ```bash
   # Start production proxy
   npm run db:proxy-prod

   # In another terminal:
   npm run db:migrate:production
   ```

### Migration Scripts Available

```bash
# Local development
npm run db:generate          # Generate new migration from schema changes
npm run db:migrate          # Apply migrations to local DB
npm run db:push             # Push schema directly (dev only)
npm run db:studio           # Open Drizzle Studio

# Staging environment
npm run db:proxy-staging    # Start Cloud SQL proxy for staging
npm run db:migrate:staging  # Apply migrations to staging

# Production environment
npm run db:proxy-prod       # Start Cloud SQL proxy for production
npm run db:migrate:production # Apply migrations to production

# Runtime (Cloud Run)
npm run db:migrate:runtime  # Used by Cloud Run startup
```

## NEVER Do These Things

❌ **Never manually create SQL files** in the `drizzle/` directory
❌ **Never manually edit** `drizzle/meta/_journal.json`
❌ **Never skip** the `db:generate` step
❌ **Never apply untested migrations** to production
❌ **Never use `db:push`** in production (development only)

## Troubleshooting

### Migration marked as applied but didn't run

This happens when the journal entry was created but the SQL didn't execute.

**Check:**
```javascript
// Connect to database and check journal
const result = await db.query(`
  SELECT * FROM drizzle.journal
  ORDER BY id DESC LIMIT 10;
`);
```

**Fix:**
1. Manually run the SQL from the migration file
2. Verify the changes were applied
3. Check that meta journal matches database journal

### Drizzle-kit out of sync

If drizzle-kit reports schema mismatch:

```bash
# Check current state
npm run db:check

# Pull current schema from database
npm run db:introspect
```

### Cloud SQL Connection Issues

```bash
# List running proxies
lsof -i :54321

# Kill stuck proxies
pkill -f cloud-sql-proxy

# Restart proxy
npm run db:proxy-prod
```

## Emergency Rollback

If a migration breaks production:

1. **Identify the bad migration:**
   ```sql
   SELECT * FROM drizzle.journal ORDER BY id DESC LIMIT 5;
   ```

2. **Create a rollback migration:**
   - Manually create SQL to undo the changes
   - Use `db:generate` to create proper migration files

3. **Test rollback locally first**

4. **Apply to production**

## Current Database State (as of 2025-11-16)

- ✅ All tables created and synced
- ✅ Enum types properly configured
- ✅ Meta journal updated through migration 0021
- ✅ Database password updated in config files
- ✅ GDPR tables and enums working correctly

## Next Migration

When you need to create the next migration:

1. Ensure you're on latest code: `git pull`
2. Update schema: Edit `src/lib/db/schema.ts`
3. Generate: `npm run db:generate`
4. Review: Check generated SQL file
5. Test locally: `npm run db:migrate`
6. Deploy: staging → production

## Database Credentials

**Production:**
- Host: Via Cloud SQL Unix socket or proxy on localhost:54321
- User: `keyfate_app`
- Password: Stored in Secret Manager as `database-url`
- Database: `keyfate`

**Connection String:**
```bash
# Get from Secret Manager
gcloud secrets versions access latest \
  --secret="database-url" \
  --project=keyfate-prod
```

## Files to Commit

Always commit these files after creating migrations:

- `drizzle/XXXX_migration_name.sql` - The migration SQL
- `drizzle/meta/XXXX_snapshot.json` - Schema snapshot
- `drizzle/meta/_journal.json` - Updated journal
- `src/lib/db/schema.ts` - Your schema changes

## Reference

- [Drizzle Kit Docs](https://orm.drizzle.team/kit-docs/overview)
- [Drizzle Migrations](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL Enums](https://www.postgresql.org/docs/current/datatype-enum.html)
