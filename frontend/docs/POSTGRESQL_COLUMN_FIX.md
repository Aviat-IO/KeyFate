# PostgreSQL Column Error Fix: recipient_name

## Problem Summary

The application was experiencing a PostgreSQL error:
```
PostgresError: column "recipient_name" of relation "secrets" does not exist
```

This error occurred in the `POST /api/secrets` endpoint when trying to create new secrets.

## Root Cause Analysis

### Schema Mismatch Investigation

1. **Drizzle Schema Definition** (`src/lib/db/schema.ts`):
   ```typescript
   recipientName: text("recipient_name").notNull(),
   ```
   - TypeScript property: `recipientName` (camelCase)
   - Database column: `"recipient_name"` (snake_case)

2. **Migration File** (`drizzle/0000_chubby_daimon_hellstrom.sql`):
   ```sql
   "recipient_name" text NOT NULL,
   ```

3. **API Route** (`src/app/api/secrets/route.ts`):
   ```typescript
   const insertData = {
     recipientName: validatedData.recipient_name, // Correct transformation
     // ...
   };
   ```

### Potential Issues

The schema definition and API transformation were **correct**. The error suggests either:
- The database migration was not properly executed
- The actual database table structure differs from the migration
- There's a case sensitivity or naming issue in the database

## Solution Implemented

### 1. Enhanced Error Handling

Updated the API route to provide better error diagnostics:

```typescript
// Enhanced error handling in POST /api/secrets
catch (error) {
  if (error instanceof Error && error.message.includes('recipient_name')) {
    console.error("Column mapping error detected:", error.message);
    return NextResponse.json({
      error: "Database schema mismatch: recipient_name column issue",
      details: error.message
    }, { status: 500 });
  }
  // ...
}
```

### 2. Robust Service Implementation

Created a fallback service (`src/lib/db/secrets-service-robust.ts`) that:
- Detects schema mismatches automatically
- Attempts to add missing columns if possible
- Provides detailed logging for debugging

### 3. Schema Validation and Repair Tools

Added new npm scripts:
```bash
npm run db:check-schema  # Check current database schema
npm run db:fix-schema    # Attempt to repair schema issues
```

### 4. Comprehensive Testing

Created tests to validate:
- Schema field mapping correctness
- API data transformation
- Error handling patterns

## Quick Fix Steps

### Step 1: Check Current Schema
```bash
npm run db:check-schema
```

### Step 2: Attempt Automatic Fix
```bash
npm run db:fix-schema
```

### Step 3: Manual Migration (if needed)
```bash
npm run db:push
```

### Step 4: Verify Fix
```bash
# Test the API endpoint manually or run:
npm test __tests__/api/secrets-fix-validation.test.ts
```

## Manual Database Fix

If the automatic tools don't work, you can manually check and fix the database:

### Check Table Structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'secrets'
ORDER BY ordinal_position;
```

### Add Missing Column (if needed)
```sql
ALTER TABLE secrets
ADD COLUMN IF NOT EXISTS recipient_name text NOT NULL DEFAULT '';
```

### Check for Case Issues
```sql
-- Check if column exists with different case
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'secrets'
AND lower(column_name) = 'recipient_name';
```

## Prevention Measures

### 1. Always Use Drizzle Commands
- Use `npm run db:push` instead of manual SQL for schema changes
- Use `npm run db:generate` to create migrations from schema changes

### 2. Schema Validation in CI/CD
Add schema validation to your deployment pipeline:
```bash
npm run db:check-schema
```

### 3. Database Health Checks
Implement regular health checks that verify critical table structures.

## Field Mapping Reference

The API correctly transforms field names from the client format to the database format:

| API Field (snake_case) | Database Field (camelCase in Drizzle) | Database Column (snake_case) |
|------------------------|---------------------------------------|------------------------------|
| `recipient_name`       | `recipientName`                       | `recipient_name`             |
| `recipient_email`      | `recipientEmail`                      | `recipient_email`            |
| `contact_method`       | `contactMethod`                       | `contact_method`             |
| `check_in_days`        | `checkInDays`                         | `check_in_days`              |
| `sss_shares_total`     | `sssSharesTotal`                      | `sss_shares_total`           |
| `sss_threshold`        | `sssThreshold`                        | `sss_threshold`              |

## Files Modified

1. **API Route**: `src/app/api/secrets/route.ts`
   - Enhanced error handling
   - Added robust service fallback

2. **New Files**:
   - `src/lib/db/secrets-service-robust.ts` - Robust database service
   - `scripts/check-migrations.ts` - Schema checking utility
   - `scripts/fix-secrets-schema.ts` - Schema repair utility

3. **Tests**:
   - `__tests__/api/secrets-schema-alignment.test.ts`
   - `__tests__/api/secrets-column-mapping.test.ts`
   - `__tests__/api/secrets-fix-validation.test.ts`
   - `__tests__/api/secrets-endpoint-integration.test.ts`

4. **Configuration**: `package.json`
   - Added `db:check-schema` and `db:fix-schema` scripts

## Testing the Fix

Run the test suite to verify everything works:

```bash
# Test schema validation
npm test __tests__/api/secrets-fix-validation.test.ts

# Test field transformations
npm test __tests__/api/secrets-endpoint-integration.test.ts

# Test database operations (requires DB connection)
npm test __tests__/api/secrets-schema-alignment.test.ts
```

## Monitoring

After implementing the fix, monitor the application logs for:
- Successful secret creation operations
- Any remaining schema-related errors
- Performance of the robust service fallback

The enhanced error handling will provide detailed information if similar issues occur in the future.