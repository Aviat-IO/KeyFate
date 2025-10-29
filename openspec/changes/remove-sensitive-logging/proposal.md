# Remove Sensitive Data from Application Logs

## Why

Security review identified 16 instances where sensitive data (PII, secrets,
credentials) is logged to production console/logs. This violates GDPR/privacy
regulations and creates attack vectors if logs are compromised. Critical issues
include webhook signatures being exposed (allowing request forgery), user emails
in production logs, and API keys being partially revealed.

## What Changes

- **CRITICAL**: Remove webhook signature logging in BTCPay provider (allows
  request forgery)
- **CRITICAL**: Sanitize API key exposure in diagnostic scripts (reduces brute
  force entropy)
- **HIGH**: Remove all user email (PII) logging from production code (6
  locations)
- **HIGH**: Remove session configuration and metadata logging (exposes user
  data)
- **HIGH**: Remove database credential details from logs (username, password
  info)
- **MEDIUM**: Replace weak test passwords in seed scripts with secure defaults
- **MEDIUM**: Remove OTP rate limit configuration exposure
- **MEDIUM**: Gate all development logging behind NODE_ENV checks
- **LOW**: Replace console.log with structured logger throughout codebase

## Impact

- **Affected specs**: security (new capability)
- **Affected code**:
  - `frontend/src/lib/payment/providers/BTCPayProvider.ts` (webhook signature
    logging)
  - `scripts/diagnose-payment-integration.js` (API key exposure)
  - `frontend/src/lib/auth/require-email-verification.ts` (email logging)
  - `frontend/src/app/api/create-checkout-session/route.ts` (email + session
    config)
  - `frontend/src/lib/auth/users.ts` (email in verification flow)
  - `frontend/src/app/api/auth/verify-email-nextauth/route.ts` (email on
    verification)
  - `frontend/src/lib/payment/providers/StripeProvider.ts` (metadata logging)
  - `frontend/src/lib/db/connection.ts` (database credentials)
  - `frontend/src/lib/dashboard/dashboard-service.ts` (user emails)
  - `frontend/src/lib/auth/otp.ts` (rate limit config)
  - `frontend/scripts/stripe/verify-stripe-config.js` (API key partial exposure)
  - `scripts/seed-local-db.js` + `frontend/create-seed-users.js` (weak
    passwords)
  - Multiple files with ungated console.log statements
- **No breaking changes**: All changes are internal logging improvements
- **Migration**: None required
