# Frontend Environment Configuration

## Overview
The frontend uses environment files (.env) as the primary source of configuration. This approach ensures consistency and simplifies deployment across different environments.

## Environment Files

### Development
- `.env.development` - Development environment configuration
- `.env.development.local` - Local overrides (git-ignored)

### Staging
- `.env.staging` - Staging environment configuration
- `.env.staging.local` - Local overrides (git-ignored)

### Production
- `.env.production` - Production environment configuration
- `.env.production.local` - Local overrides (git-ignored)

## Build Process

### How It Works
1. During `terragrunt apply`, the directory determines the environment:
   - `infrastructure/terragrunt/dev/` → Uses `.env.staging`
   - `infrastructure/terragrunt/prod/` → Uses `.env.production`

2. Cloud Build receives only the `BUILD_ENV` parameter (staging or production)

3. The Dockerfile copies the appropriate .env file:
   - For staging builds: `.env.staging` is copied to `.env.production`
   - For production builds: `.env.production` is used as-is
   - Next.js automatically loads `.env.production` during build

4. Environment variables are baked into the build at compile time

### Runtime Overrides
While most configuration comes from .env files, some values can be overridden at runtime through Cloud Run:
- `NEXTAUTH_URL` - Always set from Terraform for OAuth callbacks
- `NEXT_PUBLIC_ENV` - Environment indicator

## Configuration Values

All NEXT_PUBLIC_* variables should be defined in the appropriate .env files:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_COMPANY`
- `NEXT_PUBLIC_PARENT_COMPANY`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_AUTH_PROVIDER`
- `NEXT_PUBLIC_DATABASE_PROVIDER`
- `NEXT_PUBLIC_BTCPAY_SERVER_URL`

Secret values are managed through Google Secret Manager and injected at runtime:
- `DATABASE_URL`
- `ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `BTCPAY_API_KEY`
- `BTCPAY_STORE_ID`
- `BTCPAY_WEBHOOK_SECRET`
- `CRON_SECRET`

## Local Development

For local development, create `.env.local` (git-ignored) with your local overrides:
```bash
cp .env.development .env.local
# Edit .env.local with your local settings
```

## Deployment

To deploy to staging:
```bash
cd infrastructure/terragrunt/dev
terragrunt apply
```

To deploy to production:
```bash
cd infrastructure/terragrunt/prod
terragrunt apply
```

The build process automatically uses the correct .env file based on the directory.