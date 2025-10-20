## Context

KeyFate currently supports two authentication methods: Google OAuth and
email/password credentials. Users who authenticate with email/password have no
self-service password recovery mechanism. The existing `auth/reset-password`
page is a stub that redirects users to contact support.

This change implements a standard forgot password flow using secure,
time-limited reset tokens sent via email, following NextAuth.js best practices
and the project's existing security patterns.

## Goals / Non-Goals

**Goals:**

- Enable self-service password reset for credential-based users
- Maintain security with cryptographically secure tokens
- Integrate seamlessly with existing NextAuth.js configuration
- Use existing email infrastructure (Nodemailer/SendGrid/Resend)
- Follow zero-knowledge architecture principles (server never sees new password
  in plaintext during storage)

**Non-Goals:**

- Password reset for OAuth-only users (they reset through Google)
- SMS-based password reset (email only, per project constraints)
- Password reset without email verification (users must have verified email)
- Multi-factor authentication for password reset (future enhancement)

## Decisions

### Token Storage and Lifecycle

**Decision:** Store reset tokens in a dedicated `password_reset_tokens` table
separate from NextAuth's `verification_tokens` table.

**Rationale:**

- Clear separation of concerns (email verification vs password reset)
- Different expiration rules (1 hour vs 24 hours for email verification)
- Simpler to audit and manage independently
- Follows existing pattern used for email verification tokens

**Schema:**

```typescript
password_reset_tokens {
  id: uuid (primary key)
  userId: text (foreign key to users.id, cascade delete)
  token: text (unique, indexed)
  expires: timestamp
  createdAt: timestamp
}
```

### Token Generation

**Decision:** Use `crypto.randomBytes(32).toString('hex')` for token generation.

**Rationale:**

- Cryptographically secure random generation
- 64-character hex string provides sufficient entropy
- Matches existing patterns in codebase for verification tokens
- Node.js built-in, no additional dependencies

### Token Expiration

**Decision:** 1-hour expiration for reset tokens.

**Rationale:**

- Industry standard for password reset flows
- Balance between security and user convenience
- Shorter than email verification (24h) due to higher security risk
- Forces timely action while reset intent is fresh

### Email Integration

**Decision:** Reuse existing email infrastructure and template patterns.

**Rationale:**

- Consistency with email verification flow
- Already configured SendGrid/Resend providers
- Existing template utilities in `lib/email/`
- No new dependencies or configurations needed

### User Eligibility

**Decision:** Only allow password reset for users with:

1. Verified email address
2. Existing password (not OAuth-only users)

**Rationale:**

- Prevents reset for unverified accounts (security)
- OAuth users reset through their provider
- Aligns with existing email verification requirements
- Simplifies error handling and user messaging

### Rate Limiting

**Decision:** Implement rate limiting using existing `rate-limiting.ts`
infrastructure with:

- 3 password reset requests per hour per email address
- Separate rate limit for password reset completion (5 attempts per hour per
  token)

**Rationale:**

- Prevents spam and abuse of email system
- 3 requests/hour balances security with legitimate use (typos, email delivery
  issues)
- Reuses proven in-memory rate limiting system
- Consistent with existing verification email rate limits
- Reset completion limit prevents brute-force token guessing

**Configuration:**

```typescript
"request-password-reset": {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
},
"reset-password-attempt": {
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
}
```

**Storage:**

- In-memory rate limiting is acceptable for production
- Uses existing `Map<string, RateLimitEntry>` in `rate-limiting.ts`
- Rate limits will reset on Cloud Run pod restarts (acceptable trade-off)
- Periodic cleanup via `cleanupExpiredRateLimits()` prevents memory leaks

### Password Requirements

**Decision:** Enhance existing password validation to require minimum 10
characters, 1 uppercase, 1 number, and 1 symbol.

**Rationale:**

- Stronger security for password reset (higher risk operation)
- Aligns with modern security best practices (NIST guidelines)
- Prevents weak passwords that could be easily compromised
- Symbols significantly increase password complexity
- Apply same rules to both sign-up and password reset for consistency

**Migration:** Update `validatePassword()` in `lib/auth/password.ts`:

- Change minimum length from 8 to 10 characters
- Add special character requirement: `!/[@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/`
- Update error messages to guide users
- **BREAKING CHANGE**: Apply to both new sign-ups and password resets

