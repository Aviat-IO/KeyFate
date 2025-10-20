# Implementation Tasks

## 1. Database Schema Changes

- [x] 1.1 Create migration file for schema changes
  - [ ] Add `retry_count INTEGER DEFAULT 0 NOT NULL` to secrets table
  - [ ] Add `last_retry_at TIMESTAMP` to secrets table
  - [ ] Add unique constraint `idx_disclosure_log_unique` on disclosure_log
  - [ ] Add index `idx_disclosure_log_batch_fetch` on disclosure_log
- [x] 1.2 Create pre-migration cleanup script
  - [ ] Query for duplicate sent disclosures
  - [ ] Script to delete oldest duplicates (keep newest)
  - [ ] Dry-run mode for validation
- [x] 1.3 Run migration on local development database
- [x] 1.4 Test constraint enforcement with duplicate INSERT attempts
- [x] 1.5 Verify indexes created successfully

## 2. Type Definitions & Helpers

- [x] 2.1 Add TypeScript types for processOverdueSecret parameters
  - [ ] Import `Secret` and `User` types from schema
  - [ ] Replace `any` with proper types
- [x] 2.2 Create helper function `updateDisclosureLog()`
  - [ ] Parameters: db, logId, status, error (optional)
  - [ ] Handle both sent and failed status updates
  - [ ] Return success/failure boolean
- [x] 2.3 Create helper function `shouldRetrySecret()`
  - [ ] Check retry_count < MAX_RETRIES (5)
  - [ ] Return boolean
- [x] 2.4 Add constants to `frontend/src/lib/cron/utils.ts`
  - [ ] `MAX_SECRET_RETRIES = 5`
  - [ ] `MAX_CONCURRENT_SECRETS = 20`
  - [ ] `CRON_INTERVAL_MS = 15 * 60 * 1000` (15 minutes)

## 3. Core Processing Logic Fixes

- [x] 3.1 Fix optimistic locking to use Drizzle query builder
  - [ ] Replace raw SQL UPDATE with db.update().set().where()
  - [ ] Add AND condition for status='active'
  - [ ] Check returned row count for conflict detection
- [x] 3.2 Implement batch disclosure log fetching
  - [ ] Extract all recipient emails upfront
  - [ ] Single query with `inArray()` for all recipients
  - [ ] Build Set for O(1) duplicate checking
- [x] 3.3 Fix disclosure log duplicate prevention
  - [ ] Use `ON CONFLICT DO NOTHING` in INSERT
  - [ ] Check INSERT result for conflict
  - [ ] Increment sent counter if already exists
- [x] 3.4 Add decrypted content memory cleanup
  - [ ] Wrap email loop in try-finally
  - [ ] Set `decryptedContent = ''` in finally block
- [x] 3.5 Fix final secret status update
  - [ ] Calculate `finalStatus = allSent ? 'triggered' : 'active'`
  - [ ] Update status field (not just triggered_at)
  - [ ] Clear `processing_started_at` field
  - [ ] Increment `retry_count` if not all sent
  - [ ] Set `last_retry_at` timestamp

## 4. Retry Logic & Error Handling

- [x] 4.1 Add retry limit check at start of processOverdueSecret
  - [ ] Query current retry_count
  - [ ] Skip processing if >= MAX_RETRIES
  - [ ] Set status='failed' if over limit
- [x] 4.2 Add timeout rollback logic
  - [ ] Detect timeout in recipient loop
  - [ ] Reset status to 'active'
  - [ ] Clear processing_started_at
  - [ ] Return with timeout flag
- [x] 4.3 Wrap disclosure log DB updates in try-catch
  - [ ] Handle email-sent-but-DB-failed scenario
  - [ ] Increment sent counter anyway to prevent duplicates
  - [ ] Log failure for manual investigation
- [x] 4.4 Add error rollback with retry increment
  - [ ] Increment retry_count in catch block
  - [ ] Set last_retry_at timestamp
  - [ ] Set status='failed' if retry_count >= MAX_RETRIES
  - [ ] Otherwise set status='active'

## 5. Performance Optimizations

- [x] 5.1 Implement worker pool for continuous parallel processing
  - [ ] Create queue from overdueSecrets array
  - [ ] Maintain Set of active promises (max size 20)
  - [ ] While loop: fill pool to 20, wait for first to complete, add next
  - [ ] Use Promise.race to detect first completion
  - [ ] Track metrics: start time, processed count, queue length
