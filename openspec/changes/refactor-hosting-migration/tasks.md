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

- [ ] 2.1 Configure Railway cron jobs for all 7 scheduled endpoints:
  - `check-secrets` (every 15 min)
  - `process-reminders` (every 15 min)
  - `process-exports` (daily)
  - `process-deletions` (daily)
  - `process-subscription-downgrades` (daily)
  - `cleanup-tokens` (daily)
  - `cleanup-exports` (daily)
- [ ] 2.2 Verify cron authentication (HMAC tokens) works with Railway's cron
      invocation
- [ ] 2.3 Alternatively: implement in-app cron scheduler (node-cron or
      equivalent) if Railway cron is insufficient

## 3. Database Migration

- [ ] 3.1 Export schema from current Cloud SQL (or just run fresh migrations on
      Railway PG)
- [ ] 3.2 Run Drizzle migrations against Railway PostgreSQL
- [ ] 3.3 Verify all tables created correctly
- [ ] 3.4 Seed any required initial data (subscription tiers, policy documents)
- [ ] 3.5 Configure database backups (Railway provides daily snapshots on paid
      plans)

## 4. CI/CD Update

- [ ] 4.1 Update GitHub Actions to deploy to Railway (or use Railway's GitHub
      integration for auto-deploy)
- [ ] 4.2 Remove Cloud Build triggers and configs
- [ ] 4.3 Update Makefile: remove GCP deploy targets, add Railway targets if
      needed
- [ ] 4.4 Remove or archive `scripts/deploy-*.sh` scripts

## 5. Infrastructure Cleanup

- [ ] 5.1 Archive `infrastructure/` directory (do not delete history, just
      remove from active tree)
- [ ] 5.2 Remove GCP-specific environment variables from all configs
- [ ] 5.3 Remove Cloud SQL proxy configuration
- [ ] 5.4 Remove bastion host SSH configuration
- [ ] 5.5 Update `.env.example` to reflect Railway environment variables
- [ ] 5.6 Document Railway setup in README or `docs/`

## 6. Verification

- [ ] 6.1 Verify app deploys and starts on Railway
- [ ] 6.2 Verify database connectivity
- [ ] 6.3 Verify all cron jobs execute on schedule
- [ ] 6.4 Verify Stripe webhooks work with Railway URL
- [ ] 6.5 Verify BTCPay webhooks work with Railway URL
- [ ] 6.6 Verify Google OAuth callback URL updated
- [ ] 6.7 Verify SendGrid sender authentication
- [ ] 6.8 Verify health endpoints respond
- [ ] 6.9 Run full smoke test of auth, secret CRUD, check-in, payment flows

## 7. GCP Teardown (After Railway Verified)

- [ ] 7.1 Disable Cloud Scheduler jobs
- [ ] 7.2 Delete Cloud Run services
- [ ] 7.3 Delete Cloud SQL instances (DESTRUCTIVE - only after Railway is
      verified)
- [ ] 7.4 Delete Bastion VMs
- [ ] 7.5 Delete Artifact Registry repositories
- [ ] 7.6 Remove VPC and networking resources
- [ ] 7.7 Verify GCP billing drops to $0
