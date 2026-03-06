# TODO

## Remaining Migration Tasks

See `openspec/changes/refactor-hosting-migration/tasks.md` for full checklist.

### Staging Verification

- [ ] Verify cron jobs execute successfully (check logs after next 15-min cycle)
- [ ] Verify SendGrid sender authentication works
- [ ] Run full smoke test: secret CRUD, check-in, payment flows

### Production

- [x] Add PostgreSQL plugin to production environment
- [x] Deploy to production on Railway
- [x] Run Drizzle migrations on production
- [ ] Configure custom domain (keyfate.com) DNS to Railway production
- [ ] Update Google OAuth callback URLs to production domain
- [ ] Update Stripe webhook URL to production domain
- [ ] Update BTCPay webhook URL to production domain
- [ ] Seed policy documents on production DB
- [ ] Full smoke test on production

### Railway Service Settings

- [ ] Set root directory to `frontend-svelte` in Railway production service
      settings (so GitHub-triggered deploys work, not just `railway up`)

### External Service Webhooks

- [ ] Stripe: add
      `https://dead-mans-switch-production.up.railway.app/api/webhooks/stripe`
- [ ] BTCPay: update webhook to
      `https://dead-mans-switch-production.up.railway.app/api/webhooks/btcpay`
      (or production domain once DNS is cut over)

### GCP Teardown (After Railway Production Verified)

- [ ] Disable Cloud Scheduler jobs
- [ ] Delete Cloud Run services (staging + production)
- [ ] Delete Cloud SQL instances (DESTRUCTIVE)
- [ ] Delete Bastion VMs
- [ ] Delete Artifact Registry repositories
- [ ] Remove VPC and networking resources
- [ ] Verify GCP billing drops to $0

## Future Work

- [ ] Add PostHog analytics (rewrite `add-posthog-analytics` for SvelteKit)
- [ ] Add static assets (favicon, logos) to `frontend-svelte/static/`
- [ ] Review and implement relevant items from archived
      `fix-security-scalability-issues` (DB indexes, OTP hardening, structured
      errors) as new proposals
