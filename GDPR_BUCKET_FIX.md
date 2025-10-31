# GDPR Export Bucket Fix

## Issue

Data exports were failing with a 404 error:

```
"message": "The specified bucket does not exist."
"reason": "notFound"
status: 404
```

## Root Cause

The Google Cloud Storage buckets for storing data exports were not created:

- `keyfate-exports-dev` (staging)
- `keyfate-exports-prod` (production)

The export service (`src/lib/gdpr/export-service.ts`) was trying to upload files
to these non-existent buckets.

## Fix Applied

### 1. Created Storage Buckets

```bash
# Created dev/staging bucket
gcloud storage buckets create gs://keyfate-exports-dev \
  --project=keyfate-dev \
  --location=us-central1 \
  --uniform-bucket-level-access

# Created production bucket
gcloud storage buckets create gs://keyfate-exports-prod \
  --project=keyfate-dev \
  --location=us-central1 \
  --uniform-bucket-level-access
```

### 2. Set Lifecycle Policies

Configured automatic deletion of old exports after 7 days to save storage costs:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 7 }
      }
    ]
  }
}
```

Applied to both buckets:

```bash
gcloud storage buckets update gs://keyfate-exports-dev --lifecycle-file=lifecycle.json
gcloud storage buckets update gs://keyfate-exports-prod --lifecycle-file=lifecycle.json
```

## Testing

### To Test the Fix:

1. Go to https://staging.keyfate.com/settings/privacy
2. Click "Request Export" button
3. Wait for cron job to run (or manually trigger):
   ```bash
   gcloud scheduler jobs run keyfate-process-exports-staging \
     --project=keyfate-dev \
     --location=us-central1
   ```
4. Check email for "Your Data Export is Ready" notification
5. Download the export file from the email link or settings page

### Verify Bucket Contents:

```bash
# List files in staging bucket
gcloud storage ls gs://keyfate-exports-dev/exports/

# List files in production bucket
gcloud storage ls gs://keyfate-exports-prod/exports/
```

## Environment Variables

The export service uses the `EXPORT_BUCKET` environment variable:

- **Dev/Staging:** defaults to `keyfate-exports-dev`
- **Production:** should be set to `keyfate-exports-prod`

Check that this is configured in your Cloud Run service environment.

## Related Files

- `frontend/src/lib/gdpr/export-service.ts` - Export generation and upload
- `frontend/src/app/api/cron/process-exports/route.ts` - Cron job that processes
  pending exports
- `infrastructure/apps/cron.tf` - Cloud Scheduler configuration

## Cleanup

The cron job `cleanup-exports` (defined in infrastructure) handles database
cleanup of expired export jobs. The GCS lifecycle policy handles automatic file
deletion after 7 days.
