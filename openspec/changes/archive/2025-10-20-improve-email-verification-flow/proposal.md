# Improve Email Verification and Password Reset Flows

## Why

Users signing up with email/password experience poor UX due to unclear messaging and manual login requirements after email verification. The current flow shows a flash before redirecting to sign-in without informing users about the verification email, and after clicking the verification link, users must manually navigate to sign-in and re-enter credentials.

Additionally, users have no way to reset their password if they forget it, requiring manual intervention or account recreation.

## What Changes

### Email Verification Improvements

- Show clear, persistent message on sign-up explaining that a verification email was sent
- Automatically sign in users after they click the email verification link
- Redirect verified users directly to /dashboard instead of showing a toast with no action
- Add comprehensive test coverage for the complete sign-up and verification flow
- Email verification button already has white text styling (completed separately)

### Forgot Password Flow

- Add "Forgot Password?" link on sign-in page
- Create forgot password page with email input form
- Send password reset email with secure token
- Create password reset page that accepts token and new password
- Validate token expiration (e.g., 1 hour validity)
- Update password securely using bcrypt hashing
- Auto-login user after successful password reset
- Add comprehensive test coverage for password reset flow

## Impact

- Affected specs: user-authentication
- Affected code:
  - `frontend/src/app/sign-up/page.tsx` - Update success state to show verification message
  - `frontend/src/app/sign-in/page.tsx` - Add "Forgot Password?" link
  - `frontend/src/app/forgot-password/page.tsx` - New page for requesting password reset
  - `frontend/src/app/reset-password/page.tsx` - New page for resetting password with token
  - `frontend/src/app/api/auth/verify-email-nextauth/route.ts` - Return session token for auto-login
  - `frontend/src/app/api/auth/forgot-password/route.ts` - New API route to send reset email
  - `frontend/src/app/api/auth/reset-password/route.ts` - New API route to update password
  - `frontend/src/components/auth/email-verification-page-nextauth.tsx` - Handle auto-login on verification
  - Database schema updates for password reset tokens table
  - Email templates for password reset
  - New tests for sign-up, verification, and password reset flows
