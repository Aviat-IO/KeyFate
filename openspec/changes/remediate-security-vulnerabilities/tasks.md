# Tasks: Remediate Security Vulnerabilities

## Pre-Implementation

- [x] Review current dependency versions in `frontend/package.json`
- [x] Check Next.js 15.4.2 release notes for breaking changes
- [x] Check nodemailer 7.0.7 release notes for breaking changes
- [x] Create git branch for security updates (N/A - dependencies already
      upgraded)

## Dependency Upgrades

- [x] Upgrade `next` from `15.0.3` to `15.4.2` in `frontend/package.json`
      (already at 15.4.2)
- [x] Upgrade `nodemailer` from `7.0.6` to `7.0.7` in `frontend/package.json`
      (already at 7.0.7)
- [x] Check if `eslint-config-next` needs version alignment with Next.js
      (upgraded to 15.4.2)
- [x] Run `pnpm install` in `frontend/` directory
- [x] Verify `pnpm-lock.yaml` updated correctly

## Testing & Validation

- [x] Run `pnpm typecheck` in `frontend/` to ensure TypeScript compatibility
      (minor pre-existing test file issue, not blocking)
- [x] Run `pnpm lint` in `frontend/` to check for linting issues (passed with
      pre-existing warnings)
- [x] Run `pnpm test` in `frontend/` to execute full test suite (1162 passed, 24
      failed - pre-existing failures)
- [ ] Test authentication flows (Google OAuth login/logout) (manual testing
      recommended)
- [ ] Test email sending functionality (registration, reminders, disclosure)
      (manual testing recommended)
- [ ] Test secret creation and encryption flow (manual testing recommended)
- [ ] Test check-in functionality (manual testing recommended)
- [ ] Test payment flows (Stripe, BTCPay Server) (manual testing recommended)
- [ ] Run development server and smoke test critical paths (manual testing
      recommended)
- [x] Build production bundle (`pnpm build`) to verify no build errors (passed)

## Documentation

- [x] Document infrastructure cache vulnerabilities for future reference
      (documented in proposal.md)
- [ ] Update `CLAUDE.md` or security documentation if needed
- [ ] Create commit with clear security remediation message

## Infrastructure Cache Cleanup (Optional)

- [ ] Run `find infrastructure -name ".terragrunt-cache" -type d` to identify
      cache directories
- [ ] Document cache cleanup procedure for future maintenance
- [ ] Consider adding `.terragrunt-cache` cleanup to Makefile or deployment
      scripts

## Post-Implementation

- [ ] Re-run Snyk scan to verify vulnerabilities resolved
- [ ] Monitor application logs for any errors after deployment
- [ ] Update security audit tracking if maintained
- [ ] Schedule periodic dependency updates to prevent future vulnerabilities
