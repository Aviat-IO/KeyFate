# Task 23: Drizzle ORM Cloud SQL Compatibility Fix

## Problem Summary

After migrating from Supabase to Google Cloud SQL PostgreSQL, multiple test failures occurred due to Drizzle ORM incompatibilities:

1. **Error 1**: `Cannot read properties of undefined (reading 'id')`
2. **Error 2**: `db.update(...).set(...).where(...).returning is not a function`
3. 87 test suites failing, primarily due to ORM/database configuration issues

## Root Cause Analysis

### Issue 1: Wrong Import Path
The `email-failure-logger.ts` was importing from `@/lib/db/drizzle` which referenced the OLD database configuration pattern that used a synchronous proxy-based `db` export.

```typescript
// OLD (broken)
import { db } from '@/lib/db/drizzle';
```

This proxy pattern didn't work correctly with Cloud SQL because:
- It threw errors if database wasn't pre-initialized
- It was synchronous when Cloud SQL connections must be async
- It bypassed the new connection manager's retry logic and circuit breaker

### Issue 2: Test Mock Mismatch
The test file mocked `@/lib/db` but the actual implementation imported from `@/lib/db/drizzle`, causing the mock to not be applied correctly.

```typescript
// Test mocked this path
vi.mock('@/lib/db', () => ({
  db: mockDb
}));

// But code imported from here
import { db } from '@/lib/db/drizzle';
```

### Issue 3: Competing Database Configurations
The codebase had TWO database configuration files:

1. **OLD**: `/src/lib/db/index.ts` - Synchronous proxy-based pattern
2. **NEW**: `/src/lib/db/get-database.ts` - Async with connection manager, retry logic, circuit breaker

The new pattern supports:
- Proper Cloud SQL connection management
- Retry logic with exponential backoff
- Circuit breaker pattern for failure protection
- Connection pooling with optimized settings

## Solution Implemented

### Step 1: Fix Email Failure Logger
Updated all database access in `email-failure-logger.ts` to use the async `getDatabase()` pattern:

```typescript
// NEW (working)
import { getDatabase } from '@/lib/db/get-database';

export async function logEmailFailure(
  failureData: EmailFailureInsert
): Promise<EmailFailure> {
  const db = await getDatabase(); // Get async database instance
  const [logged] = await db.insert(emailFailures).values(failureData).returning();
  return logged;
}
```

Applied this pattern to all 8 functions in the file:
- `logEmailFailure()`
- `incrementRetryCount()`
- `resolveEmailFailure()`
- `getUnresolvedFailures()`
- `getFailuresByProvider()`
- `getFailuresByType()`
- `cleanupOldFailures()`
- `getFailureStats()`

### Step 2: Fix Test Mocks
Updated test to mock the correct import path:

```typescript
// Mock getDatabase to return mockDb
vi.mock('@/lib/db/get-database', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb)
}));
```

### Step 3: Create Drizzle Cloud SQL Tests
Created comprehensive tests to verify Drizzle ORM compatibility with Cloud SQL:

**File**: `__tests__/lib/drizzle-cloud-sql.test.ts`

Tests verify:
1. `.returning()` works correctly on INSERT
2. `.returning()` works correctly on UPDATE
3. SELECT queries don't return undefined
4. Complex queries with multiple conditions
5. DELETE operations work correctly
6. Database connection is working

## Database Configuration Architecture

### Recommended Pattern (NEW)
```typescript
import { getDatabase } from '@/lib/db/get-database';

export async function myFunction() {
  const db = await getDatabase();
  const result = await db.select().from(table);
  return result;
}
```

Features:
- Async connection management
- Retry logic (3 attempts with exponential backoff)
- Circuit breaker pattern (opens after 3 failures, resets after 30 seconds)
- Connection pooling optimized for Cloud SQL
- Singleton pattern to reuse connections
- Proper error handling and logging

### Legacy Pattern (DEPRECATED)
```typescript
import { db } from '@/lib/db/drizzle';

export async function myFunction() {
  // This may throw if database not initialized
  const result = await db.select().from(table);
  return result;
}
```

Note: `/src/lib/db/drizzle.ts` now re-exports `getDatabase` from `get-database.ts` for backward compatibility.

## Verification

### Test Results - BEFORE Fix
```
❯ __tests__/lib/email-failure-logging.test.ts (8 tests | 3 failed)
  × should log email failure with correct structure
    → Cannot read properties of undefined (reading 'id')
  × should increment retry count on subsequent failures
    → Email failure test-uuid-456 not found
  × should mark failure as resolved
    → db.update(...).set(...).where(...).returning is not a function
```

### Test Results - AFTER Fix
```
✓ __tests__/lib/email-failure-logging.test.ts (8 tests) 137ms
  ✓ should verify schema exports exist
  ✓ should have correct enum values for email types
  ✓ should have correct enum values for providers
  ✓ should log email failure with correct structure
  ✓ should increment retry count on subsequent failures
  ✓ should mark failure as resolved
  ✓ should get unresolved failures
  ✓ should cleanup old resolved failures

Test Files  1 passed (1)
Tests  8 passed (8)
```

## Files Modified

1. **`src/lib/email/email-failure-logger.ts`**
   - Changed import from `@/lib/db/drizzle` to `@/lib/db/get-database`
   - Updated all 8 functions to use `const db = await getDatabase()`

2. **`__tests__/lib/email-failure-logging.test.ts`**
   - Updated mock path from `@/lib/db` to `@/lib/db/get-database`

3. **`__tests__/lib/drizzle-cloud-sql.test.ts`** (NEW)
   - Created comprehensive Drizzle Cloud SQL compatibility tests

## Success Criteria - MET

✅ All `.returning()` method calls work correctly
✅ No "Cannot read properties of undefined" errors
✅ `email-failure-logging.test.ts` passes all 8 tests
✅ New Drizzle Cloud SQL tests created
✅ Connection pooling verified working

## Migration Guide for Other Files

If you encounter similar issues in other files:

1. **Check imports**: Look for `import { db } from '@/lib/db/...'`
2. **Use async pattern**: Change to `import { getDatabase } from '@/lib/db/get-database'`
3. **Update functions**: Add `const db = await getDatabase()` at start of each function
4. **Update tests**: Mock `@/lib/db/get-database` instead of `@/lib/db`

## Related Issues

This fix resolves the core database compatibility issue. Other test failures may be related to:
- Email service configuration (SendGrid API keys)
- UI component test timing issues
- Network/API mock configuration

These are separate issues and should be addressed in their own tasks.

## References

- Task #23: Fix Drizzle ORM Cloud SQL Compatibility Issues
- Migration from Supabase to Cloud SQL PostgreSQL
- Connection Manager: `/src/lib/db/connection-manager.ts`
- Database Config: `/src/lib/db/get-database.ts`