**Frontend Updates Required:**

- Update `sign-up/page.tsx`: Change client-side validation from 8 to 10 chars,
  add symbol check
- Update `sign-up/page.tsx`: Change `minLength={8}` to `minLength={10}` on
  password inputs
- Update `sign-in/page.tsx`: Change `minLength={8}` to `minLength={10}` on
  password input
- Update `api/auth/register/route.ts`: Use enhanced `validatePassword()`
  function
- Add password requirement hints in error messages and placeholder text

**User Impact:**

- Existing users with 8-9 character passwords can still sign in (validation only
  on sign-up/reset)
- New sign-ups must meet enhanced requirements
- All password resets must meet enhanced requirements
- Users with weak passwords will be encouraged to update via password reset flow

### Alternatives Considered

**Alternative 1: Use NextAuth's built-in email provider**

- **Rejected:** NextAuth email provider is for passwordless magic links, not
  password reset
- Would require significant refactoring of credentials provider
- Doesn't fit our existing auth architecture

**Alternative 2: Send temporary password via email**

- **Rejected:** Security anti-pattern (password transmitted via email)
- Forces user to remember two passwords
- Violates principle of least privilege

**Alternative 3: Reuse verification_tokens table**

- **Rejected:** Different lifecycles and purposes
- Would require type/purpose discrimination
- Makes auditing more complex
- Tight coupling between unrelated features

## Risks / Trade-offs

**Risk: Token theft via email interception**

- **Mitigation:** Short 1-hour expiration, single-use tokens, HTTPS-only
- **Mitigation:** Tokens deleted immediately after use
- **Acceptance:** Standard industry practice; email is trusted channel

**Risk: Email delivery failure**

- **Mitigation:** Reuse existing email failure handling and retry logic
- **Mitigation:** User can request new token if email doesn't arrive
- **Monitoring:** Existing email failure tracking in `email_delivery_failures`
  table

**Risk: Brute force token guessing**

- **Mitigation:** 64-character cryptographically random tokens (2^256
  possibilities)
- **Mitigation:** 1-hour expiration limits attack window
- **Mitigation:** Rate limiting on reset completion (5 attempts per hour per
  token)
- **Mitigation:** Rate limiting on reset requests (3 per hour per email)

**Trade-off: User experience vs security**

- **Decision:** Prioritize security with 1-hour expiration
- **Rationale:** KeyFate is security-focused product; users expect strong
  security
- **Impact:** Users must complete reset within 1 hour or request new link

## Migration Plan

**Phase 1: Database Schema**

1. Add `password_reset_tokens` table via Drizzle migration
2. Run migration in development environment
3. Verify migration in staging
4. Deploy to production with backward compatibility (no breaking changes)

**Phase 2: Backend Implementation**

1. Implement API endpoints (`/api/auth/request-password-reset`,
   `/api/auth/reset-password`)
2. Add email template
3. Test with local database

**Phase 3: Frontend Implementation**

1. Create forgot-password page
2. Update reset-password page
3. Add link to sign-in page
4. Test complete user flow

**Phase 4: Deployment**

1. Deploy to staging environment
2. End-to-end testing on staging
3. Deploy to production
4. Monitor email delivery and error rates

**Rollback Plan:**

- API endpoints gracefully handle missing table (return 500)
- Frontend pages can be reverted independently
- Database migration can be rolled back if needed
- No existing functionality affected (purely additive)

## Open Questions

1. **Should we add rate limiting on password reset requests?**
   - **Answer:** Yes, 3 requests per hour per email address
   - **Reasoning:** Prevents spam/abuse while allowing legitimate retries; uses
     existing infrastructure

2. **Should we notify users when password reset is requested?**
   - **Answer:** Yes, send notification to user's email as security measure
   - **Implementation:** Include in reset request email: "If you didn't request
     this, ignore this email"

3. **Should we invalidate existing sessions when password is reset?**
   - **Answer:** Yes, for security best practice
   - **Implementation:** Delete user's sessions from `sessions` table after
     password reset

4. **How do we handle users who signed up with OAuth but later added a
   password?**
   - **Answer:** Allow password reset if password field is non-null
   - **Edge case:** Currently not possible in our flow, but design supports it
