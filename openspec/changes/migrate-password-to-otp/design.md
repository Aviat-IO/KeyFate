## Context

The system currently uses email+password authentication with bcrypt hashing
alongside Google OAuth. Users must manage passwords with strict complexity
requirements (10+ chars, upper/lower/numbers/special chars). The platform
already requires email verification for all users and uses SendGrid for email
delivery. Migrating to OTP simplifies the authentication model and improves
security by eliminating password storage.

## Goals / Non-Goals

**Goals:**

- Replace password-based authentication UI with email OTP authentication
- Improve security by making OTP the default (but keep password code for future)
- Simplify user experience (no password to remember, unified signin flow)
- Maintain existing Google OAuth functionality unchanged
- Reuse existing email infrastructure (SendGrid) and verification token system
- Merge signup and login into single flow (auto-create users on first OTP
  success)

**Non-Goals:**

- SMS OTP support (email only for initial implementation)
- Multi-factor authentication (OTP replaces password, not adds to it)
- Passwordless magic links (using explicit OTP codes)
- Deleting password backend code (keep for potential future use)

## Decisions

### 1. OTP Storage and Format

- **Decision**: Store OTPs in existing `verification_tokens` table, extend for
  authentication use
- **Format**: 6-digit numeric codes (e.g., "123456") for better UX than long
  random strings
- **TTL**: 10 minutes expiration (balances security and usability)
- **Rate limiting**: Max 3 OTP requests per email per hour to prevent abuse
- **Alternatives considered**:
  - New `otp_codes` table: Rejected, adds unnecessary complexity when
    verification_tokens can be reused
  - Alphanumeric codes: Rejected, harder to type and less user-friendly
  - 15-minute expiration: Rejected as too long, reduces security

### 2. Database Schema Changes

- **Decision**: Keep `password` field in `users` table (nullable), extend
  `verification_tokens` for OTP
- **Migration**: Add `purpose` enum field to `verification_tokens`
  ('email_verification' | 'authentication')
- **Cleanup**: Keep `password_reset_tokens` table for potential future use
- **Backwards compatibility**: Password backend code remains, only UI changes
- **Schema additions**:
  - `verification_tokens.purpose` enum
  - `verification_tokens.attempt_count` integer (default 0)
  - `otp_rate_limits` table for rate limiting tracking

### 3. Authentication Flow

