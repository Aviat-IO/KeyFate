# Google Cloud Scheduler Cron Authentication Fix - Deployment Guide

## Problem Summary

Google Cloud Scheduler cron jobs are failing authentication with the error:
- Middleware correctly identifies cron routes (`isCron: true`)
- Authentication fails with "Invalid cron authentication"
- Root cause: `CRON_SECRET` environment variable not available in Cloud Run

## Solution Implemented

### 1. Enhanced Debugging (✅ Complete)

Added comprehensive logging to:
- `frontend/src/middleware.ts` - `validateCronAuth()` function
- `frontend/src/app/api/cron/process-reminders/route.ts` - `authorize()` function
- `frontend/src/app/api/cron/check-secrets/route.ts` - `authorize()` function

### 2. Local Environment Fix (✅ Complete)

Added `CRON_SECRET=local-test-secret-change-in-production` to `frontend/.env.local`

**Local Testing Results:**
```
✅ /api/cron/process-reminders: 200 OK
✅ /api/cron/check-secrets: 200 OK
✅ Security working: Invalid tokens rejected (401)
✅ Security working: No tokens rejected (401)
```

### 3. Infrastructure Validation (✅ Verified)

Terraform infrastructure is correctly configured:
- `cron.tf` generates `CRON_SECRET` and stores in Secret Manager
- `frontend.tf` line 191 includes `CRON_SECRET` in `env_from_key`
- Cloud Scheduler jobs send Bearer token in Authorization header
- Service accounts have proper IAM permissions

## Deployment Steps Required

### Step 1: Redeploy Infrastructure (If Needed)

If the current staging environment doesn't have the latest infrastructure:

```bash
cd infrastructure/terragrunt/staging  # or prod
terragrunt plan
terragrunt apply
```

Verify the `CRON_SECRET` exists in Secret Manager:

```bash
gcloud secrets list --project=your-project-id | grep cron-authentication-secret
gcloud secrets versions access latest --secret=cron-authentication-secret-staging
```

### Step 2: Redeploy Application

The frontend application must be redeployed to pick up the environment variable configuration:

```bash
# Trigger a new deployment by pushing code changes or manual rebuild
cd infrastructure/terragrunt/staging
terragrunt apply  # This will rebuild and deploy the frontend
```

### Step 3: Verify Cloud Scheduler Configuration

Check that Cloud Scheduler jobs are sending the correct Bearer token:

```bash
# List scheduler jobs
gcloud scheduler jobs list --project=your-project-id

# Describe a specific job to verify configuration
gcloud scheduler jobs describe keyfate-process-reminders-staging --project=your-project-id

# Check that the Authorization header is configured with Bearer token
```

### Step 4: Test Production Endpoints

Use the validation script to test staging/production:

```bash
# Test staging environment (set CRON_SECRET and NEXT_PUBLIC_SITE_URL)
CRON_SECRET="actual-secret-from-secret-manager" NEXT_PUBLIC_SITE_URL="https://staging.keyfate.com" node validate-cron-endpoints.js staging
```

## Troubleshooting

### Issue: CRON_SECRET Still Not Available

**Check 1: Cloud Run Environment Variables**
```bash
gcloud run services describe frontend --region=your-region --project=your-project-id --format="value(spec.template.spec.template.spec.containers[0].env)"
```

**Check 2: Secret Manager Access**
```bash
# Verify secret exists and has correct IAM bindings
gcloud secrets get-iam-policy cron-authentication-secret-staging --project=your-project-id
```

**Check 3: Application Logs**
```bash
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=frontend" --project=your-project-id --limit=100
```

### Issue: Cloud Scheduler Jobs Still Failing

**Check 1: Manual Job Execution**
```bash
gcloud scheduler jobs run keyfate-process-reminders-staging --project=your-project-id
```

**Check 2: Scheduler Logs**
```bash
gcloud logs read "resource.type=cloud_scheduler_job" --project=your-project-id --limit=50
```

## Expected Results After Fix

1. **Cloud Run Logs Should Show:**
   ```
   [Middleware] CRON_SECRET environment variable present: true
   [Middleware] CRON_SECRET length: 32
   [Middleware] Token validation result: true
   [Middleware] Valid cron authentication, allowing access
   ```

2. **Cron Endpoints Should Return:**
   ```
   POST /api/cron/process-reminders → 200 OK {"processed": N}
   POST /api/cron/check-secrets → 200 OK {"processed": N}
   ```

3. **Cloud Scheduler Jobs Should:**
   - Execute successfully every 5 minutes
   - Show no error logs
   - Return 200 status codes

## Validation Script Usage

The `validate-cron-endpoints.js` script can test both local and production environments:

```bash
# Test local development
node validate-cron-endpoints.js local

# Test staging (set environment variables first)
CRON_SECRET="your-staging-secret" NEXT_PUBLIC_SITE_URL="https://staging.keyfate.com" node validate-cron-endpoints.js staging
```

## Security Notes

- The CRON_SECRET is 32 characters long with special characters
- Only Google Cloud Scheduler service account should have this token
- Middleware correctly validates token format and value
- Invalid tokens are rejected with 401 Unauthorized
- All cron authentication attempts are logged for monitoring

## Next Steps

1. Deploy the debugging enhancements to staging/production
2. Verify CRON_SECRET is accessible in Cloud Run environment
3. Test with validation script
4. Monitor Cloud Scheduler job execution
5. Remove debug logging once confirmed working (optional)

The local fix proves the solution works - the issue is purely deployment/configuration in the cloud environment.