## 1. Write Unit Tests (TDD - Red Phase)

- [x] 1.1 Write tests for `generateOTP()` - verifies 6-digit numeric format
      using crypto.randomInt
- [x] 1.2 Write tests for `generateOTP()` collision handling (max 3 retry
      attempts)
- [x] 1.3 Write tests for `createOTPToken()` - verifies OTP storage with
      metadata (purpose, attempt_count)
- [x] 1.4 Write tests for `validateOTPToken()` - covers valid, invalid, expired
      scenarios
- [x] 1.5 Write tests for `validateOTPToken()` - concurrent validation attempts
      (race condition)
- [x] 1.6 Write tests for `invalidateOTPTokens()` - verifies marking old OTPs as
      expired
- [x] 1.7 Write tests for `checkOTPRateLimit()` - covers rate limiting logic (3
      per hour)
- [x] 1.8 Write tests for OTP email template rendering (HTML and plain text)
- [x] 1.9 Write tests for email delivery retry logic (2 retries, exponential
      backoff)
- [ ] 1.10 Write tests for request-otp API route (rate limiting, email sending)
- [ ] 1.11 Write tests for verify-otp API route (validation, session creation,
      auto-signup)
- [ ] 1.12 Write tests for unified signin flow (existing user vs new user)
- [x] 1.13 Run tests and confirm they fail (red phase)

## 2. Database Schema Changes (CRITICAL: Execute in Order)

- [x] 2.1 Create migration 001: Add `purpose` enum type ('email_verification' |
      'authentication')
- [x] 2.2 Create migration 002: Add `purpose` column to `verification_tokens`
      (default 'email_verification')
- [x] 2.3 Create migration 003: Add `attempt_count` integer to
      `verification_tokens` (default 0)
- [x] 2.4 Create migration 004: Create `otp_rate_limits` table with schema:
      `sql
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
  WHERE window_end > NOW();`
- [x] 2.5 Create migration 005: Add indexes to `verification_tokens`:
      `sql
CREATE INDEX idx_verification_tokens_identifier_purpose_expires 
  ON verification_tokens(identifier, purpose, expires) 
  WHERE expires > NOW();
CREATE INDEX idx_verification_tokens_expires 
  ON verification_tokens(expires) 
  WHERE expires <= NOW();`
- [ ] 2.6 Test all migrations are idempotent (can run multiple times safely)
- [ ] 2.7 Run migrations in development and verify schema changes
- [x] 2.8 KEEP password column in users table (do NOT drop)
- [x] 2.9 KEEP password_reset_tokens table (do NOT drop)

## 3. OTP Generation and Storage (TDD - Green Phase)

- [x] 3.1 Create `frontend/src/lib/auth/otp.ts` with `generateOTP()` function: -
      Use `crypto.randomInt(0, 999999)` padded to 6 digits - Add test to verify
      distribution is uniform - Add test to verify no predictable patterns
- [x] 3.2 Add collision detection to `generateOTP()`: - Check if code already
      exists for email (unused, not expired) - If collision, regenerate (max 3
      attempts) - If 3 collisions, throw error (log as critical - indicates RNG
      issue)
- [x] 3.3 Add `createOTPToken(email: string, purpose: 'authentication')`
      function to store OTP: - Store in verification_tokens with purpose,
      attempt_count - Invalidate previous unused OTPs for email (set expires =
      NOW()) - Return OTP code for sending via email
- [x] 3.4 Add `validateOTPToken(email: string, code: string)` function: - Use
      database transaction with SELECT FOR UPDATE (prevent race conditions) -
      Atomically check and mark as used in single query - Return user object if
      validation succeeds, or error details - Add test for concurrent validation
      attempts
- [x] 3.5 Add `invalidateOTPTokens(email: string)` function to mark old OTPs as
      expired
- [x] 3.6 Implement rate limiting in `checkOTPRateLimit(email: string)`: - Query
      otp_rate_limits for email within current hour window - Return true if
      count < 3, false if >= 3 - Create/update rate limit record
- [x] 3.7 Run tests and verify they pass (green phase)

## 4. Email Templates (TDD - Green Phase)

- [x] 4.1 Create OTP email template in `frontend/src/lib/email/templates.ts`: -
      HTML version with clear 6-digit code display - Plain text fallback
      version - Include expiration time (10 minutes) - Include security warning
      ("Don't share this code") - Include "Didn't request this?" message - Add
      "Check spam folder" guidance
- [x] 4.2 Add `renderOTPTemplate(email, code, expirationMinutes)` function
- [x] 4.3 Add `sendOTPEmail(email, code)` function to `email-service.ts`: - Call
      renderOTPTemplate - Send via SendGrid - Return success/failure status
