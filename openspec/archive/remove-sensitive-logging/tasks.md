# Implementation Tasks

## 1. Critical Security Fixes (Immediate)

- [ ] 1.1 Remove webhook signature logging in
      `frontend/src/lib/payment/providers/BTCPayProvider.ts:248-254`
- [ ] 1.2 Sanitize API key logging in
      `scripts/diagnose-payment-integration.js:78-79`
- [ ] 1.3 Verify no other webhook/signature exposure exists

## 2. PII Removal (High Priority)

- [ ] 2.1 Remove email logging in
      `frontend/src/lib/auth/require-email-verification.ts:28-31`
- [ ] 2.2 Remove email logging in
      `frontend/src/app/api/create-checkout-session/route.ts:63`
- [ ] 2.3 Remove email logging in `frontend/src/lib/auth/users.ts:94-95`
- [ ] 2.4 Remove email logging in
      `frontend/src/app/api/auth/verify-email-nextauth/route.ts`
- [ ] 2.5 Remove email logging in
      `frontend/src/lib/dashboard/dashboard-service.ts:45,67`
- [ ] 2.6 Audit remaining codebase for email/PII in logs

## 3. Session & Metadata Sanitization (High Priority)

- [ ] 3.1 Sanitize session config logging in
      `frontend/src/app/api/create-checkout-session/route.ts:107`
- [ ] 3.2 Sanitize Stripe checkout params logging in
      `frontend/src/lib/payment/providers/StripeProvider.ts:218-223`

## 4. Database Credentials Protection (High Priority)

- [ ] 4.1 Remove database connection details logging in
      `frontend/src/lib/db/connection.ts:54-60`
- [ ] 4.2 Remove database configuration logging in
      `frontend/src/lib/db/connection.ts:109-116`

## 5. Medium Priority Fixes

- [ ] 5.1 Update seed script passwords in `scripts/seed-local-db.js`
- [ ] 5.2 Update seed script passwords in `frontend/create-seed-users.js`
- [ ] 5.3 Add password strength warnings in seed scripts
- [ ] 5.4 Remove OTP rate limit logging in `frontend/src/lib/auth/otp.ts`
- [ ] 5.5 Sanitize Stripe key logging in
      `frontend/scripts/stripe/verify-stripe-config.js:7-8`

## 6. Logger Migration (Medium Priority)

- [ ] 6.1 Identify all console.log statements not gated by NODE_ENV
- [ ] 6.2 Replace production console.log with structured logger
- [ ] 6.3 Add development-only gates for debug logging
- [ ] 6.4 Update cron jobs to use structured logger

## 7. Testing & Validation

- [ ] 7.1 Test BTCPay webhook validation still works without debug logging
- [ ] 7.2 Test email verification flow works without email logging
- [ ] 7.3 Test database connection with sanitized logging
- [ ] 7.4 Test checkout session creation with sanitized logging
- [ ] 7.5 Run full test suite to ensure no regressions
- [ ] 7.6 Test seed scripts with updated passwords

## 8. Documentation & Review

- [ ] 8.1 Update security documentation with logging best practices
- [ ] 8.2 Add pre-commit hook to detect PII/secrets in logs (optional)
- [ ] 8.3 Document use of structured logger for future development
- [ ] 8.4 Review changes with security checklist
