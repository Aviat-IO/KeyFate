# Database Migrations Guide

## Fresh Start (Staging)

The staging database has been reset. To apply all migrations:

### 1. Start Bastion Tunnel
```bash
gcloud compute ssh bastion-host --zone=us-central1-a --project=keyfate-dev \
  --tunnel-through-iap \
  --ssh-flag='-L' --ssh-flag='54321:127.0.0.1:5432'
```

### 2. Run Migrations
```bash
npm run db:migrate -- --config=drizzle-staging.config.ts
```

This will apply all 27 migrations in order.

## Creating New Migrations

**ALWAYS use `drizzle-kit generate`:**

```bash
# 1. Edit schema
vim src/lib/db/schema.ts

# 2. Generate migration (creates SQL + snapshot + journal)
npx drizzle-kit generate --name="add_feature_x"

# 3. Test locally
npm run db:migrate

# 4. Commit all files
git add drizzle/
git commit -m "Add migration: add_feature_x"
```

## Reset Staging Database

If you need to wipe staging and start fresh:

```bash
./reset-staging-db.sh
```

Then run migrations as described above.

## Never Do This

❌ Manually create SQL files in `drizzle/`
❌ Edit migration files after generation  
❌ Skip `drizzle-kit generate`

**Why?** Drizzle needs BOTH SQL files AND snapshot JSONs. Missing snapshots = migrations skipped = schema drift.
