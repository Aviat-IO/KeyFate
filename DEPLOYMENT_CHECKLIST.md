# Phase 1.1 Deployment Checklist

## Prerequisites

- [ ] GCP authentication configured (`gcloud auth login`)
- [ ] Access to keyfate-dev project
- [ ] Bastion host available for database connection

## Staging Deployment

### Step 1: Reset Staging Database

```bash
cd frontend
./reset-staging-db.sh
```

**Expected output:**

```
🔥 Resetting Staging Database
==============================

⚠️  This will DROP and RECREATE the database!

Are you sure? Type 'yes' to continue: yes

Connecting to Cloud SQL via gcloud...
Database doesn't exist or already deleted
Creating fresh database...
✅ Database reset complete!
```

### Step 2: Start Bastion Tunnel

In a **separate terminal**, keep this running:

```bash
gcloud compute ssh bastion-host \
  --zone=us-central1-a \
  --project=keyfate-dev \
  --tunnel-through-iap \
  --ssh-flag='-L' \
  --ssh-flag='54321:127.0.0.1:5432'
```

**Keep this terminal open** - the tunnel must stay active for migrations.

### Step 3: Apply Migrations

In your **original terminal**:

```bash
cd frontend
npm run db:migrate -- --config=drizzle-staging.config.ts
```

**Expected output:**

```
Applying migration: 0000_initial_schema_with_rate_limits
✅ Migration complete
```

### Step 4: Verify Staging Database

**Check rate_limits table exists and is UNLOGGED:**

```bash
gcloud sql connect keyfate-postgres-staging \
  --user=postgres \
  --project=keyfate-dev
```

Then in psql:

```sql
-- Connect to database
\c keyfate

-- Verify rate_limits table is UNLOGGED (relpersistence = 'u')
SELECT relname, relpersistence
FROM pg_class
WHERE relname = 'rate_limits';

-- Should show:
--   relname     | relpersistence
-- --------------+----------------
--  rate_limits  | u

-- Check all tables created
\dt

-- Check indexes
\di

-- Check migration history
SELECT * FROM drizzle.__drizzle_migrations;

-- Exit
\q
```

### Step 5: Test Rate Limiting on Staging

**Deploy application to staging:**

```bash
# Follow your normal staging deployment process
# e.g., gcloud run deploy, docker deploy, etc.
```

**Test multi-instance rate limiting:**

```bash
# Make requests that should be rate limited
for i in {1..10}; do
  curl -X POST https://staging.keyfate.com/api/some-endpoint
done

# Should see 429 responses after limit reached
```

### Step 6: Monitor Staging

Check logs for errors:

```bash
gcloud logging read "resource.type=cloud_run_revision" \
  --project=keyfate-dev \
  --limit=50 \
  --format=json | jq '.[] | select(.severity=="ERROR")'
```

**Let staging run for 24 hours** before production deployment.

---

## Production Deployment

⚠️ **Only proceed after staging validation is successful**

### Step 1: Backup Production Database (Optional)

```bash
gcloud sql backups create \
  --instance=keyfate-postgres-prod \
  --project=keyfate-prod
```

### Step 2: Reset Production Database

**Manual process via Cloud SQL console:**

1. Connect to Cloud SQL instance
2. Open SQL editor
3. Run:

```sql
DROP DATABASE IF EXISTS keyfate_prod;
CREATE DATABASE keyfate_prod;
```

### Step 3: Start Production Bastion Tunnel

```bash
gcloud compute ssh bastion-host-prod \
  --zone=us-central1-a \
  --project=keyfate-prod \
  --tunnel-through-iap \
  --ssh-flag='-L' \
  --ssh-flag='54321:127.0.0.1:5432'
```

### Step 4: Apply Migrations to Production

```bash
cd frontend
DATABASE_URL=<prod-connection-string> npm run db:migrate -- --config=drizzle.config.ts
```

### Step 5: Verify Production Database

Same verification steps as staging (Step 4 above).

### Step 6: Deploy Application to Production

```bash
# Follow your production deployment process
```

### Step 7: Monitor Production

**Watch for 30 minutes:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --project=keyfate-prod \
  --limit=100 \
  --format=json
```

**Check metrics:**

- Error rate should be <0.1%
- Rate limit requests return 429 properly
- Database queries complete in <5ms (p95)

---

## Validation Criteria

### Staging Must Show:

- [ ] Migration applied successfully
- [ ] rate_limits table exists and is UNLOGGED
- [ ] All 29 tables created
- [ ] Application starts without errors
- [ ] Rate limiting works (429 responses)
- [ ] No errors in logs for 24 hours

### Production Must Show:

- [ ] All staging validations pass
- [ ] Migration applied successfully
- [ ] Application deployed successfully
- [ ] Rate limiting works across multiple instances
- [ ] No increase in error rate
- [ ] Database CPU usage <70%
- [ ] API latency p95 <100ms

---

## Rollback Procedure

### If Issues in Staging:

```bash
# Revert code changes
git revert <commit-hash>

# Re-deploy old version
# Staging data loss is acceptable
```

### If Issues in Production:

```bash
# Immediate: Revert application deployment
# Restore database from backup:
gcloud sql backups restore <backup-id> \
  --backup-instance=keyfate-postgres-prod \
  --project=keyfate-prod
```

---

## Success Metrics

After 24 hours in production:

- [ ] Zero rate limiting errors
- [ ] Database query time <5ms (p95)
- [ ] No duplicate requests due to race conditions
- [ ] Rate limit cleanup job runs successfully
- [ ] Application uptime >99.9%

---

## Next Steps After Validation

Once production is stable for 24 hours:

1. Mark Phase 1.1 tasks complete in `tasks.md`
2. Continue with Phase 1.2: Distributed Cron Job Locking
3. Update `PHASE_1_IMPLEMENTATION_SUMMARY.md` with deployment results

---

## Troubleshooting

### Migration fails with "table already exists"

```sql
-- Check existing schema
\dt
-- If tables exist, manually drop database and recreate
DROP DATABASE keyfate;
CREATE DATABASE keyfate;
```

### Bastion tunnel connection refused

```bash
# Check bastion host is running
gcloud compute instances list --project=keyfate-dev

# Restart bastion if needed
gcloud compute instances start bastion-host --zone=us-central1-a
```

### Rate limiting not working

```sql
-- Check rate_limits table has data
SELECT COUNT(*) FROM rate_limits;

-- Check for errors in application logs
-- Verify database connection pool not exhausted
```

### High database CPU

```sql
-- Check for missing index
EXPLAIN ANALYZE SELECT * FROM rate_limits WHERE expires_at < NOW();
-- Should use idx_rate_limits_expires

-- Check cleanup job is running
SELECT COUNT(*) FROM rate_limits;
-- Should be <1000 entries
```