- [x] 4.4 Implement email delivery retry logic: - 2 retries with exponential
      backoff (1s, 3s) - Log failures to email_failures table with retry
      metadata - Return success if any attempt succeeds
- [ ] 4.5 Add unit tests for email template rendering (snapshot tests)
- [ ] 4.6 Test email rendering in Gmail, Outlook, Apple Mail
- [ ] 4.7 Verify email passes spam filter tests (mail-tester.com)
- [ ] 4.8 Run template tests and verify they pass

## 5. API Routes (TDD - Green Phase)

- [x] 5.1 Create `frontend/src/app/api/auth/request-otp/route.ts`: - POST
      endpoint accepts email - Check rate limit via checkOTPRateLimit - Generate
      OTP via generateOTP - Store OTP via createOTPToken - Send email via
      sendOTPEmail - Do NOT reveal if email exists (security) - Return 200 even
      if email doesn't exist (prevent enumeration)
- [x] 5.2 Create `frontend/src/app/api/auth/verify-otp/route.ts`: - POST
      endpoint accepts email + code - Validate OTP via validateOTPToken - If
      valid and user exists: return success - If valid and user new: create user
      (auto-signup) - Return appropriate error messages (invalid, expired, too
      many attempts)
- [ ] 5.3 Merge register and login routes into unified signin: - Rename
      `/api/auth/register` to `/api/auth/signin` (or keep both pointing to same
      handler) - Update logic to auto-create users on first OTP success - Remove
      password requirement
- [ ] 5.4 Run API route tests and verify they pass
- [x] 5.5 KEEP password reset routes (do NOT remove): - Keep
      `frontend/src/app/api/auth/reset-password/route.ts` - Keep
      `frontend/src/app/api/auth/request-password-reset/route.ts` - These remain
      functional, just not exposed in UI

## 6. NextAuth Provider Updates (TDD - Green Phase)

- [x] 6.1 Update CredentialsProvider in `frontend/src/lib/auth-config.ts`: - Add
      new field: `otpCode` (string, required for OTP flow) - Keep: `email`
      (required) - Hide but keep: `password` field (for potential future use) -
      Add: `action` field ('otp' | 'password') to distinguish flows
- [x] 6.2 Update authorize function to support OTP validation: - If action ===
      'otp': validate via validateOTPToken - If action === 'password': validate
      via existing password logic (keep code) - Default to 'otp' if action not
      specified
- [x] 6.3 Add auto-signup logic in authorize function: - If OTP valid and user
      doesn't exist, create user - Return user object for session creation
- [ ] 6.4 Test authentication flow with OTP credentials
- [x] 6.5 Test authentication flow with password credentials (backend still
      works)
- [x] 6.6 Verify Google OAuth still works unchanged

## 7. Frontend Components

- [x] 7.1 Create unified signin page at `/auth/signin`: - Single email input
      field (no password visible) - "Send Code" button - Two-step flow: email
      entry → OTP entry - Show "We'll send a code to: user@example.com"
      confirmation - Add "Edit" button to correct email before sending
- [x] 7.2 Reuse existing `otp-input.tsx` component for 6-digit code entry: -
      Verify it supports numeric only - Verify paste support works - Verify
      keyboard navigation (arrow keys, tab)
- [x] 7.3 Add loading states: - "Sending code..." spinner during OTP request -
      "Verifying code..." spinner during validation - "Code sent! Check your
      email" success message with email address shown
