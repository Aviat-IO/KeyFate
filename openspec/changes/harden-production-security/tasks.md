# Implementation Tasks

## 1. Foundation & Environment (Week 1)

### 1.1 Startup Validation

- [x] 1.1.1 Create `scripts/validate-env.js` to check all required environment
      variables
- [x] 1.1.2 Add validation for `ENCRYPTION_KEY` length (32-byte base64)
- [x] 1.1.3 Add validation for all auth tokens (`NEXTAUTH_SECRET`,
      `CRON_SECRET`, `ADMIN_TOKEN`)
- [x] 1.1.4 Add validation for database connection string format
- [x] 1.1.5 Add validation for email service credentials
- [x] 1.1.6 Add validation for payment provider credentials (Stripe/BTCPay)
- [x] 1.1.7 Update startup script to run validation before accepting traffic
- [x] 1.1.8 Document all required environment variables in `.env.local.example`
- [x] 1.1.9 Test validation script fails correctly for missing/invalid vars
- [x] 1.1.10 Test validation script passes with complete configuration

### 1.2 Database Infrastructure

- [x] 1.2.1 Configure explicit connection pool in
      `frontend/src/lib/db/drizzle.ts`
- [x] 1.2.2 Set connection pool max size (10 for dev, 20 for prod)
- [x] 1.2.3 Implement connection retry logic with exponential backoff
- [x] 1.2.4 Add connection pool metrics logging
- [x] 1.2.5 Test connection pool exhaustion handling
- [x] 1.2.6 Create database migration for new tables (privacy acceptance,
      webhook IDs)
- [x] 1.2.7 Add composite index on `secrets(userId, status)`
- [ ] 1.2.8 Test migration rollback procedures
- [ ] 1.2.9 Document backup strategy (Cloud SQL automated backups)
- [ ] 1.2.10 Test database restore from backup
- [ ] 1.2.11 Document RTO (4 hours) and RPO (24 hours) targets

### 1.3 Logging & Error Handling

- [x] 1.3.1 Audit all 40+ API route files for `console.log` with sensitive data
- [x] 1.3.2 Create `frontend/src/lib/logger.ts` with sanitization functions
- [x] 1.3.3 Implement structured logging with log levels (debug, info, warn,
      error)
- [x] 1.3.4 Add sensitive data redaction (server shares, secrets, tokens, keys)
- [x] 1.3.5 Replace console.log calls with structured logger
- [x] 1.3.6 Update error responses to return generic messages
- [x] 1.3.7 Log detailed errors server-side only with request context
- [x] 1.3.8 Test log sanitization with sample sensitive data
- [x] 1.3.9 Review logs in test environment for leaks
- [x] 1.3.10 Add automated scanning for sensitive patterns in logs

### 1.4 Health Checks

- [x] 1.4.1 Add database connectivity check to
      `frontend/src/app/api/health/route.ts`
- [x] 1.4.2 Add email service validation (test SMTP connection)
- [x] 1.4.3 Add encryption key validation check
- [x] 1.4.4 Return detailed status for each subsystem
- [x] 1.4.5 Add readiness vs liveness endpoint distinction
- [x] 1.4.6 Test health check failure scenarios
- [x] 1.4.7 Configure load balancer to use health endpoints

## 2. Authentication Hardening (Week 1-2)

### 2.1 OTP Strengthening

- [x] 2.1.1 Update `frontend/src/lib/auth/otp.ts` to generate 8-digit codes
- [x] 2.1.2 Reduce OTP expiration from 10 to 5 minutes
- [x] 2.1.3 Add global rate limit table to schema (`otp_attempts` by email)
- [x] 2.1.4 Implement per-email rate limiting (5 attempts per 15 minutes)
- [x] 2.1.5 Add account lockout after 10 failed attempts in 1 hour
- [x] 2.1.6 Update OTP email template for 8-digit code
- [x] 2.1.7 Test OTP generation produces valid 8-digit codes
- [x] 2.1.8 Test OTP expiration after 5 minutes
- [x] 2.1.9 Test rate limiting blocks excessive attempts
- [x] 2.1.10 Test account lockout and unlock mechanisms
- [x] 2.1.11 Draft user communication email about OTP changes

