# Automatic Cron Secret Updates

## Problem

When the `CRON_SECRET` in Secret Manager changes (e.g., due to secret rotation
or terraform state issues), Cloud Scheduler jobs continue using the old
hardcoded secret value, causing 401 authentication errors.

## Solution

Added `lifecycle.replace_triggered_by` blocks to all Cloud Scheduler jobs in
`infrastructure/apps/cron.tf`. This ensures that whenever the
`random_password.cron_secret` resource changes, the Cloud Scheduler jobs are
automatically destroyed and recreated with the new secret value.

## Changes Made

### 1. Added Keepers to `random_password.cron_secret`

```hcl
resource "random_password" "cron_secret" {
  length  = 32
  special = true
  upper   = true
  lower   = true
  numeric = true

  # Keepers ensure this gets regenerated if infrastructure changes
  # but don't regenerate on every apply
  keepers = {
    # Only regenerate if we explicitly change this value
    version = "1"
  }
}
```

**Purpose**: Prevents the password from changing on every `terraform apply`
unless we explicitly bump the version number.

### 2. Added Lifecycle Rules to All Cloud Scheduler Jobs

```hcl
resource "google_cloud_scheduler_job" "process_reminders" {
  # ... existing configuration ...

  # Force replacement when the secret changes
  lifecycle {
    replace_triggered_by = [
      random_password.cron_secret
    ]
  }
}
```

**Applied to:**

- `google_cloud_scheduler_job.process_reminders`
- `google_cloud_scheduler_job.check_secrets`
- `google_cloud_scheduler_job.process_downgrades`

**Purpose**: When `random_password.cron_secret` changes (due to keeper version
bump or resource recreation), Terraform will automatically destroy and recreate
all Cloud Scheduler jobs with the new secret value.

## How It Works

### Normal Apply (No Secret Change)

```bash
terragrunt apply
```

- Secret keeper version unchanged → `random_password` stays the same
- Cloud Scheduler jobs not modified
- No disruption

### When Secret Needs Rotation

```bash
# Edit cron.tf and change keeper version from "1" to "2"
terragrunt apply
```

Terraform will:

1. Destroy old `random_password.cron_secret` (version "1")
2. Create new `random_password.cron_secret` (version "2")
3. Update Secret Manager with new value
4. Detect `replace_triggered_by` on Cloud Scheduler jobs
5. Destroy all 3 Cloud Scheduler jobs
6. Recreate all 3 jobs with new secret in Authorization header
7. Cloud Run continues working (it reads from Secret Manager dynamically)

### State Drift Recovery

If the secret somehow gets out of sync (e.g., manual changes, state issues):

```bash
# Taint the secret to force regeneration
terragrunt taint random_password.cron_secret

# Apply will recreate secret AND all scheduler jobs
terragrunt apply
```

## Why Cloud Run Doesn't Need Updates

Cloud Run references the secret **dynamically** from Secret Manager:

```hcl
# From frontend.tf lines 220-223
env_from_key = {
  CRON_SECRET = {
    secret  = google_secret_manager_secret.cron_secret.id
    version = "latest"  # Always uses latest version
  }
}
```

When Secret Manager gets a new version:

- Cloud Run containers automatically get the new value on next restart
- No need to redeploy the service
- Health checks will automatically restart containers if needed

## Testing the Fix

After applying these changes:

```bash
# Apply the infrastructure changes
cd infrastructure/terragrunt/dev  # or staging/prod
terragrunt apply

# Verify Cloud Scheduler jobs have the correct secret
./scripts/diagnose-cron-state.sh staging

# Test the endpoints
./scripts/fix-cron-auth.sh staging
```

## Manual Override (If Needed)

If you need to manually update Cloud Scheduler without changing the secret:

```bash
# Get current secret
SECRET=$(gcloud secrets versions access latest \
  --secret=cron-authentication-secret-staging \
  --project=keyfate-dev)

# Update all scheduler jobs
for JOB in check-secrets process-reminders process-downgrades; do
  gcloud scheduler jobs update http keyfate-${JOB}-staging \
    --project=keyfate-dev \
    --location=us-central1 \
    --update-headers="Authorization=Bearer $SECRET"
done
```

## Future Secret Rotation

To rotate the secret:

1. **Edit** `infrastructure/apps/cron.tf`:

   ```hcl
   keepers = {
     version = "2"  # Increment this number
   }
   ```

2. **Apply** changes:

   ```bash
   cd infrastructure/terragrunt/staging
   terragrunt apply
   ```

3. **Verify** (automatic via lifecycle rules):
   - New secret generated and stored in Secret Manager
   - All Cloud Scheduler jobs recreated with new secret
   - Cloud Run picks up new secret automatically

4. **Test**:
   ```bash
   ./scripts/diagnose-cron-state.sh staging
   ```

## Rollback Plan

If something goes wrong:

```bash
# Revert the keeper version in cron.tf
# Then apply
terragrunt apply

# Or manually restore with old secret value
gcloud secrets versions access 1 \
  --secret=cron-authentication-secret-staging \
  --project=keyfate-dev

# Update scheduler jobs manually (see Manual Override above)
```

## Benefits

1. **Automatic synchronization** - No manual intervention needed
2. **Zero downtime** - Jobs recreated within seconds
3. **Consistent state** - Terraform ensures all resources stay in sync
4. **Easy rotation** - Just bump the keeper version
5. **State recovery** - Tainting the secret auto-fixes everything

## Related Files

- `infrastructure/apps/cron.tf` - Cloud Scheduler configuration
- `infrastructure/apps/frontend.tf` - Cloud Run configuration (lines 220-223)
- `scripts/diagnose-cron-state.sh` - Diagnostic tool
- `scripts/fix-cron-auth.sh` - Manual fix tool (still useful for emergencies)

## Migration Notes

For existing deployments:

```bash
# After deploying these changes, verify current state
cd infrastructure/terragrunt/staging
terragrunt plan

# Should show no changes if secret is already correct
# If it shows changes to scheduler jobs, apply them:
terragrunt apply
```

The first apply after this change will NOT recreate the jobs (because the secret
value hasn't changed). Future secret changes will automatically trigger job
recreation.