- [x] 7.4 Add "resend OTP" functionality: - Show countdown timer (60 seconds
      before allowing resend) - Show rate limit feedback ("Too many attempts.
      Try again in X minutes") - First resend after 60s doesn't count toward
      rate limit
- [x] 7.5 Update error messages for OTP-specific scenarios: - "Invalid code"
      (with attempt counter: "4 attempts remaining") - "Code expired. Request a
      new one" - "Too many attempts. Please try again later" - "Email delivery
      failed. Please try again in 1 minute"
- [x] 7.6 Add help text and guidance: - "We'll email you a 6-digit code to sign
      in securely" - "Didn't receive your code? Check your spam folder" - Link
      to FAQ: "Why don't you use passwords?"
- [ ] 7.7 Add accessibility features: - ARIA labels on OTP input ("Enter digit 1
      of 6") - Screen reader announcement when OTP sent - Visible focus
      indicators - Keyboard navigation support
- [x] 7.8 Hide password input fields from all forms: - Use CSS display:none or
      conditional rendering - Keep form fields in code but don't render
- [x] 7.9 Hide password reset UI components: - Remove "Forgot password?" link
      from signin page - Keep password reset pages but make them inaccessible
      (no links)
- [x] 7.10 Merge registration and login pages: - Point both routes to same
      `/auth/signin` component - Remove separate registration form - Update all
      links to point to `/auth/signin`

## 8. Password Infrastructure (KEEP, DON'T REMOVE)

- [x] 8.1 KEEP `frontend/src/lib/auth/password.ts` (bcrypt functions remain)
- [x] 8.2 KEEP password-related functions in `frontend/src/lib/auth/users.ts`
- [x] 8.3 KEEP bcryptjs dependency in package.json
- [x] 8.4 KEEP password validation tests (mark as "password backend" tests)
- [ ] 8.5 Document password code retention: - Add comment: "Password code kept
      for potential future use / emergency fallback" - Add feature flag
      capability to re-enable password UI if needed

## 9. Integration Testing (TDD - Refactor Phase)

- [x] 9.1 Run all unit tests and verify they pass
- [ ] 9.2 Write integration tests for complete OTP authentication flow: - New
      user auto-signup scenario - Existing user login scenario - Concurrent
      validation attempts (race condition test)
- [ ] 9.3 Test email delivery success and failure scenarios: - Successful
      delivery - Retry logic (2 attempts with exponential backoff) - Final
      failure handling
- [ ] 9.4 Test rate limiting behavior: - 3 requests per hour limit - Rate limit
      reset after window expires - First resend after 60s doesn't count
- [ ] 9.5 Test validation attempt limiting: - 5 attempts per code - OTP
      invalidation after 5 failures
- [ ] 9.6 Test OTP expiration: - Expired code rejection - Cleanup job (daily
      deletion of old OTPs)
- [x] 9.7 Verify Google OAuth login still works
- [x] 9.8 Verify password backend still works (test but don't expose in UI)
- [ ] 9.9 Perform end-to-end testing in development environment
- [x] 9.10 Run full test suite and verify no regressions

## 10. Monitoring and Observability

- [ ] 10.1 Add metrics for OTP generation rate (per hour/day)
- [ ] 10.2 Add metrics for OTP validation success/failure rates
- [ ] 10.3 Add metrics for email delivery success/failure rates
- [ ] 10.4 Add metrics for rate limiting triggers
- [ ] 10.5 Set up alerts: - Alert if >10% email delivery failure rate - Alert if
      >50% OTP validation failure rate - Alert if SendGrid API returns 5xx
      errors
- [ ] 10.6 Add structured logging for OTP lifecycle: - Log: OTP generated
      (email, timestamp) - Log: OTP sent via email (success/failure) - Log: OTP
      validated (success/failure, attempt count) - Log: OTP expired/invalidated
- [ ] 10.7 Create monitoring dashboard for OTP system health: - Email delivery
      rate chart - OTP validation success rate chart - Rate limiting events
      chart - Active OTPs count

## 11. Data Retention and Cleanup

- [ ] 11.1 Create daily cleanup job for expired OTPs: - Delete
      verification_tokens where purpose='authentication' AND expires < NOW() -
      INTERVAL '24 hours'
- [ ] 11.2 Create daily cleanup job for rate limit records: - Delete
      otp_rate_limits where window_end < NOW() - INTERVAL '24 hours'
- [ ] 11.3 Schedule cleanup jobs to run at off-peak hours (e.g., 3 AM UTC)
- [ ] 11.4 Add logging for cleanup job execution (records deleted count)
- [ ] 11.5 Update privacy policy to document OTP data retention (24 hours)

## 12. Documentation

- [ ] 12.1 Update README.md to document OTP authentication: - Explain unified
      signin flow - Document auto-signup behavior - Note that password code
      remains for future use
- [ ] 12.2 Add environment variable documentation: - OTP_EXPIRATION_MINUTES
      (default: 10) - OTP_RATE_LIMIT_REQUESTS (default: 3) -
      OTP_RATE_LIMIT_WINDOW_HOURS (default: 1) - OTP_MAX_VALIDATION_ATTEMPTS
      (default: 5) - Keep existing password-related vars (BCRYPT_ROUNDS, etc.)
- [ ] 12.3 Document OTP security considerations: - Email security is critical -
      Short TTL and rate limiting mitigations - No email enumeration (returns
      200 even if email doesn't exist)
- [ ] 12.4 Update API documentation: - Document POST /api/auth/request-otp -
      Document POST /api/auth/verify-otp - Document merged signin route behavior
- [ ] 12.5 Add troubleshooting guide: - "Didn't receive OTP" → check spam, wait
      60s, resend - "Too many attempts" → wait for rate limit window to expire -
      "Email delivery failed" → check SendGrid status, retry in 1 min
