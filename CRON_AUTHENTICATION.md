# Cron Authentication Configuration

## Overview

The Dead Man's Switch application uses Google Cloud Scheduler to trigger periodic jobs for checking secrets and sending reminders. These cron endpoints require authentication to prevent unauthorized access while allowing Cloud Scheduler to invoke them without user sessions.

## Authentication Flow

### Cloud Scheduler → Cron Endpoints

Cloud Scheduler jobs authenticate using Bearer token authentication:

1. **Terraform generates** a random 32-character secret (`CRON_SECRET`)
2. **Secret Manager stores** the secret securely
3. **Cloud Scheduler sends** requests with `Authorization: Bearer <CRON_SECRET>` header
4. **Cron endpoints validate** the Bearer token against the environment variable
5. **Middleware bypasses** NextAuth session checks for `/api/cron/*` routes

## Implementation Details

### Cron Endpoints

Two cron endpoints are configured:

- **`/api/cron/process-reminders`** - Sends reminder emails for upcoming check-ins
- **`/api/cron/check-secrets`** - Triggers expired secrets and sends notifications

Both endpoints:
- Accept only POST requests
- Require `Authorization: Bearer <CRON_SECRET>` header
- Return 401 Unauthorized if authentication fails
- Return 200 OK with processing results if successful

### Authentication Code

```typescript
function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ||
    req.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice(7).trim();
  const cronSecret = process.env.CRON_SECRET;

  return !!cronSecret && token === cronSecret;
}
```

### Middleware Configuration

The NextAuth middleware is configured to allow cron routes to bypass session authentication:

```typescript
// In src/middleware.ts
if (pathname.startsWith("/api/cron/")) {
  return true; // Bypass session auth, use Bearer token instead
}
```

## Infrastructure Setup

### Terraform Configuration

The infrastructure automatically configures:

1. **Random Secret Generation**
   ```hcl
   resource "random_password" "cron_secret" {
     length  = 32
     special = true
     upper   = true
     lower   = true
     numeric = true
   }
   ```

2. **Secret Manager Storage**
   ```hcl
   resource "google_secret_manager_secret" "cron_secret" {
     secret_id = "cron-authentication-secret-${var.env}"
     # ... configuration
   }
   ```

3. **Cloud Run Environment Variable**
   ```hcl
   env_from_key = {
     CRON_SECRET = {
       secret  = google_secret_manager_secret.cron_secret.id
       version = "latest"
     }
   }
   ```

4. **Cloud Scheduler Jobs**
   ```hcl
   http_target {
     http_method = "POST"
     uri         = "${var.next_public_site_url}/api/cron/process-reminders"

     headers = {
       "Authorization" = "Bearer ${random_password.cron_secret.result}"
       "Content-Type"  = "application/json"
     }
   }
   ```

### Service Account Permissions

The Cloud Scheduler service account has the following permissions:
- `roles/cloudscheduler.serviceAgent` - Run scheduled jobs
- `roles/secretmanager.secretAccessor` - Access the cron secret
- `roles/run.invoker` - Invoke Cloud Run services

## Security Features

### Protection Mechanisms

1. **Strong Secret**: 32-character random secret with uppercase, lowercase, numbers, and special characters
2. **HTTPS Only**: All traffic is encrypted via Cloud Run's HTTPS endpoint
3. **Secret Manager**: Credentials stored in Google Secret Manager, not in code or environment files
4. **No Session Required**: Cloud Scheduler doesn't need browser sessions or OAuth
5. **Case-Sensitive Tokens**: Token comparison is case-sensitive for additional security
6. **Whitespace Trimming**: Leading/trailing whitespace is trimmed from tokens
7. **Header Flexibility**: Accepts both `Authorization` and `authorization` headers

### Attack Mitigation

- **Brute Force**: Cloud Run rate limiting and Cloud Armor protection
- **Replay Attacks**: HTTPS prevents token interception
- **Token Exposure**: Secrets never logged or exposed in error messages
- **Unauthorized Access**: 401 responses don't reveal token format or validity

## Testing

Comprehensive test suite validates:

1. **Rejection Cases**
   - Requests without Authorization header
   - Requests with invalid Bearer token
   - Requests with malformed headers
   - Requests when CRON_SECRET is not set
   - Empty Bearer tokens
   - Wrong-case tokens (case-sensitive)

2. **Acceptance Cases**
   - Valid Bearer token authentication
   - Uppercase and lowercase header names
   - Whitespace trimming

3. **Security Requirements**
   - Secret strength (minimum 32 characters)
   - No secret exposure in error messages
   - HTTPS enforcement

Run tests:
```bash
cd frontend
npm test -- __tests__/api/cron-authentication.test.ts
```

## Deployment

### Staging

