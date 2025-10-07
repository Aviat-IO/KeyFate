# Cloud SQL Migration Rollback Procedures

## Emergency Rollback Guide for Supabase to Cloud SQL Migration

This document provides step-by-step procedures to safely rollback the Cloud SQL migration and restore service using Supabase.

---

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Emergency Rollback Procedure](#emergency-rollback-procedure)
4. [Standard Rollback Procedure](#standard-rollback-procedure)
5. [Post-Rollback Validation](#post-rollback-validation)
6. [Data Recovery](#data-recovery)
7. [Rollback Verification](#rollback-verification)

---

## When to Rollback

### Critical Issues Requiring Immediate Rollback

🚨 **Immediate rollback if**:
- Database connection failures affecting >50% of requests
- Data corruption or integrity issues
- Critical security vulnerability in new setup
- Performance degradation >200% vs baseline
- Authorization failures preventing user access
- Cloud SQL instance unavailable for >15 minutes

⚠️ **Consider rollback if**:
- Migration validation tests failing
- Unexpected behavior in production
- Higher than expected costs
- Team concerns about stability

---

## Pre-Rollback Checklist

### 1. Verify Backup Availability

```bash
# Check Supabase backup exists
ls -lh backups/supabase-backup-*.sql

# Check backup timestamp
stat backups/supabase-backup-*.sql

# Verify backup integrity
pg_restore --list backups/supabase-backup-*.sql | head -20
```

### 2. Document Current State

```bash
# Export Cloud SQL data before rollback
gcloud sql export sql keyfate-db-production \
  gs://YOUR_BUCKET/pre-rollback-backup-$(date +%Y%m%d-%H%M%S).sql \
  --database=keyfate

# Document current configuration
gcloud sql instances describe keyfate-db-production > pre-rollback-config.yaml
```

### 3. Notify Stakeholders

- [ ] Notify team of rollback decision
- [ ] Post status page update
- [ ] Alert on-call engineers
- [ ] Prepare communication for users

### 4. Assess Impact

- [ ] Check number of active users
- [ ] Identify in-progress operations
- [ ] Review pending data changes
- [ ] Document migration duration so far

---

## Emergency Rollback Procedure

Use this procedure when immediate rollback is required (< 5 minutes).

### Step 1: Enable Maintenance Mode (30 seconds)

```bash
# Option A: Using environment variable
gcloud run services update YOUR_SERVICE \
  --set-env-vars="MAINTENANCE_MODE=true" \
  --region=us-central1

# Option B: Using maintenance page
gcloud run services update YOUR_SERVICE \
  --set-env-vars="REDIRECT_TO_MAINTENANCE=true"
```

### Step 2: Switch to Supabase Connection (2 minutes)

```bash
# Update environment variables to use Supabase
gcloud run services update YOUR_SERVICE \
  --update-env-vars="DATABASE_URL=${SUPABASE_DATABASE_URL}" \
  --remove-env-vars="CLOUD_SQL_CONNECTION_NAME" \
  --region=us-central1

# Remove Cloud SQL connection
gcloud run services update YOUR_SERVICE \
  --clear-cloudsql-instances \
  --region=us-central1
```

### Step 3: Restore Supabase RLS Policies (1 minute)

```bash
# Connect to Supabase
psql $SUPABASE_DATABASE_URL

# Re-enable RLS
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

# Restore RLS policies from backup
\i backups/supabase-rls-policies.sql
```

### Step 4: Deploy Rollback Code (2 minutes)

```bash
# Checkout pre-migration code
git checkout pre-cloud-sql-migration

# Deploy immediately
gcloud run deploy YOUR_SERVICE \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Verify deployment
gcloud run services describe YOUR_SERVICE --region=us-central1
```

### Step 5: Disable Maintenance Mode (30 seconds)

```bash
# Remove maintenance mode
gcloud run services update YOUR_SERVICE \
  --remove-env-vars="MAINTENANCE_MODE,REDIRECT_TO_MAINTENANCE" \
  --region=us-central1
```

### Step 6: Verify Service (1 minute)

```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Test authentication
curl -X POST https://yourdomain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Monitor logs
gcloud run services logs read YOUR_SERVICE --limit=50
```

**Total Emergency Rollback Time: ~7 minutes**

---

## Standard Rollback Procedure

Use this procedure for controlled rollback with minimal data loss.

### Phase 1: Preparation (10-15 minutes)

#### 1.1: Freeze Database Writes

```bash
# Put application in read-only mode
gcloud run services update YOUR_SERVICE \
  --set-env-vars="READ_ONLY_MODE=true"
```

#### 1.2: Export Recent Data from Cloud SQL

```bash
# Export all data changed since migration
psql $DATABASE_URL << EOF
COPY (
  SELECT * FROM secrets
  WHERE updated_at > '2024-01-01'  -- Use actual migration timestamp
) TO '/tmp/recent-secrets.csv' WITH CSV HEADER;

COPY (
  SELECT * FROM check_ins
  WHERE created_at > '2024-01-01'
) TO '/tmp/recent-checkins.csv' WITH CSV HEADER;
EOF

# Download exported data
gcloud sql export csv keyfate-db-production \
  gs://YOUR_BUCKET/rollback-data/recent-secrets.csv \
  --database=keyfate \
  --query="SELECT * FROM secrets WHERE updated_at > '2024-01-01'"
```

#### 1.3: Create Rollback Point

```bash
# Tag current state
git tag -a rollback-point-$(date +%Y%m%d-%H%M%S) -m "Pre-rollback state"
git push --tags

# Backup current configuration
kubectl get configmap,secret -o yaml > rollback-config-backup.yaml
```

### Phase 2: Environment Rollback (15-20 minutes)

#### 2.1: Restore Supabase Configuration

```bash
# Restore environment variables from backup
cp .env.pre-migration .env.production.local

# Update Cloud Run with Supabase settings
gcloud run services update YOUR_SERVICE \
  --update-env-vars="DATABASE_URL=${SUPABASE_DATABASE_URL}" \
  --update-env-vars="SUPABASE_URL=${SUPABASE_URL}" \
  --update-env-vars="SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" \
  --remove-env-vars="CLOUD_SQL_CONNECTION_NAME,DATABASE_SSL" \
  --clear-cloudsql-instances
```

#### 2.2: Restore Authorization Configuration

```bash
# Re-enable Supabase Auth
gcloud run services update YOUR_SERVICE \
  --update-env-vars="USE_SUPABASE_AUTH=true" \
  --update-env-vars="USE_NEXTAUTH=false"
```

#### 2.3: Restore RLS Policies

```bash
# Connect to Supabase
psql $SUPABASE_DATABASE_URL

# Restore all RLS policies
\i backups/supabase-rls-policies.sql

# Verify policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

### Phase 3: Code Rollback (10 minutes)

#### 3.1: Checkout Pre-Migration Code

```bash
# Find pre-migration commit
git log --oneline | grep "pre-migration"

# Checkout pre-migration state
git checkout <pre-migration-commit>

# Or use tagged version
git checkout pre-cloud-sql-migration
```

#### 3.2: Restore Supabase Client Code

```bash
# Restore Supabase client initialization
git checkout pre-cloud-sql-migration -- src/lib/supabase.ts

# Restore RLS-based queries
git checkout pre-cloud-sql-migration -- src/app/actions/

# Restore Supabase auth
git checkout pre-cloud-sql-migration -- src/lib/auth.ts
```

#### 3.3: Remove Cloud SQL Dependencies

```bash
# Remove Cloud SQL packages
npm uninstall @google-cloud/sql-connector pg

# Restore Supabase packages
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### Phase 4: Data Synchronization (20-30 minutes)

#### 4.1: Import Recent Data to Supabase

```bash
# Download recent data from Cloud SQL
gsutil cp gs://YOUR_BUCKET/rollback-data/recent-*.csv ./

# Import to Supabase
psql $SUPABASE_DATABASE_URL << EOF
\copy secrets FROM 'recent-secrets.csv' WITH CSV HEADER;
\copy check_ins FROM 'recent-checkins.csv' WITH CSV HEADER;
EOF
```

#### 4.2: Resolve Data Conflicts

```bash
# Check for duplicates
psql $SUPABASE_DATABASE_URL << EOF
SELECT id, COUNT(*) as count
FROM secrets
GROUP BY id
HAVING COUNT(*) > 1;
EOF

# Resolve conflicts (keep most recent)
psql $SUPABASE_DATABASE_URL << EOF
DELETE FROM secrets a
USING secrets b
WHERE a.id = b.id
AND a.updated_at < b.updated_at;
EOF
```

#### 4.3: Update Sequences

```bash
psql $SUPABASE_DATABASE_URL << EOF
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('secrets_id_seq', (SELECT MAX(id) FROM secrets));
SELECT setval('check_ins_id_seq', (SELECT MAX(id) FROM check_ins));
EOF
```

### Phase 5: Deployment (10 minutes)

#### 5.1: Build and Test Locally

```bash
# Install dependencies
npm install

# Run local build
npm run build

# Run tests
npm run test

# Test database connection
npm run test:db
```

#### 5.2: Deploy to Production

```bash
# Deploy rollback version
gcloud run deploy YOUR_SERVICE \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Verify deployment
gcloud run services describe YOUR_SERVICE
```

#### 5.3: Remove Read-Only Mode

```bash
# Enable writes
gcloud run services update YOUR_SERVICE \
  --remove-env-vars="READ_ONLY_MODE"
```

### Phase 6: Validation (10 minutes)

See [Post-Rollback Validation](#post-rollback-validation) section below.

**Total Standard Rollback Time: ~75-95 minutes**

---

## Post-Rollback Validation

### 1. Application Health Checks

```bash
# Test health endpoint
curl https://yourdomain.com/api/health
# Expected: { "status": "ok", "database": "supabase" }

# Test authentication
curl -X POST https://yourdomain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test API endpoints
curl https://yourdomain.com/api/secrets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Database Validation

```bash
# Connect to Supabase
psql $SUPABASE_DATABASE_URL

# Verify data integrity
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM secrets;
SELECT COUNT(*) FROM check_ins;

# Verify RLS is working
SET ROLE authenticated;
SELECT * FROM secrets; -- Should only return user's secrets

# Verify indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
```

### 3. Authorization Testing

```bash
# Test RLS enforcement
psql $SUPABASE_DATABASE_URL << EOF
-- Should fail (no user context)
SELECT * FROM secrets;

-- Should succeed with user context
SET request.jwt.claim.sub = 'user-id-here';
SELECT * FROM secrets;
EOF
```

### 4. Performance Validation

```bash
# Run load test
npm run test:load

# Check query performance
psql $SUPABASE_DATABASE_URL << EOF
EXPLAIN ANALYZE SELECT * FROM secrets WHERE user_id = 'test-user-id';
EOF
```

### 5. User Acceptance Testing

- [ ] User login works
- [ ] Users can view their secrets
- [ ] Users can create new secrets
- [ ] Users can edit existing secrets
- [ ] Recipients receive notifications
- [ ] Check-ins work correctly

---

## Data Recovery

### Recovering Lost Data During Rollback

#### 1. Identify Data Loss Window

```bash
# Compare record counts
psql $CLOUD_SQL_URL -c "SELECT COUNT(*) FROM secrets"
psql $SUPABASE_URL -c "SELECT COUNT(*) FROM secrets"

# Identify missing records
psql $CLOUD_SQL_URL << EOF
SELECT id, title, created_at
FROM secrets
WHERE id NOT IN (
  SELECT id FROM secrets_backup
)
ORDER BY created_at DESC;
EOF
```

#### 2. Export Missing Data

```bash
# Export data created during Cloud SQL period
gcloud sql export csv keyfate-db-production \
  gs://YOUR_BUCKET/recovery/missing-data.csv \
  --database=keyfate \
  --query="SELECT * FROM secrets WHERE created_at > '${MIGRATION_TIMESTAMP}'"
```

#### 3. Import to Supabase

```bash
# Download and import
gsutil cp gs://YOUR_BUCKET/recovery/missing-data.csv ./
psql $SUPABASE_DATABASE_URL -c "\copy secrets FROM 'missing-data.csv' WITH CSV HEADER"
```

#### 4. Verify Data Recovery

```bash
# Compare counts again
CLOUD_COUNT=$(psql $CLOUD_SQL_URL -t -c "SELECT COUNT(*) FROM secrets")
SUPABASE_COUNT=$(psql $SUPABASE_URL -t -c "SELECT COUNT(*) FROM secrets")

if [ "$CLOUD_COUNT" -eq "$SUPABASE_COUNT" ]; then
  echo "✅ Data recovery successful"
else
  echo "❌ Data mismatch: Cloud SQL=$CLOUD_COUNT, Supabase=$SUPABASE_COUNT"
fi
```

---

## Rollback Verification

### Automated Verification Script

```bash
#!/bin/bash
# rollback-verification.sh

set -e

echo "🔍 Starting Rollback Verification..."

# 1. Check database connection
echo "Testing database connection..."
psql $SUPABASE_DATABASE_URL -c "SELECT 1" > /dev/null
echo "✅ Database connection successful"

# 2. Verify RLS is enabled
echo "Verifying RLS policies..."
RLS_COUNT=$(psql $SUPABASE_DATABASE_URL -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'")
if [ "$RLS_COUNT" -gt 0 ]; then
  echo "✅ RLS policies active ($RLS_COUNT policies)"
else
  echo "❌ ERROR: No RLS policies found!"
  exit 1
fi

# 3. Check application health
echo "Testing application health..."
HEALTH=$(curl -s https://yourdomain.com/api/health | jq -r '.status')
if [ "$HEALTH" == "ok" ]; then
  echo "✅ Application healthy"
else
  echo "❌ ERROR: Application unhealthy"
  exit 1
fi

# 4. Verify data counts
echo "Verifying data integrity..."
USER_COUNT=$(psql $SUPABASE_DATABASE_URL -t -c "SELECT COUNT(*) FROM users")
SECRET_COUNT=$(psql $SUPABASE_DATABASE_URL -t -c "SELECT COUNT(*) FROM secrets")
echo "✅ Data counts: Users=$USER_COUNT, Secrets=$SECRET_COUNT"

# 5. Test authentication
echo "Testing authentication..."
AUTH_RESPONSE=$(curl -s -X POST https://yourdomain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}')
if echo "$AUTH_RESPONSE" | jq -e '.token' > /dev/null; then
  echo "✅ Authentication working"
else
  echo "❌ ERROR: Authentication failed"
  exit 1
fi

echo "✅ Rollback verification complete!"
```

### Manual Verification Checklist

- [ ] Application loads without errors
- [ ] Users can log in successfully
- [ ] Database queries return expected data
- [ ] RLS policies are enforced
- [ ] API endpoints are functional
- [ ] Performance is acceptable (< 200ms queries)
- [ ] No error spikes in logs
- [ ] Monitoring shows normal metrics

---

## Post-Rollback Actions

### 1. Document Rollback

```markdown
# Rollback Report

**Date**: [Date and Time]
**Trigger**: [Reason for rollback]
**Duration**: [Total rollback time]
**Data Loss**: [Any data loss details]
**Recovery**: [Recovery actions taken]

## Timeline
- HH:MM - Issue detected
- HH:MM - Rollback decision made
- HH:MM - Rollback initiated
- HH:MM - Service restored
- HH:MM - Validation complete

## Lessons Learned
- [What went wrong]
- [What went well]
- [Improvements for next migration]
```

### 2. Analyze Root Cause

- Review Cloud SQL logs
- Analyze application errors
- Identify configuration issues
- Document failure points

### 3. Plan Next Migration Attempt

- Address identified issues
- Update migration procedures
- Add additional validation
- Schedule new migration window

### 4. Team Communication

- Send rollback completion notice
- Share lessons learned
- Update documentation
- Schedule retrospective

---

## Emergency Contacts

**Database Team**: database-team@example.com
**DevOps Team**: devops@example.com
**On-Call Engineer**: +1-XXX-XXX-XXXX
**Cloud SQL Support**: cloud-sql-support@google.com

---

## Related Documentation

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Troubleshooting Guide](./MIGRATION_TROUBLESHOOTING.md)
- [Cloud SQL Setup](./cloud-sql-setup.md)
