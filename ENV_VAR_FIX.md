# Environment Variable Build-Time Fix

## Problem
`NEXT_PUBLIC_SUPPORT_EMAIL` was showing as empty `()` in the Pro tier features modal on staging, even though the variable was set in `.env.staging`.

## Root Cause
Next.js `NEXT_PUBLIC_*` variables must be available **at build time** to be inlined into the client-side JavaScript bundle. They cannot be injected at runtime.

The infrastructure was:
1. ✅ Passing `NEXT_PUBLIC_SUPPORT_EMAIL` as a runtime env var to Cloud Run (line 157 in frontend.tf)
2. ❌ **NOT** passing it as a build arg during Docker build
3. ❌ Result: The variable was undefined during build, so it was inlined as `undefined`

## Solution

### 1. Updated `frontend/Dockerfile`
Added `NEXT_PUBLIC_SUPPORT_EMAIL` as a build arg:

```dockerfile
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
```

### 2. Updated `frontend/cloudbuild.yaml`
Added the build arg to both the builder and final stages:

```yaml
- '--build-arg=NEXT_PUBLIC_SUPPORT_EMAIL=${_NEXT_PUBLIC_SUPPORT_EMAIL}'
```

### 3. Updated `infrastructure/apps/frontend.tf`
Added the variable to the gcloud build substitutions:

```hcl
--substitutions="...,_NEXT_PUBLIC_SUPPORT_EMAIL=${var.next_public_support_email}"
```

### 4. Updated `frontend/src/constants/tiers.ts`
Changed from importing from `@/lib/env` to direct `process.env` access:

```typescript
// Before (incorrect - uses server-side helper that returns empty on client)
import { NEXT_PUBLIC_SUPPORT_EMAIL } from "@/lib/env";
`Priority email support (${NEXT_PUBLIC_SUPPORT_EMAIL})`

// After (correct - inlined at build time by Next.js)
`Priority email support (${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@keyfate.com'})`
```

## How Next.js NEXT_PUBLIC_* Variables Work

1. **Build Time Inlining**: Next.js replaces all instances of `process.env.NEXT_PUBLIC_*` with the actual value during build
2. **Static in Bundle**: The value is baked into the JavaScript bundle
3. **No Runtime Changes**: You cannot change these values after build - they're literals in the code

Example:
```typescript
// During build with NEXT_PUBLIC_SUPPORT_EMAIL=help@example.com
const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

// Becomes in the built JavaScript:
const email = "help@example.com";
```

## Deployment Steps

1. **Commit these changes** to your repository
2. **Deploy via Terraform**:
   ```bash
   cd infrastructure/apps
   terragrunt apply
   ```
3. **Verify** the variable is now visible:
   - Check the Pro tier features modal
   - Should show: "Priority email support (your-email@example.com)"

## Important Notes

- ⚠️ **Build args are logged**: Build-time variables appear in Cloud Build logs (fine for non-sensitive data like support email)
- ⚠️ **Client-side exposure**: All `NEXT_PUBLIC_*` variables are exposed in the client-side bundle
- ✅ **Secrets use Secret Manager**: Sensitive values (API keys, secrets) should use Cloud Run's `env_from_key` from Secret Manager
- ✅ **Runtime env vars**: Server-side only variables can still be injected at runtime via Cloud Run env vars

## Other NEXT_PUBLIC_* Variables

The following variables are already correctly configured as build args:
- ✅ `NEXT_PUBLIC_SITE_URL`
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

If you add more `NEXT_PUBLIC_*` variables in the future, remember to:
1. Add to `Dockerfile` as ARG and ENV
2. Add to `cloudbuild.yaml` as `--build-arg`
3. Add to `frontend.tf` in the `--substitutions` parameter