### 2.2 Email Verification Enforcement

- [x] 2.2.1 Add email verification check to
      `frontend/src/app/api/secrets/route.ts` POST
- [x] 2.2.2 Add email verification check to
      `frontend/src/app/api/secrets/[id]/route.ts` PUT
- [x] 2.2.3 Add email verification check to
      `frontend/src/app/api/recipients/route.ts` POST
- [x] 2.2.4 Add email verification check to
      `frontend/src/app/api/check-in/route.ts`
- [x] 2.2.5 Return 403 error with clear message for unverified users
- [x] 2.2.6 Test verified users can access protected endpoints
- [x] 2.2.7 Test unverified users blocked from protected endpoints
- [x] 2.2.8 Test middleware and API endpoint checks are consistent

### 2.3 Session Management

- [x] 2.3.1 Add idle timeout field to session schema (24 hours)
- [x] 2.3.2 Update `frontend/src/lib/auth-config.ts` to track last activity
- [x] 2.3.3 Implement idle timeout validation in middleware
- [x] 2.3.4 Expire idle sessions and require re-authentication
- [x] 2.3.5 Add re-authentication requirement to server share reveal endpoint
- [x] 2.3.6 Implement OTP-based re-authentication utility
- [ ] 2.3.7 Test idle timeout triggers after 24 hours
- [ ] 2.3.8 Test re-authentication required for server share access
- [ ] 2.3.9 Test active sessions not expired prematurely

### 2.4 Admin Authentication

- [x] 2.4.1 Remove fallback from
      `frontend/src/app/api/admin/email-failures/route.ts`
- [x] 2.4.2 Require `ADMIN_TOKEN` environment variable without default
- [x] 2.4.3 Return 500 error if `ADMIN_TOKEN` not configured
- [x] 2.4.4 Add IP whitelist configuration for admin endpoints
- [x] 2.4.5 Implement IP whitelist validation middleware
- [ ] 2.4.6 Add request signing with HMAC for admin operations
- [x] 2.4.7 Test admin endpoints reject requests without token
- [x] 2.4.8 Test admin endpoints reject requests from non-whitelisted IPs
- [x] 2.4.9 Test admin endpoints accept valid authenticated requests
- [x] 2.4.10 Document admin authentication setup in deployment guide

## 3. API Security (Week 2)

### 3.1 CSRF Protection

- [x] 3.1.1 Enable NextAuth CSRF tokens in `frontend/src/lib/auth-config.ts`
- [x] 3.1.2 Create CSRF utility in `frontend/src/lib/csrf.ts` with origin
      validation
- [x] 3.1.3 Add CSRF protection to secrets POST route
- [x] 3.1.4 Add CSRF protection to secrets PUT/DELETE routes
- [x] 3.1.5 Add CSRF protection to payment checkout routes
- [x] 3.1.6 Add CSRF protection to server share operations
- [ ] 3.1.7 Test CSRF validation rejects mismatched origins
- [ ] 3.1.8 Test CSRF validation accepts same-origin requests
- [ ] 3.1.9 Add CSRF to remaining authenticated endpoints
- [ ] 3.1.10 Document CSRF implementation in security docs

### 3.2 Rate Limiting

- [x] 3.2.1 Install and configure rate limiting library (ioredis or lru-cache)
- [x] 3.2.2 Create `frontend/src/lib/rate-limit.ts` utility
- [x] 3.2.3 Implement per-IP rate limiting (100 req/min baseline)
- [x] 3.2.4 Implement per-user rate limiting (50 req/min authenticated)
- [x] 3.2.5 Add rate limiting to `frontend/src/app/api/check-in/route.ts`
      (10/hour)
