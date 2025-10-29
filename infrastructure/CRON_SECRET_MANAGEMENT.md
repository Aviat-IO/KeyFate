# Cron Secret Management

## Overview

The `CRON_SECRET` authenticates Cloud Scheduler cron jobs when they call Cloud
Run endpoints. The secret is managed in Doppler (single source of truth) and
synchronized to infrastructure components via Terraform.

## Architecture

```
Doppler/tfvars (Source of Truth)
    ↓
var.cron_secret (Terraform variable)
    ↓
    ├─→ Google Secret Manager ─→ Cloud Run (reads dynamically)
    └─→ Cloud Scheduler Headers (hardcoded)
```

## Components

### 1. Source: Doppler/terraform.tfvars

The secret is defined once in Doppler or local `terraform.tfvars`:

```hcl
cron_secret = "your-secret-value-here"  # 32+ alphanumeric characters, no special chars
```

**Important**: Use only alphanumeric characters (A-Z, a-z, 0-9). Avoid special
characters that could cause URI encoding issues.

### 2. Terraform Variable

Defined in `infrastructure/apps/variables.tf`:

```hcl
variable "cron_secret" {
  description = "Secret token for authenticating cron job requests"
  type        = string
  sensitive   = true
}
```

### 3. Google Secret Manager

Stores the secret for Cloud Run to access (`infrastructure/apps/cron.tf`):

```hcl
resource "google_secret_manager_secret_version" "cron_secret" {
  secret      = google_secret_manager_secret.cron_secret.id
  secret_data = var.cron_secret
}
```

### 4. Cloud Scheduler Jobs

Use the secret in Authorization headers:

```hcl
headers = {
  "Authorization" = "Bearer ${var.cron_secret}"
  "Content-Type"  = "application/json"
}
```

### 5. Cloud Run

Reads from Secret Manager dynamically (`infrastructure/apps/frontend.tf`):

```hcl
env_from_key = {
  CRON_SECRET = {
    secret  = google_secret_manager_secret.cron_secret.id
    version = "latest"
  }
}
```

## Secret Rotation

### When to Rotate

- Suspected compromise
- Regular security policy (e.g., every 90 days)
- After team member departure with access

### How to Rotate

1. **Update in Doppler**:
   - Log into Doppler
   - Update `CRON_SECRET` value
   - Use 32+ alphanumeric characters (no special chars)

2. **Sync to terraform.tfvars** (if using local tfvars instead of Doppler):

   ```hcl
   cron_secret = "new-secret-value-here"
   ```

3. **Apply Infrastructure Changes**:

   ```bash
   cd infrastructure/terragrunt/dev  # or staging/prod
   terragrunt plan  # Verify changes
   terragrunt apply
   ```

4. **What Happens Automatically**:
   - Terraform updates Secret Manager with new value (version 5, 6, etc.)
   - Cloud Scheduler jobs are recreated with new secret in headers
   - Cloud Run will pick up new secret on next container restart
   - Zero downtime (Cloud Run restarts automatically)

5. **Verify**:

   ```bash
   # Test manually
   SECRET=$(gcloud secrets versions access latest \
     --secret=cron-authentication-secret-staging \
     --project=keyfate-dev)

   curl -X POST https://staging.keyfate.com/api/cron/check-secrets \
     -H "Authorization: Bearer $SECRET" \
     -H "Content-Type: application/json" -d '{}'

   # Should return HTTP 200 with JSON response
   ```

6. **Check Cloud Scheduler**:
   ```bash
   gcloud logging read 'resource.type=cloud_scheduler_job' \
     --project=keyfate-dev \
     --limit=5 \
     --format="table(timestamp, jsonPayload.status, httpRequest.status)"
   ```

## Troubleshooting

### 401 Errors from Cloud Scheduler

**Symptoms**: Cloud Scheduler logs show HTTP 401 UNAUTHENTICATED

**Causes**:

1. Secret mismatch between Cloud Scheduler and Secret Manager
2. Cloud Run hasn't restarted to pick up new secret
3. Special characters in secret causing URI encoding issues

**Fix**:

```bash
# Force Cloud Run to restart
gcloud run services update frontend \
  --project=keyfate-dev \
  --region=us-central1 \
  --update-env-vars="FORCE_REFRESH=$(date +%s)"

# Verify Cloud Scheduler has correct secret
gcloud scheduler jobs describe keyfate-check-secrets-staging \
  --project=keyfate-dev \
  --location=us-central1 \
  --format=json | jq -r '.httpTarget.headers.Authorization'
```

### 500 Errors - URI Malformed

**Symptoms**: `URIError: URI malformed` in Cloud Run logs

**Cause**: Secret contains special characters like `{`, `}`, `%`, `<`, `>`, etc.

**Fix**: Regenerate secret with only alphanumeric characters

```bash
# Good: alphanumeric only
xxI7TqmblevZlWo9ND6D51Qji

# Bad: contains special chars
2P2pR!U]ba46O?96wLXiUdKU>AW8e9Mh
```

### Secret Version Mismatch

**Symptoms**: Manual curl works, but Cloud Scheduler fails

**Cause**: Cloud Scheduler has old secret version hardcoded

**Fix**:

```bash
cd infrastructure/terragrunt/staging
terragrunt apply  # Recreates scheduler jobs with current secret
```

## Security Best Practices

1. **Never commit secrets to git**: Use Doppler or encrypted tfvars
2. **Rotate regularly**: At least every 90 days
3. **Use minimum required permissions**: Cloud Scheduler and Cloud Run only need
   Secret Manager accessor role
4. **Alphanumeric only**: Avoid special characters
5. **Minimum 32 characters**: Use strong, random values
6. **Monitor access**: Check Secret Manager audit logs

## Emergency Procedures

### Immediate Rotation (Compromise Suspected)

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

# 2. Update Doppler immediately
# (Manual step in Doppler UI)

# 3. Apply to all environments
for ENV in dev prod; do
  cd infrastructure/terragrunt/$ENV
  terragrunt apply -auto-approve
done

# 4. Verify all jobs
for ENV in staging keyfate.com; do
  curl -X POST https://$ENV/api/cron/check-secrets \
    -H "Authorization: Bearer $NEW_SECRET" \
    -H "Content-Type: application/json" -d '{}'
done
```

### Rollback

If rotation causes issues:

```bash
# 1. Get previous secret version
gcloud secrets versions access 3 \
  --secret=cron-authentication-secret-staging \
  --project=keyfate-dev

# 2. Update Doppler with old value
# 3. Re-apply terraform
terragrunt apply
```

## Related Files

- `infrastructure/apps/variables.tf` - Variable definition
- `infrastructure/apps/cron.tf` - Cloud Scheduler configuration
- `infrastructure/apps/frontend.tf` - Cloud Run configuration
- `frontend/src/lib/cron/utils.ts` - Authentication logic

## Monitoring

### Metrics to Watch

1. **Cloud Scheduler Success Rate**:

   ```bash
   gcloud monitoring time-series list \
     --filter='metric.type="cloudscheduler.googleapis.com/job/execution_count"' \
     --project=keyfate-dev
   ```

2. **Secret Manager Access**:

   ```bash
   gcloud logging read 'protoPayload.serviceName="secretmanager.googleapis.com"' \
     --project=keyfate-dev \
     --limit=20
   ```

3. **Cron Endpoint Errors**:
   ```bash
   gcloud logging read 'resource.type=cloud_run_revision AND httpRequest.requestUrl=~"/api/cron/" AND severity=ERROR' \
     --project=keyfate-dev \
     --limit=20
   ```

## Automated Rotation (Future Enhancement)

Consider implementing automated rotation:

1. Cloud Function triggered monthly
2. Generates new secret
3. Updates Doppler via API
4. Triggers Terraform apply via Cloud Build
5. Sends notification on completion

This would ensure regular rotation without manual intervention.
