# Cloud Build Configuration Fixes

## Issues Fixed

### 1. OAuth Redirect Issue (0.0.0.0)
**Problem**: Google OAuth was redirecting to `https://0.0.0.0:3000` instead of the staging URL.
**Solution**: Removed `ENV HOSTNAME="0.0.0.0"` from Dockerfile

### 2. TypeScript Build Errors
**Problem**: Multiple TypeScript errors preventing build
**Solutions**:
- Fixed `NextAuthOptions` import → changed to `AuthOptions` from `next-auth/core/types`
- Fixed callback signatures
- Removed unsupported properties like `trustHost`

### 3. Cloud Build Integration
**Problem**: Local Docker builds required for deployment
**Solution**: Configured `gcloud builds submit` to use Cloud Build instead

### 4. Special Characters in Build Arguments
**Problem**: Comma in "Aviat, LLC" broke gcloud substitutions parsing
**Solution**: Replace comma with space during build (only affects build-time variables)

### 5. Missing Substitution Variable
**Problem**: `_NEXT_PUBLIC_ENV` was not defined in cloudbuild.yaml
**Solution**:
- Changed `${_ENV}` to `${_NEXT_PUBLIC_ENV}` in build args
- Added `_NEXT_PUBLIC_ENV` to substitutions section

## Current Configuration

### cloudbuild.yaml
- Uses `${_NEXT_PUBLIC_ENV}` for the NEXT_PUBLIC_ENV build argument
- All substitution variables are properly defined
- Build runs on Cloud Build with E2_HIGHCPU_8 machine

### frontend.tf
- Uses `gcloud builds submit` instead of local Docker
- Handles special characters by replacing commas with spaces
- Properly passes all environment variables as substitutions

## Deployment Command
```bash
cd infrastructure/terragrunt/dev
terragrunt apply
```

This will:
1. Detect frontend changes via hash
2. Trigger Cloud Build (no local Docker needed)
3. Build container with OAuth fix
4. Push to Artifact Registry
5. Deploy to Cloud Run

## Environment Variables
The following are passed as build arguments:
- `BUILD_ENV`: staging/production
- `NEXT_PUBLIC_SITE_URL`: https://staging.keyfate.com
- `NEXT_PUBLIC_COMPANY`: KeyFate
- `NEXT_PUBLIC_PARENT_COMPANY`: Aviat LLC (comma replaced with space)
- `NEXT_PUBLIC_SUPPORT_EMAIL`: support@aviat.io
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe key
- `NEXT_PUBLIC_AUTH_PROVIDER`: google
- `NEXT_PUBLIC_DATABASE_PROVIDER`: cloudsql
- `NEXT_PUBLIC_ENV`: staging