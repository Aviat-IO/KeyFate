# Build Simplification Summary

## Changes Made

### 1. Dockerfile (frontend/Dockerfile)
**Changed**: Simplified to only accept BUILD_ENV argument
- Removed: All NEXT_PUBLIC_* build arguments
- Added: Logic to copy appropriate .env file based on BUILD_ENV
- Staging builds: Copy `.env.staging` to `.env.production`
- Production builds: Use `.env.production` as-is

### 2. Cloud Build Configuration (frontend/cloudbuild.yaml)
**Changed**: Reduced substitutions to essential parameters only
- Kept: `_IMAGE_URL` and `_BUILD_ENV`
- Removed: All `_NEXT_PUBLIC_*` and other environment-specific substitutions
- Simplified: Build process now relies on .env files instead of build args

### 3. Terraform Configuration (infrastructure/apps/frontend.tf)
**Changed**: Simplified Cloud Build invocation and runtime environment
- Removed: Complex substitutions string with all NEXT_PUBLIC_* variables
- Removed: Special character handling for commas and @ symbols
- Kept: Only `_IMAGE_URL` and `_BUILD_ENV` substitutions
- Updated: Runtime environment to only include essential overrides (NEXTAUTH_URL, NEXT_PUBLIC_ENV)

## How It Works Now

1. **Directory determines environment**:
   - `infrastructure/terragrunt/dev/` → `BUILD_ENV=staging`
   - `infrastructure/terragrunt/prod/` → `BUILD_ENV=production`

2. **Build process**:
   - Cloud Build receives only BUILD_ENV
   - Dockerfile copies the appropriate .env file
   - Next.js bakes environment variables into the build

3. **Configuration sources**:
   - Primary: `.env.staging` or `.env.production` files (in version control)
   - Runtime overrides: NEXTAUTH_URL and NEXT_PUBLIC_ENV from Terraform
   - Secrets: Injected at runtime from Google Secret Manager

## Benefits

1. **Simpler**: No more special character issues with substitutions
2. **Cleaner**: Configuration is centralized in .env files
3. **Consistent**: Same .env file structure as standard Next.js projects
4. **Maintainable**: Easy to update configuration without touching Terraform

## Testing

To test the changes:

```bash
# For staging deployment
cd infrastructure/terragrunt/dev
terragrunt apply

# For production deployment
cd infrastructure/terragrunt/prod
terragrunt apply
```

The build will automatically use the correct .env file based on the directory.