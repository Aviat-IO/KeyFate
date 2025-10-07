# Check-In 307 Redirect to /verify-email Fix

## Issue Summary

When clicking the "Check In Now" button on the `/check-in?token=xxx` page, the API request to `/api/check-in` was being redirected with a 307 status code to `/auth/verify-email`, causing the check-in to fail.

**Affected Endpoint**: `POST /api/check-in?token=xxx`

## Root Cause

The middleware configuration had **incomplete exemptions** for the check-in API route:

1. ✅ **Session authentication exemption** - The `authorized` callback correctly allowed `/api/check-in` (line 82-84)
2. ❌ **Email verification exemption** - Missing from `verificationExemptRoutes` array

### What Happened
1. User clicked "Check In Now" button
2. Frontend sent POST request to `/api/check-in?token=xxx`
3. Middleware's `authorized` callback allowed the request through (no session required)
4. **BUT** the middleware function checked email verification
5. Since `/api/check-in` wasn't in `verificationExemptRoutes`, it redirected to `/auth/verify-email` with 307 status
6. Frontend received HTML redirect response instead of JSON
7. Check-in failed with "Server returned an error"

## Solution

Added `/api/check-in` to the `verificationExemptRoutes` array in `src/middleware.ts`:

```typescript
const verificationExemptRoutes = [
  "/auth/verify-email",
  "/auth/verify-email-nextauth",
  "/api/auth/verify-email",
  "/api/auth/verify-email-nextauth",
  "/api/auth/resend-verification",
  "/api/auth/verification-status",
  "/sign-in",
  "/auth/signup",
  "/auth/error",
  "/check-in", // Token-based authentication, not session-based
  "/api/check-in", // API endpoint also uses token-based auth
];
```

## Files Changed

1. **src/middleware.ts** - Added `/api/check-in` to `verificationExemptRoutes`
2. **__tests__/auth/check-in-route-access.test.ts** - Added regression test for API route
3. **docs/check-in-authentication.md** - Updated documentation with dual exemption requirements

## Testing

### New Regression Test
Added test case: "should not require email verification for API route (token-based auth)"

This test simulates:
- Authenticated user with `emailVerified: false`
- POST request to `/api/check-in?token=xxx`
- Verifies: Should NOT redirect to `/auth/verify-email`

### Test Results
```bash
✓ __tests__/auth/check-in-route-access.test.ts (12 tests) 141ms
  All tests passed
```

## Verification Steps

To verify the fix works:

1. **Setup**: Have a user account with unverified email and active session
2. **Action**: Navigate to `/check-in?token=xxx` from a reminder email
3. **Click**: Click "Check In Now" button
4. **Expected**: Check-in succeeds with success message
5. **Previous Bug**: 307 redirect to `/auth/verify-email` caused "Server returned an error"

## Technical Details

### Middleware Flow
```
POST /api/check-in?token=xxx
    ↓
withAuth authorized callback (line 82-84)
    ↓ ✅ Returns true (session auth not required)
    ↓
middleware function (line 32-44)
    ↓ Check: Is user authenticated AND email not verified?
    ↓ ❌ Previously: /api/check-in not in verificationExemptRoutes
    ↓ 307 redirect to /auth/verify-email
    ↓
    ↓ ✅ Now: /api/check-in in verificationExemptRoutes
    ↓ Request continues to route handler
    ↓
API route handler processes check-in
```

### Why Both Exemptions Are Needed

1. **Session authentication exemption** (`authorized` callback):
   - Allows unauthenticated users to access the endpoint
   - Necessary because users may not have active sessions when clicking email links

2. **Email verification exemption** (`verificationExemptRoutes` array):
   - Allows authenticated users with unverified emails to access the endpoint
   - Necessary because check-in uses token-based auth, not email verification status

## Related Documentation

- Check-in authentication flow: `docs/check-in-authentication.md`
- Middleware configuration: `src/middleware.ts`
- Test coverage: `__tests__/auth/check-in-route-access.test.ts`

## Impact

- **Severity**: High - Prevented all check-ins for users with active sessions
- **Affected Users**: Any user with an active session (verified or unverified email)
- **User Experience**: Check-in links now work correctly for all users

## Prevention

The regression test added in this fix will prevent this issue from recurring. The test explicitly checks that:
1. Page route `/check-in` doesn't require email verification
2. API route `/api/check-in` doesn't require email verification
3. Both routes work for authenticated users with unverified emails

## Commit Message

```
fix: prevent 307 redirect to verify-email on check-in API endpoint

The /api/check-in endpoint was missing from verificationExemptRoutes,
causing authenticated users with unverified emails to be redirected
with 307 status when attempting to check in.

Added /api/check-in to verificationExemptRoutes array to complement
the existing session auth exemption in the authorized callback.

- Updated middleware.ts with API route verification exemption
- Added regression test for API route with unverified email scenario
- Updated documentation with dual exemption requirements

Fixes 307 redirect issue where POST to /api/check-in redirected to
/auth/verify-email instead of processing the check-in request.
```