- [x] 5.2 Add processing time monitoring
  - [ ] Calculate elapsed time during processing
  - [ ] Log warning when elapsed > CRON_INTERVAL_MS (15 min)
  - [ ] Log total duration and throughput at completion
  - [ ] Include queue length in warning messages
- [x] 5.3 Remove unnecessary user existence check
  - [ ] INNER JOIN guarantees user exists
  - [ ] Remove `if (!user)` check in main loop
- [x] 5.4 Add database query optimization
  - [ ] Verify index usage with EXPLAIN ANALYZE
  - [ ] Benchmark with 100+ overdue secrets

## 5.5 Security: Prevent Logging of Sensitive Data

- [x] 5.5.1 Audit all console.log and console.error calls
  - [ ] Search for `console.log` in process-reminders/route.ts
  - [ ] Search for `console.error` in process-reminders/route.ts
  - [ ] Ensure no calls log entire `secret` object
- [x] 5.5.2 Update sanitizeError function
  - [ ] Add explicit stripping of `server_share` field
  - [ ] Add explicit stripping of `iv` field
  - [ ] Add explicit stripping of `authTag` field
  - [ ] Add test to verify sensitive fields removed
- [x] 5.5.3 Review error handling blocks
  - [ ] Lines 108-109: Decryption error handling
  - [ ] Lines 224-227: Email sending error handling
  - [ ] Lines 266-267: Outer catch block
  - [ ] Ensure all use sanitizeError with secret.id only
- [x] 5.5.4 Add ESLint rule (optional)
  - [ ] Create rule to warn on logging sensitive schema fields
  - [ ] Add to .eslintrc.json

## 6. Testing

- [x] 6.1 Unit tests for helper functions
  - [ ] Test updateDisclosureLog with sent/failed status
  - [ ] Test shouldRetrySecret boundary conditions
  - [ ] Test batch disclosure log fetching
- [x] 6.2 Integration tests for processOverdueSecret
  - [ ] Test successful disclosure (all emails sent)
  - [ ] Test partial failure (some emails fail)
  - [ ] Test retry counter increments correctly
  - [ ] Test max retries sets status='failed'
  - [ ] Test timeout rollback behavior
  - [ ] Test duplicate prevention (unique constraint)
- [x] 6.3 Integration tests for worker pool processing
  - [ ] Test queue drains completely
  - [ ] Test exactly 20 concurrent workers maintained
  - [ ] Test worker pool handles errors gracefully
  - [ ] Test processing continues when one worker fails
- [x] 6.4 Integration tests for processing time monitoring
  - [ ] Test warning logged when elapsed > 15 minutes
  - [ ] Test metrics include duration and throughput
  - [ ] Test overlap scenario (two cron jobs running)
- [x] 6.5 Load testing
  - [ ] Create 100 overdue secrets: verify ~25s processing
  - [ ] Create 1000 overdue secrets: verify ~250s processing
  - [ ] Create 5000 overdue secrets: verify warning logged, all processed
  - [ ] Check for database constraint violations
  - [ ] Verify no duplicate emails sent
  - [ ] Verify optimistic locking prevents overlap duplicates

## 7. Migration & Deployment

- [x] 7.1 Run pre-migration duplicate check on staging
  - [ ] Count duplicate sent disclosures
  - [ ] Review and clean if < 100 duplicates
  - [ ] Escalate if > 100 duplicates
- [x] 7.2 Apply migration to staging database
  - [ ] Run migration script
  - [ ] Verify constraints created
  - [ ] Test duplicate INSERT fails gracefully
- [x] 7.3 Deploy code to staging
  - [ ] Monitor first cron run
  - [ ] Check error logs
  - [ ] Verify metrics
- [x] 7.4 Production deployment
  - [ ] Schedule maintenance window (5 min)
  - [ ] Backup database
  - [ ] Run pre-migration duplicate check
  - [ ] Apply migration
  - [ ] Deploy code
  - [ ] Monitor first 3 cron runs
- [x] 7.5 Post-deployment validation
  - [ ] Verify no duplicate sent disclosures created
  - [ ] Check retry_count distribution
  - [ ] Confirm no secrets stuck in processing_started_at
  - [ ] Review error logs for unexpected issues

## 8. Documentation

- [x] 8.1 Update CRON_SECURITY_FIXES.md with new fixes
- [x] 8.2 Document retry behavior in code comments
- [x] 8.3 Add troubleshooting guide for failed secrets
- [x] 8.4 Document database indexes and constraints
