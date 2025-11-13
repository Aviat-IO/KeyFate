# Cloud Run Deployment Fix Summary

## Overview
Fixed Cloud Run deployment failures for both dev (staging) and prod environments by ensuring proper database migration configuration.

## Requirements Addressed

### 1. Cloud Run Gen2 Migration ✅
**Status**: Already configured correctly
- `gen2_execution_environment = true` in `infrastructure/apps/frontend.tf` (line 262)
- No changes needed

### 2. Cloud SQL Public IP with Authorized Networks ✅
**Status**: Already configured correctly
- Public IP enabled in `infrastructure/apps/cloudsql.tf` (line 74)
- Authorized networks configured via `var.cloudsql_authorized_networks` (line 72)
- Both `dev/terraform.tfvars` and `prod/terraform.tfvars` have authorized networks defined
- No changes needed

### 3. Database Migrations in Cloud Run Startup ✅
**Status**: Fixed - migrations now use runtime DATABASE_URL

## Changes Made

### Files Modified

#### 1. `frontend/package.json`
**Changes**:
- Added `db:migrate:runtime` script to use DATABASE_URL from environment
- Kept environment-specific scripts for local development

**New scripts**:
```json
"db:migrate:staging": "drizzle-kit migrate --config=drizzle-staging.config.ts",
"db:migrate:production": "drizzle-kit migrate --config=drizzle-production.config.ts",
"db:migrate:runtime": "drizzle-kit migrate --config=drizzle-runtime.config.ts"
```

#### 2. `frontend/scripts/migrate-and-start.sh`
**Changes**:
- Simplified to use `db:migrate:runtime` which reads DATABASE_URL from Secret Manager
- DATABASE_URL contains Unix socket connection string injected by Cloud Run
- Removed environment-specific logic since DATABASE_URL is environment-aware

**Key improvement**:
```bash
MIGRATION_CMD="npm run db:migrate:runtime"
echo "📝 Using runtime database configuration (DATABASE_URL from Secret Manager)"
```

#### 3. `frontend/Dockerfile`
**Changes**:
- Added copy of `drizzle-runtime.config.ts` to container
- Ensures all necessary config files are available

#### 4. `frontend/drizzle-runtime.config.ts` (NEW FILE)
**Purpose**: Runtime configuration for Cloud Run that uses DATABASE_URL environment variable

**Content**:
```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    table: "journal",
    schema: "drizzle",
  },
})
```

## How It Works

### Environment Flow

1. **Terraform Configuration** (`infrastructure/apps/frontend.tf`):
   - Sets `NEXT_PUBLIC_ENV` to `var.env` (staging/production)
   - Injects `DATABASE_URL` from Secret Manager via `env_from_key`

2. **DATABASE_URL Secret** (`infrastructure/apps/cloudsql.tf`):
   - Contains Unix socket connection: `postgresql://user:pass@/db?host=/cloudsql/CONNECTION_NAME`
   - Cloud Run mounts socket at `/cloudsql` automatically with Gen2

3. **Migration Startup** (`frontend/scripts/migrate-and-start.sh`):
   - Waits 10 seconds for Cloud SQL socket to initialize
   - Runs `npm run db:migrate:runtime` which uses DATABASE_URL
   - Retries up to 5 times with exponential backoff
   - Starts Next.js server after successful migration

4. **Drizzle Runtime Config** (`frontend/drizzle-runtime.config.ts`):
   - Reads `process.env.DATABASE_URL`
   - Uses Unix socket connection to Cloud SQL
   - Works for both staging and production (connection string is environment-specific)

## Verification Steps

### Pre-Deployment Checks
1. Verify `cloudsql_authorized_networks` is set in terraform.tfvars:
   ```bash
   grep cloudsql_authorized_networks infrastructure/terragrunt/*/terraform.tfvars
   ```

2. Verify DATABASE_URL secret exists in Secret Manager:
   ```bash
   gcloud secrets list --project=keyfate-dev
   gcloud secrets list --project=keyfate-prod
   ```

### Post-Deployment Validation
1. Check Cloud Run logs for migration success:
   ```bash
   gcloud run services logs read frontend --region=us-central1 --project=keyfate-dev --limit=50
   ```

2. Look for these log messages:
   - ✅ `DATABASE_URL is set`
   - ✅ `Using runtime database configuration`
   - ✅ `Database migrations completed successfully`
   - ✅ `Starting Next.js server...`

3. Test database connectivity:
   ```bash
   curl https://staging.keyfate.com/api/health
   curl https://keyfate.com/api/health
   ```

## Configuration Details

### Dev/Staging Environment
- **Project**: keyfate-dev
- **Environment**: staging
- **NEXT_PUBLIC_ENV**: staging
- **DATABASE_URL**: Unix socket to keyfate-postgres-staging
- **Custom Domain**: staging.keyfate.com
- **Authorized Networks**: Home, VPN, Home2 (from terraform.tfvars)

### Production Environment
- **Project**: keyfate-prod (NOTE: Actually uses keyfate-dev project based on proxy commands)
- **Environment**: production
- **NEXT_PUBLIC_ENV**: production
- **DATABASE_URL**: Unix socket to keyfate-postgres-production
- **Custom Domain**: keyfate.com
- **Authorized Networks**: Home, VPN, Home2 (from terraform.tfvars)

## Security Considerations

1. **Public IP Security**:
   - Cloud SQL public IP is restricted to authorized networks only
   - Only specified IP addresses can connect directly
   - Cloud Run uses Unix socket (doesn't count against authorized networks)

2. **Secret Management**:
   - DATABASE_URL stored in Secret Manager
   - Injected at runtime by Cloud Run
   - Never exposed in container image or logs (only first 50 chars shown)

3. **Migration Security**:
   - Runs as nextjs user (non-root)
   - Uses Unix socket for secure local connection
   - Migrations run before application serves traffic

## Deployment Commands

### Dev/Staging
```bash
cd infrastructure/terragrunt/dev
terragrunt apply
```

### Production
```bash
cd infrastructure/terragrunt/prod
terragrunt apply
```

## Troubleshooting

### If migrations fail:
1. Check DATABASE_URL secret value matches connection name
2. Verify Cloud SQL instance is running
3. Check authorized networks allow your deployment source
4. Review Cloud Run logs for detailed error messages

### If startup probe fails:
1. Increase `initial_delay_seconds` if migrations take longer
2. Check `failure_threshold` allows enough time (currently 5 minutes)
3. Verify application starts on port 3000

### Database connection issues:
1. Verify Unix socket mount is working: `/cloudsql`
2. Check Cloud SQL service account has cloudsql.client role
3. Ensure DATABASE_URL uses correct connection name format

## Notes

- **Local Development**: Use `db:migrate:staging` or `db:migrate:production` with cloud-sql-proxy
- **Cloud Run**: Automatically uses `db:migrate:runtime` via startup script
- **Config Files**:
  - `drizzle-staging.config.ts` - Local dev against staging DB
  - `drizzle-production.config.ts` - Local dev against prod DB
  - `drizzle-runtime.config.ts` - Cloud Run runtime (both environments)
