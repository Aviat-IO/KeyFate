# Deployment Validation Checklist

This document provides step-by-step validation procedures for Cloud Run deployment fixes.

## Pre-Deployment Validation

### 1. Configuration Verification

#### Check Terraform Configuration
```bash
# Validate dev environment
cd infrastructure/terragrunt/dev
terragrunt validate

# Validate prod environment
cd infrastructure/terragrunt/prod
terragrunt validate
```

**Expected**: `Success! The configuration is valid.`

#### Verify Authorized Networks
```bash
# Check dev authorized networks
grep -A 5 "cloudsql_authorized_networks" infrastructure/terragrunt/dev/terraform.tfvars

# Check prod authorized networks
grep -A 5 "cloudsql_authorized_networks" infrastructure/terragrunt/prod/terraform.tfvars
```

**Expected**: Should show home, vpn, and home2 networks with IP addresses

#### Verify Gen2 Configuration
```bash
grep "gen2_execution_environment" infrastructure/apps/frontend.tf
```

**Expected**: `gen2_execution_environment = true`

#### Verify Public IP Configuration
```bash
grep -B 2 -A 2 "public_ipv4" infrastructure/apps/cloudsql.tf
```

**Expected**: `public_ipv4 = true` with authorized_networks configured

### 2. Local Build Validation

#### Test Docker Build
```bash
cd frontend

# Build the image locally
docker build -t test-frontend:local .
```

**Expected**: Build completes successfully, migration configs are copied

#### Verify Migration Configs in Image
```bash
# Run container and check files
docker run --rm test-frontend:local ls -la /app/drizzle*.config.ts
```

**Expected**: Should list all drizzle config files including drizzle-runtime.config.ts

### 3. Secret Manager Validation

#### Check DATABASE_URL Secret (Dev)
```bash
gcloud secrets describe database-url --project=keyfate-dev
```

**Expected**: Secret exists with latest version

#### Check DATABASE_URL Secret (Prod)
```bash
gcloud secrets describe database-url --project=keyfate-prod
```

**Expected**: Secret exists with latest version

#### Verify Secret Format (without exposing value)
```bash
# Get secret value length (should be ~100-150 chars for Unix socket URL)
gcloud secrets versions access latest --secret=database-url --project=keyfate-dev | wc -c
```

**Expected**: ~100-150 characters (Unix socket connection string)

## Deployment Execution

### Dev/Staging Deployment

```bash
cd infrastructure/terragrunt/dev

# Plan the deployment
terragrunt plan -out=tfplan

# Review the plan carefully
# Verify: Cloud Run service will be updated
# Verify: No unintended resource destruction

# Apply the deployment
terragrunt apply tfplan
```

### Production Deployment

```bash
cd infrastructure/terragrunt/prod

# Plan the deployment
terragrunt plan -out=tfplan

# Review the plan carefully
# Verify: Cloud Run service will be updated
# Verify: Deletion protection is enabled
# Verify: No unintended resource destruction

# Apply the deployment
terragrunt apply tfplan
```

## Post-Deployment Validation

### 1. Cloud Run Service Status

#### Check Service Health (Dev)
```bash
gcloud run services describe frontend \
  --region=us-central1 \
  --project=keyfate-dev \
  --format="value(status.conditions[0].message)"
```

**Expected**: "Ready" or "Revision 'frontend-xxxxx' is ready."

#### Check Service Health (Prod)
```bash
gcloud run services describe frontend \
  --region=us-central1 \
  --project=keyfate-prod \
  --format="value(status.conditions[0].message)"
```

**Expected**: "Ready" or "Revision 'frontend-xxxxx' is ready."

### 2. Migration Logs Verification

#### View Recent Logs (Dev)
```bash
gcloud run services logs read frontend \
  --region=us-central1 \
  --project=keyfate-dev \
  --limit=100 \
  --format="value(textPayload)"
```

**Look for these SUCCESS indicators**:
- ✅ `DATABASE_URL is set (first 50 chars): postgresql://keyfate_app`
- ✅ `Using runtime database configuration (DATABASE_URL from Secret Manager)`
- ✅ `Database migrations completed successfully`
- ✅ `Starting Next.js server...`

**ERROR indicators to watch for**:
- ❌ `DATABASE_URL environment variable is not set`
- ❌ `Database migration failed after 5 attempts`
- ❌ `Migration attempt X failed`

#### View Recent Logs (Prod)
```bash
gcloud run services logs read frontend \
  --region=us-central1 \
  --project=keyfate-prod \
  --limit=100 \
  --format="value(textPayload)"
```

**Look for same SUCCESS/ERROR indicators as dev**

### 3. Application Endpoint Testing

#### Test Staging Endpoint
```bash
# Check if site is accessible
curl -I https://staging.keyfate.com

# Expected: HTTP/2 200
```

#### Test Production Endpoint
```bash
# Check if site is accessible
curl -I https://keyfate.com

# Expected: HTTP/2 200
```

#### Test Health Endpoint (if available)
```bash
# Staging
curl https://staging.keyfate.com/api/health

# Production
curl https://keyfate.com/api/health
```

**Expected**: JSON response indicating healthy status

### 4. Database Connection Validation

#### Check Cloud SQL Instance Status (Dev)
```bash
gcloud sql instances describe keyfate-postgres-staging \
  --project=keyfate-dev \
  --format="value(state)"
```

**Expected**: `RUNNABLE`

#### Check Cloud SQL Instance Status (Prod)
```bash
gcloud sql instances describe keyfate-postgres-production \
  --project=keyfate-prod \
  --format="value(state)"
```

