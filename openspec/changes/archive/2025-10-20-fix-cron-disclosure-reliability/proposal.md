# Fix Cron Disclosure Reliability

## Why

Code review of `frontend/src/app/api/cron/process-reminders/route.ts` (commit
1275f01) identified **15 critical issues** affecting data integrity, security,
performance, and scalability. The current implementation has:

- **Data corruption risk**: Partial email success leaves secrets stuck in
  `triggered` status, preventing retries
- **Race conditions**: Duplicate disclosure emails can be sent due to
  check-then-insert pattern
- **Infinite retry loops**: Permanent errors (bad encryption keys) cause endless
  retries with no backoff
- **Performance bottlenecks**: N+1 queries and sequential processing cause
  timeout with high volume
- **Security concerns**: Decrypted secrets held in memory for extended periods
- **Reliability gaps**: Timeout handling doesn't rollback state, email success
  with DB update failure causes duplicates

These issues prevent the system from reliably processing overdue secrets at
scale and risk data corruption in production.

## What Changes

### Critical Data Integrity (MUST FIX)

- **BREAKING**: Add unique constraint on
  `disclosure_log(secret_id, recipient_email)` WHERE `status = 'sent'` to
  prevent race conditions
- Add `retry_count` and `last_retry_at` columns to `secrets` table for retry
  limit tracking
- Add `status` field to final secret update to prevent secrets stuck in
  `triggered` state
- Add rollback logic on timeout to reset secrets to `active` status
- Clear `processing_started_at` field on success/failure to prevent orphaned
  state

### Performance & Scalability

- Batch-fetch existing disclosure logs instead of N+1 queries per recipient
- Implement worker pool pattern for continuous parallel processing (20
  concurrent, always active)
- Process until all secrets handled, not limited by preset batch count
- Log warnings when processing exceeds 15-minute cron interval (not a hard
  limit)
- Handle overlapping cron runs gracefully via optimistic locking
- Add database index:
  `disclosure_log(secret_id, recipient_email, status, created_at)`

### Security & Code Quality

- Clear decrypted content from memory immediately after use
- Switch from raw SQL to Drizzle query builder for type safety
- Add proper TypeScript types (replace `any` with `Secret` and `User`)
- Extract disclosure log update logic to helper function
- Add retry limit (5 attempts) with exponential backoff
- **CRITICAL**: Ensure `server_share` is never logged in error messages or
  console output

### Error Handling

- Wrap DB updates in try-catch to handle email-sent-but-DB-failed scenario
- Mark emails as sent even if DB update fails to prevent duplicates
- Add `failed` status for secrets exceeding retry limit

## Impact

### Affected Capabilities

- **cron-secret-disclosure** (NEW): Secret disclosure processing by cron jobs
- **database-schema** (MODIFIED): Add constraints, indexes, and columns

### Affected Code

- `frontend/src/lib/db/schema.ts` - Add columns, indexes, unique constraint
- `frontend/src/app/api/cron/process-reminders/route.ts` - Complete rewrite with
  fixes
- Database migration required for schema changes

### Breaking Changes

- **Database migration required**: New unique constraint may fail if duplicate
  `(secret_id, recipient_email, status='sent')` rows exist
- **Migration strategy**: Clean up duplicates before applying constraint

### Compatibility

- No API changes - all fixes are internal to cron job processing
- Existing secrets and disclosure logs unaffected (backwards compatible data)
- Requires database migration before deployment

### Deployment Risk

- **Medium**: Schema changes require migration, but cron job improvements reduce
  operational risk
- **Rollback**: Database migration can be rolled back if issues detected
- **Testing**: Integration tests required with real database to validate fixes
