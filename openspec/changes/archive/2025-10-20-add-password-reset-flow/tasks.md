## 1. Database Schema

- [ ] 1.1 Add `password_reset_tokens` table to schema.ts
- [ ] 1.2 Create and run database migration

## 2. Backend Implementation

- [ ] 2.1 Create password reset token generation utility
- [ ] 2.2 Add rate limit configs for password reset operations to
      rate-limiting.ts
- [ ] 2.3 Enhance password validation to require symbols (10 chars, 1 upper, 1
      number, 1 symbol)
- [ ] 2.4 Implement request-password-reset API endpoint with rate limiting
- [ ] 2.5 Implement reset-password API endpoint with token validation
- [ ] 2.6 Create password reset email template
- [ ] 2.7 Add password reset routes to middleware public routes

## 3. Frontend Implementation

- [ ] 3.1 Create forgot-password page (request form)
- [ ] 3.2 Update reset-password page (complete reset with token)
- [ ] 3.3 Add "Forgot Password" link to sign-in page
- [ ] 3.4 Update sign-up page client-side validation (10 chars, symbol
      requirement, minLength={10})
- [ ] 3.5 Update sign-in page password field (minLength={10})
- [ ] 3.6 Add success/error messaging for both flows with password requirement
      hints

## 4. Testing & Validation

- [ ] 4.1 Write unit tests for enhanced password validation
- [ ] 4.2 Write unit tests for token generation and validation
- [ ] 4.3 Write API endpoint tests including rate limiting
- [ ] 4.4 Manual testing of complete flow
- [ ] 4.5 Test token expiration (1 hour)
- [ ] 4.6 Test invalid/expired token handling
- [ ] 4.7 Test rate limiting (3 requests per hour)
- [ ] 4.8 Verify email template renders correctly
- [ ] 4.9 Run lint and typecheck

## 5. Security Verification

- [ ] 5.1 Verify tokens are cryptographically secure (crypto.randomBytes)
- [ ] 5.2 Verify tokens expire after 1 hour
- [ ] 5.3 Verify tokens are single-use (deleted after use)
- [ ] 5.4 Verify rate limiting prevents abuse (3 requests per hour per email)
- [ ] 5.5 Verify no password reset for OAuth-only users
- [ ] 5.6 Verify email verification required before password reset
- [ ] 5.7 Verify enhanced password requirements enforced (10 chars, 1 upper, 1
      number, 1 symbol)
