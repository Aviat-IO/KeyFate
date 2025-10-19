## Why

Users who sign up with email + password credentials currently have no
self-service method to recover their account if they forget their password. This
creates unnecessary support burden and poor user experience, especially for a
security-focused application where users may use complex passwords they don't
remember.

## What Changes

- Add "Forgot Password" link on sign-in page
- Create password reset request flow (email-based)
- Implement secure reset token generation and validation
- Add password reset completion page
- Store reset tokens in database with expiration (1 hour)
- Send password reset emails via existing email infrastructure
- Add middleware route exemptions for reset flow
- Create password reset API endpoints
- Implement rate limiting for password reset requests (3 per hour per email)
- Enhance password validation requirements (10 chars min, 1 uppercase, 1 number,
  1 symbol)
- **BREAKING**: Update sign-up to use same enhanced password requirements
- Update client-side validation in sign-up and sign-in forms

## Impact

- **Affected specs**: `authentication` (new capability spec to be created)
- **Affected code**:
  - `frontend/src/app/sign-in/page.tsx` - Add "Forgot Password" link
  - `frontend/src/lib/db/schema.ts` - Add `password_reset_tokens` table
  - `frontend/src/app/auth/forgot-password/page.tsx` - New page
  - `frontend/src/app/auth/reset-password/page.tsx` - Replace redirect stub with
    functional page
  - `frontend/src/app/api/auth/request-password-reset/route.ts` - New API
    endpoint
  - `frontend/src/app/api/auth/reset-password/route.ts` - New API endpoint
  - `frontend/src/middleware.ts` - Add public routes for reset flow
  - `frontend/src/lib/email/templates/` - Add password reset email template
  - `frontend/src/lib/auth/rate-limiting.ts` - Add password reset rate limit
    configs
  - `frontend/src/lib/auth/password.ts` - Enhance password validation with
    symbol requirement
  - `frontend/src/app/sign-up/page.tsx` - Update client-side validation and
    minLength
  - `frontend/src/app/sign-in/page.tsx` - Update minLength attribute
  - `frontend/src/app/api/auth/register/route.ts` - Use enhanced password
    validation
