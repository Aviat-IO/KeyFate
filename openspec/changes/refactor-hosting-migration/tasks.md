## 1. Railway Setup

- [x] 1.1 Create Railway account and project
- [x] 1.2 Create Railway service from GitHub repo (connect to
      `refactor/rearchitect-sveltekit-nostr-bitcoin` branch)
- [x] 1.3 Add PostgreSQL plugin to Railway project (staging)
- [x] 1.4 Configure environment variables in Railway (migrated from GCP Secret
      Manager + Cloud Run env vars to both staging and production)
- [x] 1.5 Configure Railway to use the Dockerfile for builds (root dir =
      frontend-svelte)
- [ ] 1.6 Configure custom domain (keyfate.com) DNS to Railway
- [ ] 1.7 Add PostgreSQL plugin to Railway production environment

## 2. Cron Jobs

- [x] 2.1 Implement in-app cron scheduler using node-cron (scheduler.ts) with
      all 7 endpoints: check-secrets (_/15), process-reminders (_/15),
      process-exports (daily), process-deletions (daily),
      process-subscription-downgrades (daily), cleanup-tokens (daily),
      cleanup-exports (daily)
- [x] 2.2 Wire scheduler into SvelteKit server via hooks.server.ts init() hook
- [x] 2.3 Add CRON_ENABLED env var to disable scheduler in dev
- [x] 2.4 Add scheduler tests (4 tests passing)

## 3. Database Migration

- [x] 3.1 Run fresh Drizzle migrations on Railway PostgreSQL (staging)
- [x] 3.2 Verify all tables created correctly (staging)
- [ ] 3.3 Seed required initial data (policy documents) on staging
- [ ] 3.4 Configure database backups (Railway provides daily snapshots on paid
      plans)
- [ ] 3.5 Run Drizzle migrations on production PostgreSQL

## 4. CI/CD Update

- [x] 4.1 Update GitHub Actions CI for SvelteKit + Bun + Docker build step
- [x] 4.2 Remove old Next.js test workflow (test.yml)
- [x] 4.3 Update Makefile: remove GCP deploy targets, bastion tunnels, Doppler
      sync, add build target
- [x] 4.4 Remove GCP deploy scripts (deploy-staging.sh, deploy-prod.sh,
      validate-infrastructure.js, verify-cron-fix.sh, trigger-reminders.sh,
      diagnose-payment-integration.js)

## 5. Infrastructure Cleanup

- [x] 5.1 Archive `infrastructure/` directory (git rm)
- [x] 5.2 Remove GCP-specific environment variables from .env.example
      (GOOGLE_CLOUD_REGION, EXPORT_BUCKET, PUBLIC_DATABASE_PROVIDER)
- [x] 5.3 Remove Cloud SQL proxy configuration (not needed with Railway)
- [x] 5.4 Remove bastion host SSH configuration from Makefile
- [x] 5.5 Update `.env.example` to reflect Railway environment variables
      (AUTH_SECRET, AUTH_GOOGLE_ID, CRON_ENABLED, PORT)
- [x] 5.6 Replace @google-cloud/storage with local filesystem for GDPR exports
- [x] 5.7 Update cleanup-exports cron job to use local filesystem deletion
- [x] 5.8 Remove @google-cloud/storage dependency
- [x] 5.9 Update health endpoint to use Railway env vars instead of GCP/Vercel
- [x] 5.10 Remove databaseProvider from /api/config (GCP-specific)
- [x] 5.11 Remove NEXT_PUBLIC_ fallbacks from /api/config endpoint
- [ ] 5.12 Remove old Next.js `frontend/` directory from repo

## 6. Verification (Staging)

- [x] 6.1 Verify app builds successfully (bun run build)
- [x] 6.2 Verify all tests pass (303 tests across 14 files)
- [x] 6.3 Verify app deploys and starts on Railway (staging)
- [x] 6.4 Verify database connectivity on Railway (staging - migrations ran)
- [x] 6.5 Fix Auth.js basePath 500 error (removed dual @auth/core versions)
- [x] 6.6 Verify auth login works on staging
- [ ] 6.7 Verify all cron jobs execute on schedule
- [ ] 6.8 Verify health endpoints respond
- [ ] 6.9 Update Google OAuth callback URLs to Railway staging domain
- [ ] 6.10 Verify Stripe webhooks work with Railway URL
- [ ] 6.11 Verify BTCPay webhooks work with Railway URL
- [ ] 6.12 Verify SendGrid sender authentication
- [ ] 6.13 Run full smoke test of secret CRUD, check-in, payment flows

## 7. Production Deploy

- [ ] 7.1 Add PostgreSQL plugin to production environment
- [ ] 7.2 Deploy to production on Railway
- [ ] 7.3 Run Drizzle migrations on production
- [ ] 7.4 Update DNS (keyfate.com) to point to Railway
- [ ] 7.5 Update Google OAuth callback URLs to production domain
- [ ] 7.6 Update Stripe webhook URL to production
- [ ] 7.7 Update BTCPay webhook URL to production
- [ ] 7.8 Verify production auth, secrets, payments work end-to-end

## 8. GCP Teardown (After Railway Production Verified)

- [ ] 8.1 Disable Cloud Scheduler jobs
- [ ] 8.2 Delete Cloud Run services
- [ ] 8.3 Delete Cloud SQL instances (DESTRUCTIVE - only after Railway is
      verified)
- [ ] 8.4 Delete Bastion VMs
- [ ] 8.5 Delete Artifact Registry repositories
- [ ] 8.6 Remove VPC and networking resources
- [ ] 8.7 Verify GCP billing drops to $0