**Expected**: `RUNNABLE`

#### Verify Cloud SQL Connections
```bash
# Dev connections
gcloud sql operations list \
  --instance=keyfate-postgres-staging \
  --project=keyfate-dev \
  --limit=5

# Prod connections
gcloud sql operations list \
  --instance=keyfate-postgres-production \
  --project=keyfate-prod \
  --limit=5
```

**Expected**: Recent successful operations, no error messages

### 5. Migration State Verification

#### Connect to Database and Check Migrations (Dev)
```bash
# Start Cloud SQL Proxy
cloud-sql-proxy --port=54321 keyfate-dev:us-central1:keyfate-postgres-staging &

# Connect to database
psql "postgresql://keyfate_app:<password>@localhost:54321/keyfate"

# Check migration table
SELECT * FROM drizzle.journal ORDER BY created_at DESC LIMIT 10;

# Exit
\q

# Stop proxy
killall cloud-sql-proxy
```

**Expected**: Migration records in drizzle.journal table

#### Connect to Database and Check Migrations (Prod)
```bash
# Start Cloud SQL Proxy (use production password)
cloud-sql-proxy --port=54321 keyfate-prod:us-central1:keyfate-postgres-production &

# Connect to database
psql "postgresql://keyfate_app:<password>@localhost:54321/keyfate"

# Check migration table
SELECT * FROM drizzle.journal ORDER BY created_at DESC LIMIT 10;

# Exit
\q

# Stop proxy
killall cloud-sql-proxy
```

**Expected**: Migration records in drizzle.journal table

## Monitoring & Ongoing Validation

### Set Up Log Monitoring

#### Create Log-Based Metric for Migration Failures
```bash
# Dev environment
gcloud logging metrics create migration_failures \
  --project=keyfate-dev \
  --description="Count of database migration failures" \
  --log-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="frontend"
    textPayload=~"Database migration failed"'

# Prod environment
gcloud logging metrics create migration_failures \
  --project=keyfate-prod \
  --description="Count of database migration failures" \
  --log-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="frontend"
    textPayload=~"Database migration failed"'
```

#### Create Alert Policy
```bash
# Create alert when migration failures occur
gcloud alpha monitoring policies create \
  --project=keyfate-prod \
  --notification-channels=<channel-id> \
  --display-name="Migration Failure Alert" \
  --condition-display-name="Migration Failed" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=60s
```

### Continuous Validation Commands

#### Quick Health Check Script
```bash
#!/bin/bash
# save as check-deployment-health.sh

echo "Checking Dev/Staging..."
curl -s -o /dev/null -w "%{http_code}" https://staging.keyfate.com
echo ""

echo "Checking Production..."
curl -s -o /dev/null -w "%{http_code}" https://keyfate.com
echo ""

echo "Checking Dev Cloud Run Status..."
gcloud run services describe frontend --region=us-central1 --project=keyfate-dev --format="value(status.conditions[0].status)"

echo "Checking Prod Cloud Run Status..."
gcloud run services describe frontend --region=us-central1 --project=keyfate-prod --format="value(status.conditions[0].status)"
```

## Rollback Procedure

### If Deployment Fails

#### Immediate Rollback to Previous Revision
```bash
# Get previous revision
gcloud run revisions list \
  --service=frontend \
  --region=us-central1 \
  --project=keyfate-dev \
  --limit=5

# Route traffic to previous revision (replace REVISION_NAME)
gcloud run services update-traffic frontend \
  --region=us-central1 \
  --project=keyfate-dev \
  --to-revisions=REVISION_NAME=100
```

#### Rollback Terraform Changes
```bash
cd infrastructure/terragrunt/dev
git log --oneline -10  # Find the commit before changes
git revert <commit-hash>  # Revert to previous state
terragrunt apply
```

## Success Criteria Checklist

- [ ] Terraform validation passes for both dev and prod
- [ ] Docker image builds successfully with all drizzle configs
- [ ] DATABASE_URL secret exists in Secret Manager
- [ ] Cloud Run service deploys without errors
- [ ] Migration logs show successful completion
- [ ] Application endpoints return HTTP 200
- [ ] Database migrations are recorded in drizzle.journal
- [ ] No error logs in Cloud Run service logs
- [ ] Health check endpoints respond correctly
- [ ] No alerts triggered after 1 hour of deployment

## Troubleshooting Guide

### Common Issues

#### Issue: Migration Fails with "DATABASE_URL not set"
**Solution**: Verify Secret Manager configuration in frontend.tf lines 183-187

#### Issue: Migration Fails with Connection Timeout
**Solution**:
1. Check Cloud SQL instance is running
2. Verify authorized networks include deployment source
3. Increase startup probe `initial_delay_seconds`

#### Issue: Cloud Run Service Won't Start
**Solution**:
1. Check logs for detailed error messages
2. Verify all required secrets exist in Secret Manager
3. Check service account has necessary IAM roles

#### Issue: Unauthorized Network Error
**Solution**:
1. Verify authorized_networks in terraform.tfvars
2. Add deployment source IP to authorized networks
3. Reapply Terraform configuration

## Additional Resources

- [Cloud Run Gen2 Documentation](https://cloud.google.com/run/docs/about-execution-environments)
- [Cloud SQL Unix Socket Connections](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Drizzle Kit Migration Guide](https://orm.drizzle.team/kit-docs/overview)
- [Terraform Google Cloud Run Module](https://github.com/GoogleCloudPlatform/cloud-foundation-fabric/tree/master/modules/cloud-run-v2)
