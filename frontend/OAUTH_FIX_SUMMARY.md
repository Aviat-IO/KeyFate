# OAuth Redirect Fix Summary

## Problem
When attempting to log in with Google OAuth, users were being redirected to `https://0.0.0.0:3000/api/auth/callback/google` instead of the actual staging URL.

## Root Cause
The Dockerfile contained `ENV HOSTNAME="0.0.0.0"` which was causing NextAuth to use `0.0.0.0` as the hostname for OAuth callback URLs instead of the proper `NEXTAUTH_URL` environment variable.

## Solution

### 1. Dockerfile Changes
- **Removed**: `ENV HOSTNAME="0.0.0.0"` from line 87 of the Dockerfile
- **Reason**: While `0.0.0.0` is correct for binding the server to all network interfaces, it should not be used as the hostname for OAuth callbacks
- **Result**: The Next.js standalone server will still bind to `0.0.0.0` by default in production mode, but OAuth callbacks will use the `NEXTAUTH_URL` environment variable

### 2. TypeScript Build Fixes
Fixed multiple TypeScript errors that were preventing the build:
- Changed `NextAuthOptions` import to `AuthOptions` from `next-auth/core/types`
- Fixed callback signatures in `auth-config.ts`
- Removed unsupported `trustHost` property from `AuthOptions`
- Removed unused `getToken` import from middleware

## Deployment Steps

1. **Rebuild the Docker image**:
   ```bash
   cd /Users/alancolver/dev/dead-mans-switch/frontend
   docker build -t frontend:latest .
   ```

2. **Tag for Google Container Registry**:
   ```bash
   docker tag frontend:latest gcr.io/YOUR_PROJECT_ID/frontend:latest
   ```

3. **Push to GCR**:
   ```bash
   docker push gcr.io/YOUR_PROJECT_ID/frontend:latest
   ```

4. **Deploy via Terraform**:
   ```bash
   cd ../infrastructure/terragrunt/dev
   terragrunt apply -target=module.apps.google_cloud_run_v2_service.frontend
   ```

Or use the provided deploy script:
```bash
cd /Users/alancolver/dev/dead-mans-switch/frontend
# Edit deploy.sh to set your PROJECT_ID
./deploy.sh
```

## Verification

After deployment, verify that:
1. The OAuth login flow redirects to Google correctly
2. Google redirects back to `https://staging.keyfate.com/api/auth/callback/google` (not `0.0.0.0`)
3. Users are successfully authenticated and redirected to the dashboard

## Important Environment Variables

Ensure these are set in your Cloud Run service:
- `NEXTAUTH_URL=https://staging.keyfate.com`
- `GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET=your-client-secret`
- `NEXTAUTH_SECRET=your-32-character-secret`

## Google Cloud Console OAuth Configuration

Verify these URLs are in your OAuth 2.0 Client ID configuration:

**Authorized JavaScript origins**:
- `https://staging.keyfate.com`

**Authorized redirect URIs**:
- `https://staging.keyfate.com/api/auth/callback/google`