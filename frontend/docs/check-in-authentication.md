# Check-In Authentication Documentation

## Overview

The check-in feature allows users to reset their secret's deadman switch timer by clicking a link in an email. This requires special authentication handling since users may not be logged in when they access the check-in link.

## Authentication Flow

### Traditional Routes (Session-Based)
- Require active NextAuth session
- Redirect to `/sign-in` if not authenticated
- Protected by NextAuth middleware

### Check-In Routes (Token-Based)
- Allow unauthenticated access
- Use cryptographic tokens for authentication
- Token validation happens at API level

## Implementation Details

### 1. Middleware Configuration

**File**: `src/middleware.ts`

#### Public Route Access
```typescript
const publicRoutes = [
  "/check-in", // Allow unauthenticated access for token-based check-ins
  // ... other public routes
];
```

The `/check-in` page route is added to the public routes array, allowing users to access it without an active session.

#### API Route Exemption
```typescript
// Check-in endpoint uses token-based authentication, not session auth
if (pathname === "/api/check-in") {
  return true;
}
```

The `/api/check-in` API route is explicitly exempted from session authentication requirements, similar to cron endpoints.

### 2. Token-Based Authentication

**File**: `src/app/api/check-in/route.ts`

#### Token Validation Steps

1. **Token Presence**: Verify token exists in query string
2. **Database Lookup**: Retrieve token record from `check_in_tokens` table
3. **Existence Check**: Confirm token exists in database
4. **Usage Check**: Verify token hasn't been used (`usedAt` is null)
5. **Expiration Check**: Ensure token hasn't expired (`expiresAt` > now)
6. **Secret Validation**: Confirm associated secret exists

#### Security Measures

##### Timing Attack Protection
```typescript
const startTime = Date.now();
// ... validation logic ...
if (!tokenRow) {
  // Use constant-time delay to prevent timing attacks
  const elapsed = Date.now() - startTime;
  if (elapsed < 100) {
    await new Promise(resolve => setTimeout(resolve, 100 - elapsed));
  }
}
```

Invalid token responses are delayed to ensure consistent response times, preventing attackers from distinguishing between valid and invalid tokens based on response time.

##### Replay Attack Prevention
```typescript
if (tokenRow.usedAt) {
  return NextResponse.json({ error: "Token has already been used" }, {
    status: 400,
  });
}

// Mark token as used after successful check-in
await db
  .update(checkInTokens)
  .set({ usedAt: now } as any)
  .where(eq(checkInTokens.id, tokenRow.id));
```

Tokens can only be used once. After successful check-in, the `usedAt` timestamp is set, preventing token reuse.

##### Security Logging
```typescript
// Log all check-in attempts
console.log('[CHECK-IN] Attempt received', {
  timestamp: new Date().toISOString(),
  hasToken: !!token,
  ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
});

// Log validation failures
console.warn('[CHECK-IN] Invalid token attempt', {
  timestamp: new Date().toISOString(),
  tokenPrefix: token.substring(0, 8) + '...'
});

// Log successful check-ins
console.log('[CHECK-IN] Success', {
  timestamp: new Date().toISOString(),
  tokenId: tokenRow.id,
  secretId: secret.id,
  processingTime: Date.now() - startTime + 'ms'
});
```

All check-in attempts are logged for security monitoring, including:
- Attempt timestamp and IP address
- Invalid token attempts (with token prefix for debugging)
- Token reuse attempts
- Expired token attempts
- Successful check-ins with processing time

### 3. User Experience

**File**: `src/app/check-in/page.tsx`

#### Unauthenticated Access
The check-in page is accessible without authentication, allowing users to:
1. Click email link with token
2. See check-in confirmation page
3. Click "Check In Now" button
4. Receive success/error feedback

#### Error Handling
- **Missing Token**: Shows "Invalid Check-In Link" message
- **Invalid Token**: API returns 400 with descriptive error
- **Expired Token**: API returns 400 with "Token has expired"
- **Used Token**: API returns 400 with "Token has already been used"

## Database Schema

### check_in_tokens Table
```sql
CREATE TABLE check_in_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Fields**:
- `id`: Unique token identifier
- `secret_id`: Foreign key to associated secret
- `token`: Cryptographic token string (unique)
- `expires_at`: Token expiration timestamp
- `used_at`: Timestamp when token was used (null if unused)
- `created_at`: Token creation timestamp

## Security Considerations

### Token Generation
- Tokens should be cryptographically secure random strings
- Minimum length: 32 characters
- Use `crypto.randomBytes()` or similar for generation

### Token Expiration
- Recommended expiration: 24-48 hours
- Balance between security and usability
- Expired tokens are rejected at API level

### Token Storage
- Store tokens in database with proper indexing
- Use HTTPS for all check-in links
- Never log complete token values (use prefix only)

### Rate Limiting
Consider implementing rate limiting for check-in attempts:
- Per IP address: 10 attempts per hour
- Per token: 5 attempts per hour
- Helps prevent brute force attacks

## Testing

### Test Coverage

#### Unit Tests
- **File**: `__tests__/auth/check-in-route-access.test.ts`
- Tests middleware configuration
- Tests token validation logic
- Tests security measures

#### Integration Tests
- **File**: `__tests__/integration/check-in-token-flow.test.ts`
- Documents complete token lifecycle
- Tests edge cases and security validations
- Verifies user experience flows

#### Page Tests
- **File**: `__tests__/app/check-in-page.test.tsx`
- Tests UI rendering and interaction
- Tests error states
- Tests success states

### Running Tests
```bash
# Run all check-in tests
npm test -- __tests__/auth/check-in-route-access.test.ts
npm test -- __tests__/integration/check-in-token-flow.test.ts
npm test -- __tests__/app/check-in-page.test.tsx
```

## Monitoring

### Logs to Monitor

1. **Check-In Attempts**
   - Pattern: `[CHECK-IN] Attempt received`
   - Action: Track overall usage

2. **Invalid Token Attempts**
   - Pattern: `[CHECK-IN] Invalid token attempt`
   - Action: Monitor for brute force attacks

3. **Token Reuse Attempts**
   - Pattern: `[CHECK-IN] Token reuse attempt`
   - Action: Investigate potential replay attacks

4. **Expired Token Attempts**
   - Pattern: `[CHECK-IN] Expired token attempt`
   - Action: Consider extending token expiration if frequent

5. **Successful Check-Ins**
   - Pattern: `[CHECK-IN] Success`
   - Action: Track feature usage and performance

### Alert Thresholds

- **High Invalid Token Rate**: >10% of attempts
- **Token Reuse Attempts**: Any occurrence should be investigated
- **Response Time**: >500ms average should trigger investigation

## Future Enhancements

### Potential Improvements

1. **Rate Limiting**: Implement per-IP and per-token rate limits
2. **Token Rotation**: Support multiple active tokens per secret
3. **CAPTCHA**: Add CAPTCHA for repeated failures
4. **Audit Trail**: Enhanced logging to dedicated audit table
5. **Geolocation**: Track and alert on unusual geographic access patterns

### Backward Compatibility

Any changes to the check-in flow must maintain:
- Existing token format compatibility
- API response structure
- Error message clarity
- User experience consistency

## References

- NextAuth Middleware: https://next-auth.js.org/configuration/nextjs#middleware
- Timing Attack Prevention: https://codahale.com/a-lesson-in-timing-attacks/
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
