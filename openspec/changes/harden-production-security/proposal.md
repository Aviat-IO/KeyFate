# Harden Production Security

## Why

KeyFate is a security-critical application handling highly sensitive user
secrets via client-side Shamir's Secret Sharing. A comprehensive production
readiness review identified 41 critical issues across 8 categories that prevent
safe public launch. The most severe issues include weak admin authentication
with hardcoded fallbacks, missing CSRF protection on state-changing operations,
insufficient rate limiting allowing brute-force attacks, weak 6-digit OTP
implementation vulnerable to enumeration, and potential server share exposure
through logging. These vulnerabilities violate the zero-knowledge security model
and could enable attackers to compromise user secrets, bypass authentication, or
gain unauthorized administrative access.

## What Changes

### Critical Security (8 Blockers - Must Fix)

- **BREAKING**: Remove hardcoded admin token fallback, require `ADMIN_TOKEN`
  environment variable, return 500 if not configured
- Implement CSRF token validation on all POST/PUT/DELETE API routes using
  NextAuth built-in protection
- Add per-IP and per-user rate limiting using Redis/in-memory store for
  check-in, secret creation, and OTP endpoints
- **BREAKING**: Strengthen OTP from 6 to 8 digits, reduce expiration from 10 to
  5 minutes, add global rate limit per email
- Audit and remove all sensitive data logging from 40+ API route files,
  implement structured logging with sanitization
- Add startup environment variable validation script that checks all required
  vars before accepting traffic
- Implement webhook replay attack prevention by storing processed webhook IDs in
  database
- Enforce email verification on all secret-related API endpoints, not just
  middleware

### High Priority (8 Issues)

- Implement automated daily database backups with documented RTO/RPO and tested
  restore procedures
- Configure explicit database connection pooling with limits and retry logic
- Add session idle timeout (24 hours) and require re-authentication for server
  share reveal
- Return generic error messages to clients, log detailed errors server-side only
- Add composite index on `(userId, status)` for tier limit queries
- Implement health check validation for email service connectivity
- Track privacy policy acceptance in database with timestamp on signup
- Add request ID middleware for distributed tracing

### Medium Priority (6 Issues)

- Centralize tier limit configuration in single source of truth
- Document and test database migration rollback procedures
- Add integration tests for authentication flows, tier enforcement, encryption,
  check-in system, payment webhooks
- Add IP whitelist for cron endpoints with request signing using timestamps
- Validate encryption key length at application startup
- Create comprehensive environment variable documentation with validation

## Impact

### Affected Specs

- `authentication` - OTP strengthening, email verification enforcement, session
  management
- `api-security` - CSRF protection, rate limiting, error handling, logging
  sanitization
- `infrastructure` - Startup validation, health checks, backup strategy,
  connection pooling
- `monitoring` - Structured logging, request tracing
- `data-protection` - Privacy policy enforcement

### Affected Code

- All 40+ API route files in `frontend/src/app/api/**/*` for CSRF, rate
  limiting, logging audit
- `frontend/src/lib/auth/otp.ts` for OTP strengthening
- `frontend/src/lib/auth-config.ts` for session timeout
- `frontend/src/lib/server-env.ts` for startup validation
- `frontend/src/lib/encryption.ts` for key validation
- `frontend/src/middleware.ts` for CSRF tokens
- `frontend/src/app/api/webhooks/**/*` for replay protection
- `frontend/src/lib/db/schema.ts` for new indexes and privacy tracking tables
- `frontend/src/lib/db/drizzle.ts` for connection pooling
- `frontend/src/app/api/health/route.ts` for enhanced health checks
- `frontend/src/app/api/admin/**/*` for admin authentication hardening
- `scripts/*` for backup and validation scripts

### Breaking Changes

- **BREAKING**: Admin endpoints require `ADMIN_TOKEN` environment variable
  without fallback
- **BREAKING**: OTP changes from 6 to 8 digits (affects all users on next login)
- **BREAKING**: OTP expiration reduced to 5 minutes (affects in-flight login
  attempts)
- **BREAKING**: Privacy policy acceptance required on signup (new database
  field)
- **BREAKING**: Startup fails if required environment variables not configured
- **BREAKING**: Additional authentication required for server share reveal
  endpoint

### Migration Path

1. Set all required environment variables in production before deployment
2. Run database migration to add privacy policy acceptance and webhook ID
   tracking tables
3. Deploy application with new validations enabled
4. Monitor logs for CSRF/rate limit violations in first 24 hours
5. Communicate OTP changes to active users via email notification

## Deployment Strategy

### Phase 1: Foundation (Week 1)

- Startup validation and environment variable documentation
- Database backups and connection pooling
- Logging audit and sanitization
- Health check enhancements

### Phase 2: Authentication Hardening (Week 1-2)

- OTP strengthening
- Email verification enforcement
- Session timeout and re-authentication
- Admin authentication hardening

### Phase 3: API Security (Week 2)

- CSRF protection implementation
- Rate limiting across all endpoints
- Error message sanitization
- Webhook replay protection

### Phase 4: Monitoring & Compliance (Week 2-3)

- Request ID tracing
- Privacy policy enforcement
- Integration test suite

### Phase 5: Validation (Week 3)

- Load testing
- Security audit
- Documentation review
- Production deployment

## Dependencies

- Redis or in-memory cache for rate limiting
- Automated backup infrastructure (Cloud SQL)
- Test environment for migration validation
- Security audit tools (OWASP ZAP, Burp Suite)

## Risks

### High Risk

- **OTP change impacts active users**: Mitigate with advance email notification
  and grace period
- **CSRF tokens may break existing integrations**: Validate all API consumers
  before deployment
- **Rate limiting may block legitimate users**: Start with generous limits,
  monitor and adjust
- **Startup validation may prevent deployment**: Thoroughly test with staging
  environment first

### Medium Risk

- **Performance impact from rate limiting**: Use efficient Redis cache and
  connection pooling
- **Logging changes may miss edge cases**: Comprehensive code audit with
  automated scanning tools
- **Privacy enforcement may block legacy users**: Implement grace period for
  existing accounts

### Low Risk

- **Connection pooling config**: Standard pattern, well-documented in Drizzle
- **Health check additions**: Non-breaking, additive changes only

## Success Criteria

- All 8 critical security blockers resolved
- Zero sensitive data logged in test environment over 24-hour period
- Rate limiting prevents brute-force attacks in penetration testing
- Startup validation catches missing environment variables in CI/CD
- Automated backups completing successfully with tested restore procedures
- Integration test suite covering critical security paths with >80% coverage
- Privacy policy acceptance tracked for 100% of new signups
- Independent security audit passes with no critical/high findings

## Related Changes

- `remediate-security-vulnerabilities` - Focuses on dependency updates (Next.js,
  nodemailer)
- `migrate-password-to-otp` - Already implemented OTP (this proposal strengthens
  it)
- `audit-payment-integration` - Payment security overlaps with webhook replay
  protection
- `add-gdpr-compliance` - Separate proposal handles GDPR data export/deletion