- [x] 3.2.6 Add rate limiting to `frontend/src/app/api/secrets/route.ts` POST
      (5/hour)
- [x] 3.2.7 Add rate limiting to `frontend/src/app/api/auth/verify-otp/route.ts`
      (see 2.1.4)
- [x] 3.2.8 Add rate limiting to
      `frontend/src/app/api/auth/request-otp/route.ts` (3/hour prod)
- [x] 3.2.9 Return 429 status with Retry-After header
- [ ] 3.2.10 Test rate limiting blocks excessive requests
- [ ] 3.2.11 Test rate limiting allows normal usage patterns
- [ ] 3.2.12 Test rate limiting resets after timeout period
- [ ] 3.2.13 Monitor rate limit hits in production

### 3.3 Webhook Security

- [x] 3.3.1 Add `webhook_events` table to schema with unique constraint on
      external ID
- [x] 3.3.2 Update `frontend/src/app/api/webhooks/stripe/route.ts` to record
      webhook IDs
- [x] 3.3.3 Update `frontend/src/app/api/webhooks/btcpay/route.ts` to record
      webhook IDs
- [x] 3.3.4 Reject duplicate webhook IDs with 200 status (idempotency)
- [x] 3.3.5 Add webhook event retention policy (30 days)
- [ ] 3.3.6 Test webhook replay attacks rejected
- [ ] 3.3.7 Test legitimate webhooks processed once
- [ ] 3.3.8 Test webhook cleanup after retention period

### 3.4 Cron Job Security

- [x] 3.4.1 Enhanced cron authentication in `frontend/src/lib/cron/utils.ts`
- [x] 3.4.2 Implement HMAC request signing with timestamp
- [x] 3.4.3 Reject requests older than 5 minutes (replay protection)
- [x] 3.4.4 Support both Bearer token and HMAC signature auth
- [ ] 3.4.5 Test cron authentication with valid HMAC signature
- [ ] 3.4.6 Test cron authentication rejects invalid signatures
- [ ] 3.4.7 Test cron authentication rejects old timestamps
- [ ] 3.4.8 Document HMAC signature generation for cron jobs

## 4. Monitoring & Compliance (Week 2-3)

### 4.1 Request Tracing

- [ ] 4.1.1 Create request ID middleware in `frontend/src/middleware.ts`
- [ ] 4.1.2 Generate unique request ID for each request (UUID v4)
- [ ] 4.1.3 Add request ID to response headers (`X-Request-ID`)
- [ ] 4.1.4 Include request ID in all log entries
- [ ] 4.1.5 Propagate request ID to database queries
- [ ] 4.1.6 Test request ID appears in logs and responses
- [ ] 4.1.7 Test request ID correlation across distributed operations

### 4.2 Privacy Policy Enforcement

- [x] 4.2.1 Add `privacy_policy_acceptance` table to schema
- [x] 4.2.2 Add acceptance checkbox to signup form
- [x] 4.2.3 Record acceptance timestamp and IP address
- [x] 4.2.4 Block signup without privacy policy acceptance
- [x] 4.2.5 Add privacy policy version tracking
- [x] 4.2.6 Implement re-acceptance flow for policy updates
- [ ] 4.2.7 Test signup requires privacy policy acceptance
- [ ] 4.2.8 Test existing users grandfathered (grace period)
- [ ] 4.2.9 Test policy update triggers re-acceptance

## 5. Testing & Validation (Week 3)

### 5.1 Integration Tests

- [ ] 5.1.1 Create integration test suite structure
- [ ] 5.1.2 Add authentication flow tests (OTP request, verify, login)
- [ ] 5.1.3 Add tier enforcement tests (Free limits, Pro limits, downgrade)
- [ ] 5.1.4 Add encryption/decryption tests (Shamir threshold, share
      reconstruction)
- [ ] 5.1.5 Add check-in system tests (token generation, validation, expiration)
- [ ] 5.1.6 Add payment webhook tests (Stripe success, BTCPay success, replay
      attack)
