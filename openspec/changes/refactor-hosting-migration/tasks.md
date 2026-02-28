## 1. Railway Setup

- [ ] 1.1 Create Railway account and project
- [ ] 1.2 Create Railway service from GitHub repo (connect to
      `refactor/rearchitect-sveltekit-nostr-bitcoin` branch)
- [ ] 1.3 Add PostgreSQL plugin to Railway project
- [ ] 1.4 Configure environment variables in Railway (port from Doppler/GCP
      Secret Manager)
- [ ] 1.5 Configure Railway to use the Dockerfile for builds
- [ ] 1.6 Configure custom domain (keyfate.com) DNS to Railway

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

- [ ] 3.1 Export schema from current Cloud SQL (or just run fresh migrations on
      Railway PG)
- [ ] 3.2 Run Drizzle migrations against Railway PostgreSQL
- [ ] 3.3 Verify all tables created correctly
- [ ] 3.4 Seed any required initial data (subscription tiers, policy documents)
- [ ] 3.5 Configure database backups (Railway provides daily snapshots on paid
      plans)

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

## 6. Verification

- [x] 6.1 Verify app builds successfully (bun run build)
- [x] 6.2 Verify all tests pass (103 tests across 8 files)
- [ ] 6.3 Verify app deploys and starts on Railway
- [ ] 6.4 Verify database connectivity on Railway
- [ ] 6.5 Verify all cron jobs execute on schedule
- [ ] 6.6 Verify Stripe webhooks work with Railway URL
- [ ] 6.7 Verify BTCPay webhooks work with Railway URL
- [ ] 6.8 Verify Google OAuth callback URL updated
- [ ] 6.9 Verify SendGrid sender authentication
- [ ] 6.10 Verify health endpoints respond
- [ ] 6.11 Run full smoke test of auth, secret CRUD, check-in, payment flows

## 7. GCP Teardown (After Railway Verified)

- [ ] 7.1 Disable Cloud Scheduler jobs
- [ ] 7.2 Delete Cloud Run services
- [ ] 7.3 Delete Cloud SQL instances (DESTRUCTIVE - only after Railway is
      verified)
- [ ] 7.4 Delete Bastion VMs
- [ ] 7.5 Delete Artifact Registry repositories
- [ ] 7.6 Remove VPC and networking resources
- [ ] 7.7 Verify GCP billing drops to $0
