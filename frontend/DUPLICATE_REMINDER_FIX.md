# Duplicate Reminder Prevention - Diagnostic Fix

## Problem Summary
Multiple reminder emails being sent at 15-minute intervals (matching cron frequency), suggesting the deduplication logic in `reminderJobs` table isn't working.

## Investigation Results

### Code Review (Completed)
✅ **Schema is correct**: `reminder_jobs` table exists with proper structure
✅ **Enum values match**: Database enum matches TypeScript type definition
✅ **Deduplication logic exists**: `hasReminderBeenSent()` and `recordReminderSent()` functions implemented
✅ **Database migrations applied**: Table created in migration `0000_optimal_overlord.sql`

### Potential Root Causes
The code looks correct, so the issue is likely one of:

1. **Silent Database Errors**: Database queries failing without proper error handling
2. **Transaction/Timing Issues**: Race conditions if multiple cron jobs run simultaneously
3. **Type Mismatch**: Runtime type mismatch despite TypeScript correctness
4. **Connection Issues**: Database connection problems causing silent failures

## Fix Applied

### Added Comprehensive Logging
Enhanced `frontend/src/app/api/cron/check-secrets/route.ts` with detailed logging:

```typescript
// Startup logging
console.log(`[check-secrets] Cron job started at ${startTime.toISOString()}`);
console.log(`[check-secrets] Existing reminder_jobs count: ${count}`);
console.log(`[check-secrets] Found ${allActiveSecrets.length} active secrets`);

// Per-secret logging
console.log(`[check-secrets] Processing secret ${secret.id} (title: ${secret.title})`);
console.log(`[check-secrets] Reminder type: ${reminderType || 'none'}`);

// Deduplication check logging
console.log(`[check-secrets] Checking if reminder already sent: secretId=${secretId}, type=${reminderType}`);
console.log(`[check-secrets] Reminder check result: alreadySent=${alreadySent}, found ${count} records`);

// Recording logging
console.log(`[check-secrets] Recording reminder sent: secretId=${secretId}, type=${reminderType}`);
console.log(`[check-secrets] Inserted reminder job with ID: ${id}`);
console.log(`[check-secrets] Updated reminder job status to 'sent' for ID: ${id}`);
```

### Added Error Handling
- Wrapped `hasReminderBeenSent()` in try-catch to detect database errors
- Wrapped `recordReminderSent()` in try-catch with error logging
- Added separate try-catch in main loop to prevent one failure from blocking others
- Fail-open strategy: on error checking duplicates, allow sending (prevents blocking all reminders)

### Defensive Programming
- Check for `inserted?.id` before updating status
- Log all database operations for audit trail
- Continue processing even if recording fails

## Next Steps - Monitor Production Logs

### What to Look For

#### 1. Startup Logs
```
[check-secrets] Cron job started at 2025-10-06T18:45:00.000Z
[check-secrets] Existing reminder_jobs count: X
[check-secrets] Found Y active secrets to process
```
- If `reminder_jobs count` is 0, the table isn't being populated
- If `active secrets` count is > 0, we should see processing logs

#### 2. Per-Secret Processing
```
[check-secrets] Processing secret abc-123 (title: Test Secret)
[check-secrets] Reminder type for secret abc-123: 24_hours
[check-secrets] Checking if reminder already sent: secretId=abc-123, type=24_hours
[check-secrets] Reminder check result: alreadySent=false, found 0 records
```
- Check if `alreadySent` correctly flips to `true` on second run
- Verify `found X records` increases after recording

#### 3. Recording Success
```
[check-secrets] Recording reminder sent: secretId=abc-123, type=24_hours
[check-secrets] Inserted reminder job with ID: xyz-789
[check-secrets] Updated reminder job status to 'sent' for ID: xyz-789
[check-secrets] Successfully recorded reminder for secret abc-123
```
- Confirm all three steps complete
- Verify status is updated to 'sent'

#### 4. Error Messages
Look for:
```
[check-secrets] Error checking reminder status: ...
[check-secrets] Error recording reminder: ...
[check-secrets] Failed to insert reminder job - no ID returned
[check-secrets] Failed to record reminder for secret ...
```

### Expected Behavior After Fix

**First Cron Run (12:00:00)**:
```
[check-secrets] Checking if reminder already sent: secretId=abc, type=24_hours
[check-secrets] Reminder check result: alreadySent=false, found 0 records
[check-secrets] Sending reminder for secret abc - type: 24_hours
[check-secrets] Successfully recorded reminder for secret abc
```

**Second Cron Run (12:15:00)** - Should skip:
```
[check-secrets] Checking if reminder already sent: secretId=abc, type=24_hours
[check-secrets] Reminder check result: alreadySent=true, found 1 records
[check-secrets] Skipping reminder for secret abc - already sent 24_hours
```

### Database Query to Verify

```sql
-- Check if reminders are being recorded
SELECT
  secret_id,
  reminder_type,
  status,
  sent_at,
  created_at
FROM reminder_jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check for duplicate reminders
SELECT
  secret_id,
  reminder_type,
  COUNT(*) as duplicate_count
FROM reminder_jobs
WHERE status = 'sent'
  AND sent_at > NOW() - INTERVAL '1 hour'
GROUP BY secret_id, reminder_type
HAVING COUNT(*) > 1;
```

## Files Modified
- `frontend/src/app/api/cron/check-secrets/route.ts` - Added comprehensive logging and error handling

## Files Created
- `frontend/__tests__/api/cron/test-deduplication.ts` - Test script for local verification (requires local DB)
- `frontend/DUPLICATE_REMINDER_FIX.md` - This file

## Deployment Notes
1. Deploy the updated `route.ts` file
2. Wait for next cron run (every 15 minutes)
3. Check Cloud Run logs for the diagnostic output
4. Verify `reminder_jobs` table is being populated
5. Confirm duplicates stop after first successful recording

## If Issue Persists After Logging

Possible additional investigations:
1. Check if cron secret is being reused causing auth issues
2. Verify DATABASE_URL in production environment
3. Check for concurrent cron executions (lock mechanism needed?)
4. Add database transaction to prevent race conditions
5. Add unique constraint on (secret_id, reminder_type, status='sent')