- [ ] 5.1.7 Add CSRF protection tests (valid token, invalid token, missing
      token)
- [ ] 5.1.8 Add rate limiting tests (below limit, at limit, exceeded limit)
- [ ] 5.1.9 Add email verification tests (verified access, unverified blocked)
- [ ] 5.1.10 Target >80% code coverage for security-critical paths
- [ ] 5.1.11 Run tests in CI/CD pipeline

### 5.2 Security Testing

- [ ] 5.2.1 Run OWASP ZAP automated scan against staging environment
- [ ] 5.2.2 Test CSRF protection with automated tools
- [ ] 5.2.3 Test rate limiting with load testing tool (k6 or Artillery)
- [ ] 5.2.4 Attempt SQL injection on all form inputs
- [ ] 5.2.5 Attempt XSS attacks on user-generated content
- [ ] 5.2.6 Test session fixation and hijacking scenarios
- [ ] 5.2.7 Test authentication bypass attempts
- [ ] 5.2.8 Verify no sensitive data in logs after 24-hour observation
- [ ] 5.2.9 Test webhook replay attack prevention
- [ ] 5.2.10 Document all findings and remediations

### 5.3 Load Testing

- [ ] 5.3.1 Create load testing scenarios for check-in cron job
- [ ] 5.3.2 Test with 1,000 concurrent users checking in
- [ ] 5.3.3 Test with 10,000 secrets processed in single cron run
- [ ] 5.3.4 Verify database connection pool handles load
- [ ] 5.3.5 Verify rate limiting doesn't block legitimate traffic
- [ ] 5.3.6 Test secret creation under load (100 users creating secrets)
- [ ] 5.3.7 Monitor response times under load (<500ms p95)
- [ ] 5.3.8 Identify and fix performance bottlenecks

### 5.4 Deployment Validation

- [ ] 5.4.1 Deploy to staging environment with full configuration
- [ ] 5.4.2 Validate all environment variables set correctly
- [ ] 5.4.3 Run startup validation script successfully
- [ ] 5.4.4 Verify health checks pass for all subsystems
- [ ] 5.4.5 Test database migrations apply cleanly
- [ ] 5.4.6 Test rollback procedures work correctly
- [ ] 5.4.7 Verify backups running and restorable
- [ ] 5.4.8 Test monitoring alerts trigger correctly
- [ ] 5.4.9 Run full smoke test suite in staging
- [ ] 5.4.10 Document deployment runbook with rollback procedures

## 6. Documentation & Launch (Week 3)

### 6.1 Documentation

- [ ] 6.1.1 Update README with security features
- [ ] 6.1.2 Document all environment variables with examples
- [ ] 6.1.3 Document deployment checklist for production
- [ ] 6.1.4 Document backup and restore procedures
- [ ] 6.1.5 Document incident response procedures
- [ ] 6.1.6 Document rate limiting policies for API consumers
- [ ] 6.1.7 Create security.md with responsible disclosure policy
- [ ] 6.1.8 Update privacy policy with GDPR disclosures
- [ ] 6.1.9 Update terms of service with security obligations
- [ ] 6.1.10 Create operations runbook for on-call engineers

### 6.2 Pre-Launch

- [ ] 6.2.1 Send email notification about OTP changes to active users
- [ ] 6.2.2 Schedule deployment during low-traffic window
- [ ] 6.2.3 Prepare rollback plan if issues detected
- [ ] 6.2.4 Brief support team on new security features
- [ ] 6.2.5 Set up monitoring dashboard for launch metrics
- [ ] 6.2.6 Final review of all critical security changes
- [ ] 6.2.7 Get sign-off from security audit
- [ ] 6.2.8 Deploy to production
- [ ] 6.2.9 Monitor logs and metrics for first 24 hours
- [ ] 6.2.10 Post-deployment validation checklist completed
