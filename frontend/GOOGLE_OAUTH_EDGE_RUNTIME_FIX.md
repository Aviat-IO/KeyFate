# Google OAuth Edge Runtime Fix

## Issue Summary

Google OAuth authentication was failing with the error:
```
The edge runtime does not support Node.js 'perf_hooks' module
```

This caused an infinite redirect loop where users who successfully authenticated with Google OAuth would be redirected between the dashboard and login page.

## Root Cause Analysis

1. **Google OAuth Success**: Users could successfully authenticate with Google and receive a valid JWT token
2. **Database Lookup Failure**: The middleware tried to look up the user in the database using `getUserById(token.sub)`
3. **Edge Runtime Incompatibility**: The database client (`postgres` package) uses Node.js modules like `perf_hooks` that aren't available in Edge Runtime
4. **Missing User Records**: OAuth users weren't being created in the database, so even if the database lookup worked, users wouldn't be found

## Solution Implementation

### 1. Fixed Middleware Runtime (✅ CRITICAL FIX)

**File**: `src/middleware.ts`

```typescript
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
  // Use Node.js runtime to support database operations with postgres package
  runtime: 'nodejs',
};
```

**Impact**: This resolves the Edge Runtime error and allows database operations in middleware.

### 2. Enhanced OAuth User Creation (✅ IMPROVEMENT)

**File**: `src/lib/auth-config.ts`

- Added database user creation during Google OAuth sign-in
- Enhanced JWT callback to store user ID from database
- Improved middleware to handle both `token.id` and `token.sub`

```typescript
async signIn({ account, profile, user }) {
  if (account?.provider === "google") {
    // Validate email verification
    // Create user in database if they don't exist
    const userData = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: googleProfile.name || null,
      image: googleProfile.picture || null,
      emailVerified: new Date(), // Google email is verified
      password: null, // No password for OAuth users
    };
    await db.insert(users).values(userData);
  }
}
```

### 3. Improved Error Handling

**File**: `src/middleware.ts`

- Better handling of missing user IDs in tokens
- Graceful fallback when database operations fail
- Detailed logging for debugging

```typescript
// Get user ID from token (prefer custom id over sub for OAuth users)
const userId = (token as any)?.id || token.sub;
if (!userId) {
  console.log("[Middleware] No user ID found in token, redirecting to login");
  return createLoginRedirect(req, "Invalid session token");
}
```

## Testing

Created comprehensive test suite in `__tests__/auth/middleware-google-oauth.test.ts`:

- ✅ Google OAuth users work without Edge Runtime errors
- ✅ Missing users are handled gracefully
- ✅ Database errors don't crash the application
- ✅ Malformed tokens are rejected safely
- ✅ Public routes work without database queries

## Architecture Notes

### Why Node.js Runtime vs Edge Runtime?

| Aspect | Edge Runtime | Node.js Runtime |
|--------|-------------|-----------------|
| **Performance** | Faster cold starts | Slightly slower |
| **Features** | Limited APIs | Full Node.js APIs |
| **Database** | ❌ Limited drivers | ✅ Full support |
| **Use Case** | Simple middleware | Complex operations |

**Decision**: Node.js runtime is required for database operations in middleware.

### Session Strategy

We maintain JWT sessions (not database sessions) for performance:
- JWT tokens contain user ID
- Middleware validates user exists in database on protected routes
- OAuth users are created in database during sign-in for consistency

## Deployment Considerations

1. **Environment Variables**: Ensure `NEXTAUTH_SECRET` is properly configured
2. **Database Migrations**: Ensure NextAuth tables exist (`users`, `accounts`, `sessions`, `verification_tokens`)
3. **Google OAuth Setup**: Configure valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

## Monitoring

Key metrics to monitor:
- Middleware execution time (should be <100ms)
- Database lookup failures
- OAuth authentication success rate
- Redirect loop incidents

## Future Improvements

1. **Caching**: Add Redis cache for user lookups to reduce database load
2. **Performance**: Consider moving to database sessions for better scalability
3. **Security**: Add rate limiting for authentication attempts

## Related Files

- `src/middleware.ts` - Main middleware with runtime fix
- `src/lib/auth-config.ts` - NextAuth configuration with OAuth user creation
- `src/lib/auth/users.ts` - User database operations
- `__tests__/auth/middleware-google-oauth.test.ts` - Comprehensive test suite

---

**Status**: ✅ RESOLVED - Google OAuth authentication now works correctly without Edge Runtime errors.