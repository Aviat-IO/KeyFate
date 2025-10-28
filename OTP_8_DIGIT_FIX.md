# OTP 8-Digit Sign-In Page Fix

## Problem Discovered

User reported that the sign-in page shows **6 OTP input fields** but the label
says "Enter 8-digit code" and the backend sends 8-digit codes.

![Issue Screenshot](https://via.placeholder.com/400x300.png?text=6+fields+for+8-digit+code)

## Root Cause

When we upgraded OTP from 6 to 8 digits:

- ✅ Backend generates 8-digit codes
- ✅ `OTPInput` component default is 8 fields
- ✅ Component tests updated for 8 digits
- ❌ **Sign-in page hardcoded `length={6}`**

**Location:** `frontend/src/app/auth/signin/page.tsx:251`

```tsx
// ❌ BEFORE (BUG)
<OTPInput
  length={6} // Hardcoded wrong value!
  onComplete={handleVerifyOTP}
  onChange={setOtpCode}
  disabled={isLoading}
/>;
```

## Changes Made

### 1. Sign-In Page (`src/app/auth/signin/page.tsx`)

**Fixed OTP input length:**

```diff
- <OTPInput length={6}
+ <OTPInput length={8}
```

**Fixed label:**

```diff
- Enter 6-digit code
+ Enter 8-digit code
```

**Fixed expiration time:**

```diff
- Codes expire after 10 minutes
+ Codes expire after 5 minutes
```

**Fixed Terms/Privacy links:**

```diff
- <Link href="/terms"
+ <Link href="/terms-of-service"

- <Link href="/privacy"
+ <Link href="/privacy-policy"
```

### 2. Integration Tests (`__tests__/app/signin-page.test.tsx`)

Created comprehensive integration test with **19 test cases**:

#### Email Step Tests (7 tests)

- ✅ Renders email input on initial load
- ✅ Shows Google sign-in button
- ✅ Shows Terms of Service and Privacy Policy links
- ✅ Auto-focuses email input on mount
- ✅ Validates email input is required
- ✅ Accepts valid email input
- ✅ Shows correct link URLs

#### OTP Step Tests (7 tests)

- ✅ **Shows exactly 8 OTP input fields** (critical regression test)
- ✅ Shows correct label for 8-digit code
- ✅ Shows success message with user email
- ✅ Shows resend countdown timer
- ✅ Shows "Codes expire after 5 minutes"
- ✅ Shows help text about spam folder
- ✅ Allows filling all 8 OTP digits

#### Error Handling Tests (3 tests)

- ✅ Shows error when OTP request fails
- ✅ Shows rate limit error with retry time
- ✅ Shows URL error parameter on mount

#### Regression Tests (2 tests)

- ✅ **No mismatch between label and input count**
- ✅ Accepts exactly 8 digits when pasting

## Test Results

```bash
✓ __tests__/app/signin-page.test.tsx (19 tests) 828ms

Test Files  1 passed (1)
     Tests  19 passed (19)
```

**Overall Suite:**

- Added: 19 new passing tests
- Total: 1,279 passing tests (was 1,260)
- Status: ✅ All sign-in tests passing

## Why Tests Didn't Catch This Initially

**We had:**

- ✅ Unit tests (OTP generation/validation)
- ✅ Component tests (OTPInput in isolation)

**We lacked:**

- ❌ **Integration tests** (full page rendering)
- ❌ **E2E tests** (actual user flow)

The component tests verified that `OTPInput` _can_ render 8 fields, but didn't
verify that the **sign-in page actually uses 8 fields**.

## Lessons Learned

1. **Component tests aren't enough** - Need integration tests for critical user
   flows
2. **Hardcoded props are dangerous** - When updating defaults, grep for all
   hardcoded values
3. **Visual inspection matters** - This was caught by manual testing, not
   automated tests

## Future Prevention

**Recommendations:**

1. Add E2E tests with Playwright (or use OWASP ZAP proposal)
2. Add visual regression testing (Percy/Chromatic)
3. Create a pre-deploy checklist for critical flows:
   - [ ] Sign-in flow works
   - [ ] OTP has correct number of fields
   - [ ] Email verification works
   - [ ] Payment flows work

## Files Changed

```
modified:   frontend/src/app/auth/signin/page.tsx
new file:   frontend/__tests__/app/signin-page.test.tsx
```

## Verification Steps

### Manual Testing

```bash
cd frontend
make dev
# Navigate to http://localhost:3000/auth/signin
# Click "Continue with Email"
# Verify 8 OTP input fields appear
```

### Automated Testing

```bash
cd frontend
pnpm test __tests__/app/signin-page.test.tsx
# Should show 19/19 tests passing
```

## Related Security Hardening Changes

This fix is part of the broader OTP strengthening effort:

- 8-digit codes (100M combinations vs 1M)
- 5-minute expiration (was 10)
- Rate limiting (3 requests/hour in prod)
- Global attempt tracking

See: `openspec/changes/harden-production-security/tasks.md`

---

**Status:** ✅ Fixed and tested\
**Date:** 2025-10-27\
**Tests Added:** 19 integration tests\
**Regression Risk:** Low (all tests passing, only UI changes)