- **Decision**: Unified signup/login flow (email → OTP → auto-signup or login)
  1. User enters email on `/auth/signin` page
  2. System sends 6-digit OTP to email (doesn't reveal if email exists)
  3. User enters OTP on verification page
  4. System validates OTP:
     - If user exists: Create session (login)
     - If user new: Create user + session (signup)
  5. User redirected to dashboard or callback URL

- **Alternatives considered**:
  - Separate signup/login pages: Rejected, unnecessary complexity
  - Magic link only: Rejected, less explicit user action
  - Combined email + OTP entry: Rejected, sends OTP before user intent is clear

### 4. NextAuth Provider Integration

- **Decision**: Replace CredentialsProvider with custom authorize logic that
  validates OTP
- **Session**: Keep JWT-based sessions (existing pattern)
- **Flow**: Authorize function validates OTP from verification_tokens table

### 5. Email Template

- **Decision**: Create new OTP email template with clear code display
- **Content**: Show 6-digit code prominently, include expiration time, security
  warning
- **Reuse**: Leverage existing `sendEmail` function and SendGrid infrastructure

### 6. Rate Limiting

- **Decision**: Implement rate limiting at API route level
- **Limits**:
  - 3 OTP requests per email per hour
  - 5 OTP validation attempts per code
- **Storage**: Track in database (new `otp_rate_limits` table)
- **Schema**:

```sql
CREATE TABLE otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_rate_limits_email_window
  ON otp_rate_limits(email, window_end)
  WHERE window_end > NOW();
```

### 7. OTP Code Generation

- **Decision**: Use cryptographically secure random number generator
- **Implementation**: `crypto.randomInt(0, 999999)` padded to 6 digits
- **Collision handling**: If same code exists for email (unlikely), regenerate
  (max 3 attempts)
- **Distribution**: Verify uniform distribution in tests

### 8. Database Indexes

- **Decision**: Add indexes to `verification_tokens` for OTP queries
- **Indexes**:

```sql
-- Index for finding active OTPs by email and purpose
CREATE INDEX idx_verification_tokens_identifier_purpose_expires
  ON verification_tokens(identifier, purpose, expires)
  WHERE expires > NOW();

-- Index for cleanup of expired tokens
CREATE INDEX idx_verification_tokens_expires
  ON verification_tokens(expires)
  WHERE expires <= NOW();
```

### 9. Race Condition Prevention

- **Decision**: Use atomic database operations for OTP validation
- **Implementation**: `SELECT FOR UPDATE` in transaction to prevent concurrent
  validation
- **Scenario**: Two simultaneous validation requests → only first succeeds
- **Test coverage**: Add test for concurrent validation attempts

## Risks / Trade-offs

### Security Risks

- **Risk**: Email account compromise = system access
  - **Mitigation**: Document that email security is critical; recommend strong
    email provider
  - **Note**: This is acceptable for the threat model (no worse than password
    reset flow)
  - **Security improvement**: Email compromise after login doesn't allow session
    hijacking (only new logins)

- **Risk**: OTP interception (email not encrypted in transit for some providers)
  - **Mitigation**: Short TTL (10 min), one-time use, rate limiting
  - **Note**: Email is already required trusted channel for this platform

- **Risk**: Race condition in concurrent OTP validation
  - **Mitigation**: Atomic database operations with `SELECT FOR UPDATE`
  - **Test coverage**: Integration test for concurrent requests

### User Experience Trade-offs

- **Trade-off**: Requires email access on every login vs. persistent password
  - **Pro**: No password to remember or manage
  - **Con**: Can't login without email access
  - **Mitigation**: Consider longer session duration (30 days already
    configured)

- **Trade-off**: Extra step (wait for email) vs. immediate password entry
  - **Pro**: Actually faster for users who don't remember password
  - **Con**: Slight delay waiting for email delivery
  - **Mitigation**: Optimize email delivery, show clear "check your email" UI

### Operational Risks

- **Risk**: Email provider (SendGrid) outage prevents all OTP logins
  - **Likelihood**: Low (SendGrid SLA: 99.95% uptime)
  - **Impact**: High (complete authentication failure for OTP users)
  - **Mitigation**:
    1. Google OAuth remains available as backup
    2. Monitor SendGrid status page
    3. Password backend code remains functional (can be re-enabled in emergency)
    4. Implement circuit breaker pattern (if 10 consecutive failures, show
       warning)

- **Risk**: Email delivery delays cause user frustration and rate limiting
  - **Likelihood**: Medium (SendGrid p95: 2-5 seconds, but can spike)
  - **Impact**: Medium (user frustration, support tickets)
  - **Mitigation**:
    1. Show "Email can take up to 60 seconds" message
    2. Allow 1 immediate resend after 60 seconds (doesn't count toward rate
       limit)
    3. Monitor delivery times, alert if p95 > 30 seconds
    4. Implement email delivery retry (2 retries with exponential backoff)

### Migration Risks

- **Risk**: Breaking change for any test users
  - **Mitigation**: App not yet launched in production, no real users to impact
  - **Fallback**: Google OAuth remains available, password code kept as backup

## Migration Plan

### Database Migration Sequencing

**CRITICAL**: Migrations must be executed in this exact order:

1. **Migration 001**: Create `purpose` enum type ('email_verification' |
   'authentication')
2. **Migration 002**: Add `purpose` column to `verification_tokens` (default
   'email_verification')
3. **Migration 003**: Add `attempt_count` integer to `verification_tokens`
   (default 0)
4. **Migration 004**: Create `otp_rate_limits` table with indexes
5. **Migration 005**: Add indexes to `verification_tokens` for OTP queries
6. **Test all migrations** are idempotent (can run multiple times safely)

### Pre-deployment (Development/Staging)

1. Write unit tests for OTP functionality (TDD approach)
2. Implement OTP functionality to pass tests
3. Test complete authentication flow in development
4. Verify Google OAuth still works
5. Verify password backend code still works (for emergency re-enable)

### Deployment Steps

1. Deploy database migrations 001-005 (add OTP infrastructure)
2. Deploy backend code changes (OTP generation, validation, merged signin route)
3. Deploy frontend changes (hide password UI, show OTP UI)
4. Verify OTP authentication works in production
5. Monitor for 48 hours (email delivery rate, validation success rate)

### Rollback Plan

- **Not needed**: Password code remains in backend, can be re-enabled via UI
  change
- If critical issues: Revert frontend to show password UI, hide OTP UI
- Database schema changes are additive (no data loss risk)

### Post-deployment

1. Monitor OTP delivery failures and authentication success rates
2. Set up alerts: >10% email delivery failure, >50% OTP validation failure
3. Update all documentation to reflect new authentication method
4. Create monitoring dashboard for OTP system health

## Data Retention and Privacy

### GDPR/CCPA Compliance

- **OTP Storage**: OTPs are personal data under GDPR
  - **Retention**: Automatically delete expired OTPs after 24 hours
  - **Purpose**: Authentication only (documented in privacy policy)
  - **User Rights**: Users can request deletion of unused OTPs

- **Rate Limit Data**: Email addresses in `otp_rate_limits` table
  - **Retention**: Delete records older than 24 hours
  - **Purpose**: Abuse prevention

- **Audit Trail**: `email_failures` table contains email addresses
  - **Retention**: 90 days for debugging, then delete

### Cleanup Jobs

- **Daily OTP cleanup**: Delete `verification_tokens` where
  `purpose =
'authentication'` AND `expires < NOW() - INTERVAL '24 hours'`
- **Daily rate limit cleanup**: Delete `otp_rate_limits` where
  `window_end <
NOW() - INTERVAL '24 hours'`

## Open Questions

1. **Should we keep password field as nullable for gradual migration?**
   - ✅ **RESOLVED**: Yes, keep password field and backend code for potential
     future use

2. **Should OTP codes be case-sensitive alphanumeric or numeric only?**
   - ✅ **RESOLVED**: Numeric only (6 digits) for better mobile UX

3. **Should we implement backup codes for users without email access?**
   - Recommendation: Defer to future iteration, out of scope for v1

4. **Should we rate limit by IP or by email?**
   - ✅ **RESOLVED**: By email primarily (prevents enumeration)

5. **Should signup and login be separate routes?**
   - ✅ **RESOLVED**: Merge into single `/auth/signin` route that auto-creates
     users on first OTP success

6. **Should we invalidate existing sessions on OTP login?**
   - Recommendation: No for v1 (better UX), add session management UI in v2