```bash
cd infrastructure/terragrunt/dev
terragrunt apply
```

This will:
1. Generate a new random `CRON_SECRET`
2. Store it in Secret Manager
3. Configure Cloud Scheduler jobs with the secret
4. Deploy the frontend with the secret available via environment variable

### Production

```bash
cd infrastructure/terragrunt/prod
terragrunt apply
```

Same process as staging, but with production environment.

### Verifying Deployment

Check Cloud Scheduler jobs:
```bash
# List jobs
gcloud scheduler jobs list --project=<project-id>

# Describe a specific job
gcloud scheduler jobs describe keyfate-process-reminders-<env> \
  --project=<project-id> \
  --location=<region>

# Force a job to run (for testing)
gcloud scheduler jobs run keyfate-process-reminders-<env> \
  --project=<project-id> \
  --location=<region>
```

Check logs:
```bash
# Cloud Run logs
gcloud logs read \
  --project=<project-id> \
  --resource-names=service/frontend \
  --filter='resource.type="cloud_run_revision" AND textPayload:"[check-secrets]"' \
  --limit=50 \
  --format=json

# Cloud Scheduler logs
gcloud logs read \
  --project=<project-id> \
  --resource-names=cloud_scheduler_job/keyfate-process-reminders-<env> \
  --limit=50 \
  --format=json
```

## Troubleshooting

### 401 Unauthorized Errors

**Symptom**: Cloud Scheduler jobs return 401 errors

**Possible Causes**:
1. `CRON_SECRET` environment variable not set in Cloud Run
2. Cloud Scheduler using wrong/old secret value
3. Middleware not excluding `/api/cron/*` routes

**Solutions**:
```bash
# Check environment variables
gcloud run services describe frontend \
  --region=<region> \
  --project=<project-id> \
  --format='value(spec.template.spec.containers[0].env)'

# Verify secret in Secret Manager
gcloud secrets versions access latest \
  --secret=cron-authentication-secret-<env> \
  --project=<project-id>

# Check Cloud Scheduler job configuration
gcloud scheduler jobs describe keyfate-process-reminders-<env> \
  --project=<project-id> \
  --location=<region> \
  --format=json | jq '.httpTarget.headers'
```

### 307 Redirect Errors

**Symptom**: Requests redirect to `/sign-in`

**Possible Causes**:
1. Middleware not excluding `/api/cron/*` routes
2. Session check happening before Bearer token validation

**Solution**: Verify middleware configuration includes:
```typescript
if (pathname.startsWith("/api/cron/")) {
  return true;
}
```

### Database Connection Errors

**Symptom**: Cron jobs return 500 errors with database errors

**Possible Causes**:
1. VPC connector not configured
2. Cloud SQL not accessible from Cloud Run
3. Database credentials invalid

**Solutions**: Check VPC connector and Cloud SQL configuration in Terraform.

## Manual Testing

### Using curl

```bash
# Get the secret from Secret Manager
CRON_SECRET=$(gcloud secrets versions access latest \
  --secret=cron-authentication-secret-<env> \
  --project=<project-id>)

# Test process-reminders endpoint
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/cron/process-reminders

# Test check-secrets endpoint
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/cron/check-secrets
```

### Expected Responses

**Success (200 OK)**:
```json
{
  "processed": 0,
  "timestamp": "2025-10-02T19:00:00.000Z"
}
```

**Unauthorized (401)**:
```json
{
  "error": "Unauthorized"
}
```

**Server Error (500)**:
```json
{
  "error": "Database operation failed",
  "message": "Connection timeout",
  "timestamp": "2025-10-02T19:00:00.000Z"
}
```

## Environment Variables

### Required Variables

- `CRON_SECRET` - 32-character random secret for authenticating cron requests
  - Source: Google Secret Manager
  - Set by: Terraform during deployment
  - Used by: Cron endpoint authentication

### Optional Variables

- `DEBUG_DB` - Enable database query logging (set to "true" in staging)

## Related Files

- `/frontend/src/app/api/cron/process-reminders/route.ts` - Process reminders endpoint
- `/frontend/src/app/api/cron/check-secrets/route.ts` - Check secrets endpoint
- `/frontend/src/middleware.ts` - NextAuth middleware with cron route exclusion
- `/infrastructure/apps/cron.tf` - Terraform configuration for Cloud Scheduler
- `/infrastructure/apps/frontend.tf` - Cloud Run configuration with CRON_SECRET
- `/__tests__/api/cron-authentication.test.ts` - Authentication test suite

## References

- [NextAuth.js Middleware](https://next-auth.js.org/configuration/nextjs#middleware)
- [Google Cloud Scheduler](https://cloud.google.com/scheduler/docs)
- [Google Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/overview)
