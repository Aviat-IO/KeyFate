# Cloud Build Integration for Frontend Deployment

## Overview
The frontend container is now built using Google Cloud Build instead of requiring local Docker builds. This means `terragrunt apply` will automatically trigger Cloud Build to build and push the container image.

## What Changed

### 1. Dockerfile Update
- **Removed**: `ENV HOSTNAME="0.0.0.0"` which was causing OAuth redirect issues
- **Result**: OAuth now correctly uses NEXTAUTH_URL for callbacks

### 2. Cloud Build Configuration (`frontend/cloudbuild.yaml`)
- Defines the build steps for Cloud Build
- Builds the Docker image with all necessary build arguments
- Pushes to Artifact Registry automatically

### 3. Terraform Updates (`infrastructure/apps/frontend.tf`)
- Changed from local `docker build` to `gcloud builds submit`
- Cloud Build runs remotely on Google's infrastructure
- No local Docker daemon required

## How It Works

1. **Terraform detects changes** to frontend source files
2. **Triggers Cloud Build** via `gcloud builds submit`
3. **Cloud Build**:
   - Builds the Docker image with platform linux/amd64
   - Applies all build arguments (environment variables)
   - Pushes to Artifact Registry
4. **Cloud Run deployment** uses the new image

## Usage

### Deploy with Terragrunt
```bash
cd infrastructure/terragrunt/dev
terragrunt apply
```

This will:
- Detect if frontend files have changed
- Trigger Cloud Build if needed
- Deploy the new image to Cloud Run

### Manual Cloud Build (if needed)
```bash
cd frontend
gcloud builds submit .. \
  --project=YOUR_PROJECT_ID \
  --config=cloudbuild.yaml \
  --substitutions=_IMAGE_URL=us-central1-docker.pkg.dev/YOUR_PROJECT/apps/frontend:latest
```

## Build Arguments

The following environment variables are passed as build arguments:
- `BUILD_ENV`: "staging" or "production"
- `NEXT_PUBLIC_SITE_URL`: The public URL of the site
- `NEXT_PUBLIC_COMPANY`: Company name
- `NEXT_PUBLIC_PARENT_COMPANY`: Parent company name
- `NEXT_PUBLIC_SUPPORT_EMAIL`: Support email address
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe public key
- `NEXT_PUBLIC_AUTH_PROVIDER`: Authentication provider
- `NEXT_PUBLIC_DATABASE_PROVIDER`: Database provider
- `NEXT_PUBLIC_ENV`: Environment name

## Benefits

1. **No local Docker required**: Builds happen in the cloud
2. **Consistent builds**: Same environment every time
3. **Faster CI/CD**: Can trigger from GitHub directly
4. **Better caching**: Cloud Build maintains build cache
5. **Parallel builds**: Multiple builds can run simultaneously

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated
- Cloud Build API enabled in your GCP project
- Artifact Registry configured
- Proper IAM permissions for Cloud Build service account

## Special Characters Handling

Due to limitations with gcloud's `--substitutions` flag parsing, commas in substitution values (like "Aviat, LLC") are replaced with spaces during the build process. This is only for the build-time environment variables - the actual company name displayed in your application can still include the comma from runtime configuration.

## Troubleshooting

### Build Fails
Check Cloud Build logs:
```bash
gcloud builds list --limit=5 --project=YOUR_PROJECT_ID
gcloud builds log BUILD_ID --project=YOUR_PROJECT_ID
```

### Image Not Found
Verify the image was pushed:
```bash
gcloud artifacts docker images list \
  --repository=apps \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID
```

### Permission Issues
Ensure Cloud Build service account has these roles:
- `roles/artifactregistry.writer`
- `roles/cloudbuild.builds.builder`

## OAuth Fix Included

This deployment also includes the OAuth redirect fix:
- Removed `HOSTNAME="0.0.0.0"` from Dockerfile
- OAuth callbacks now correctly use the staging URL
- Google OAuth will redirect to `https://staging.keyfate.com/api/auth/callback/google`