## Why

Password-based authentication is less secure than OTP-based authentication for
this use case. Passwords can be weak, reused across services, forgotten, or
compromised through phishing. OTP (One-Time Password) sent via email provides
better security by:

- Eliminating password storage risks (no hashed passwords in database)
- Removing user password management burden (no forgotten passwords)
- Providing time-limited authentication tokens that expire
- Leveraging email as a trusted second factor already required for the platform

## What Changes

- **UI BREAKING**: Hide password authentication UI, but keep backend code for
  future use
- Add OTP generation and validation system using time-limited tokens
- Replace credentials provider with email-based OTP authentication
- **Merge signup and login flows**: Single `/auth/signin` route handles both new
  and existing users
  - If email never seen before + valid OTP = automatic signup
  - If email exists + valid OTP = login
- Update email templates to support OTP delivery
- Keep password hashing (bcrypt) and reset code, but disable UI access
- Keep Google OAuth provider unchanged (already handles authentication
  externally)

## Impact

- **Affected specs**: authentication (new capability spec)
- **Affected code**:
  - Database schema: `frontend/src/lib/db/schema.ts` (extend
    verification_tokens, keep password column)
  - Auth provider: `frontend/src/lib/auth-config.ts` (add OTP credentials
    provider)
  - User management: `frontend/src/lib/auth/users.ts` (keep password functions,
    add OTP functions)
  - API routes: Merge `register/route.ts` into `signin/route.ts`, new OTP routes
  - Email service: `frontend/src/lib/email/email-service.ts` (add OTP template)
  - Frontend forms: Hide password UI, show OTP UI
  - Keep files: `frontend/src/lib/auth/password.ts`, password reset routes
    (disabled in UI)
- **Breaking change**: Password UI removed, but backend remains functional
- **No rollback needed**: Code remains, only UI changes
- **Development approach**: TDD - write failing tests first, implement to pass

## Success Criteria

### Functional Success

- [ ] 100% of test users can authenticate with OTP (new users auto-signup)
- [ ] Google OAuth login still works (100% success rate)
- [ ] All unit tests pass (100% coverage for OTP functions)
- [ ] All integration tests pass
- [ ] Password backend code still works (tested but not exposed in UI)

### Performance Success

- [ ] OTP generation: < 100ms p95
- [ ] OTP validation: < 200ms p95
- [ ] Email delivery: < 5 seconds p95
- [ ] Login flow completion: < 30 seconds p95 (including email check)

### Security Success

- [ ] Rate limiting blocks >3 requests/hour (verified in test)
- [ ] Expired OTPs are rejected (verified in test)
- [ ] Used OTPs cannot be reused (verified in test)
- [ ] Concurrent validation attempts handled correctly (atomic database
      operations)

### Operational Success

- [ ] Email delivery success rate: > 95%
- [ ] Zero downtime during deployment
- [ ] Monitoring dashboards operational
