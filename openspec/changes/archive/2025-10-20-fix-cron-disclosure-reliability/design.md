# Design: Cron Disclosure Reliability Fixes

## Context

The `process-reminders` cron job is responsible for:

1. Finding overdue secrets (status='active', next_check_in < now)
2. Marking secrets as 'triggered' using optimistic locking
3. Decrypting secret content using server share
4. Sending disclosure emails to all recipients
5. Logging disclosure attempts in `disclosure_log` table
6. Updating secret status based on success/failure

**Current Problems:**

- Race conditions allow duplicate emails
- Partial failures leave secrets in inconsistent state
- No retry limits cause infinite loops
- Poor query patterns cause performance issues
- Security gaps with decrypted content handling

**Stakeholders:**

- Users: Need reliable secret disclosure
- Recipients: Should receive exactly one email per triggered secret
- Operations: Need predictable cron performance and clear error states

## Goals / Non-Goals

### Goals

- **Data Integrity**: Guarantee exactly-once email delivery per recipient
- **Reliability**: Handle partial failures gracefully with retry logic
- **Performance**: Process 100+ secrets within cron timeout (10 min)
- **Security**: Minimize exposure of decrypted content
- **Observability**: Clear error states and metrics

### Non-Goals

- Changing disclosure email content or format
- Adding new reminder types or schedules
- Real-time disclosure (still cron-based)
- Multi-region or distributed processing

## Decisions

### Decision 1: Database-Level Duplicate Prevention

**Choice**: Unique partial index on `disclosure_log(secret_id, recipient_email)`
WHERE `status = 'sent'`

**Rationale**:

- Application-level check-then-insert has inherent race condition
- Database constraint provides atomic guarantee
- Partial index allows multiple pending/failed entries while preventing
  duplicate sent
- PostgreSQL 16 supports partial unique indexes efficiently

**Alternatives Considered**:

- **Distributed lock**: Added complexity, single point of failure, requires
  Redis
- **Transaction isolation**: Not sufficient - two transactions can both read
  empty result
- **Idempotency key**: Requires schema change and client coordination

**Trade-offs**:

- ✅ Atomic guarantee of uniqueness
- ✅ No additional infrastructure
- ⚠️ Requires migration with duplicate cleanup
- ⚠️ INSERT failures need graceful handling

### Decision 2: Retry Limit with Exponential Backoff

**Choice**: Add `retry_count` and `last_retry_at` to `secrets` table, max 5
retries

**Rationale**:

- Permanent errors (bad encryption key, missing data) should not retry forever
- Exponential backoff reduces load on failing systems
- 5 retries with backoff = ~30 minutes total before marking failed
- Allows manual intervention for genuinely stuck secrets

**Alternatives Considered**:

- **Separate failed_secrets table**: Over-engineering, complicates queries
- **No retry limit**: Current infinite loop problem
- **Dead letter queue**: Requires additional infrastructure

**Retry Schedule**:

```
Attempt 1: Immediate
Attempt 2: +2 min (backoff = 120s)
Attempt 3: +4 min (backoff = 240s)
Attempt 4: +8 min (backoff = 480s)
Attempt 5: +16 min (backoff = 960s)
Total: ~30 minutes before marking failed
```

### Decision 3: Final Status Based on Email Success

**Choice**: Set `status = 'triggered'` only if ALL emails sent, else
`status = 'active'`

**Rationale**:

- Current code sets status='triggered' optimistically (line 70), then only
  updates metadata
- If any email fails, secret stays triggered and won't be retried
- Setting status back to 'active' allows retry on next cron run
- Retry counter prevents infinite loops

**Trade-offs**:

- ✅ Failed secrets automatically retried
- ✅ Clear final state: triggered = all sent, active = needs retry
- ⚠️ Secrets may transition active→triggered→active multiple times
- ⚠️ Need to clear `processing_started_at` to prevent stuck state

### Decision 4: Batch Query Optimization

**Choice**: Fetch all existing disclosure logs for a secret upfront, use `Set`
for O(1) lookup

**Current Pattern** (N+1):

```typescript
for (const recipient of recipients) {  // N recipients
  const existingLog = await db.select()...  // 1 query per recipient
}
```

**New Pattern** (1 query):

```typescript
const existingLogs = await db
  .select()
  .where(inArray(disclosureLog.recipientEmail, recipientEmails));
const sentEmails = new Set(existingLogs.map((log) => log.recipientEmail));

for (const recipient of recipients) {
  if (sentEmails.has(recipient.email)) continue;
}
```

**Impact**:

- 50 recipients: 50 queries → 1 query (98% reduction)
- 100 secrets × 50 recipients: 5,000 queries → 100 queries (98% reduction)

### Decision 5: Continuous Parallel Processing with Fixed Concurrency

**Choice**: Process secrets continuously with exactly 20 concurrent operations
at all times using a worker pool pattern

**Rationale**:

- Current batched approach wastes time: batch of 20 starts, 1 finishes early →
  only 19 active until batch completes
- Continuous processing maintains full concurrency: when 1 finishes, immediately
  start next → always 20 active
- Handles unbounded workload gracefully: processes until queue empty, not
  limited by preset batch count
- Cloud Scheduler invokes every 15 minutes, but job runs until completion (not
  time-limited)
- If backlog exceeds 15-minute processing window, alert monitoring but continue
  processing

**Implementation Pattern** (Worker Pool):

```typescript
const MAX_CONCURRENT = 20;
const CRON_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function processWithWorkerPool(secrets: Secret[]) {
  const queue = [...secrets];
  const active = new Set<Promise<void>>();
  let startTime = Date.now();

  while (queue.length > 0 || active.size > 0) {
    // Fill worker pool to max capacity
    while (active.size < MAX_CONCURRENT && queue.length > 0) {
      const secret = queue.shift()!;
      const promise = processOverdueSecret(secret, user, startTime).finally(
        () => active.delete(promise),
      );
      active.add(promise);
    }

    // Wait for at least one worker to finish
    if (active.size > 0) {
      await Promise.race(active);
    }

    // Check if exceeding cron interval (warning, not hard limit)
    const elapsed = Date.now() - startTime;
    if (elapsed > CRON_INTERVAL_MS && !logged) {
      console.warn(
        `[process-reminders] Processing exceeds ${CRON_INTERVAL_MS}ms: ${elapsed}ms elapsed, ${queue.length} remaining`,
      );
      logged = true;
    }
  }
}
```

**Expected Performance**:

- 100 secrets × 5s / 20 parallel = 25s (well within 15min interval)
- 1000 secrets × 5s / 20 parallel = 250s (~4 minutes)
- 5000 secrets × 5s / 20 parallel = 1250s (~21 minutes, exceeds interval but
  completes)
- Worker pool ensures 20 always active (vs batch waiting for slowest to finish)

**Overlap Handling**:

- Cloud Scheduler triggers every 15 minutes regardless of previous job
  completion
- If previous job still running (>15min workload), Cloud Run spawns new instance
- Optimistic locking prevents duplicate processing: second job finds no
  `status='active'` secrets
- Metrics track overlapping runs for capacity planning

### Decision 6: Drizzle Query Builder Over Raw SQL

**Choice**: Replace `db.execute(sql`...`)` with `db.update().set().where()`

**Rationale**:

- Type safety prevents runtime errors
- Consistent with codebase conventions (project.md:73)
- Easier to test and maintain
- Reduces SQL injection risk surface

### Decision 7: Prevent Logging of Sensitive Encryption Data

**Choice**: Ensure `server_share`, decrypted content, and encryption keys are
NEVER logged

**Rationale**:

- Logging `server_share` could expose secret data if logs are compromised
- Current code uses `sanitizeError()` but may not cover all logging paths
- Console.log and error handlers could inadvertently log sensitive fields
- Zero-knowledge architecture requires strict separation of encrypted data from
  logs

**Implementation**:

- Audit all `console.log()`, `console.error()` calls in cron job
- Ensure `sanitizeError()` explicitly strips `server_share`, `iv`, `authTag`
  fields
- Add ESLint rule to prevent logging sensitive schema fields
- Use structured logging with allowlist (never blocklist)

**Example Safe Error Logging**:

```typescript
// UNSAFE - may log server_share
console.error(`Error processing secret:`, error, secret);

// SAFE - only log non-sensitive fields
console.error(`Error processing secret ${secret.id}:`, sanitizeError(error));
```

**Example Migration**:

```typescript
// Before (raw SQL)
await db.execute(sql`
  UPDATE secrets
  SET status = ${status}, updated_at = ${now}
  WHERE id = ${secret.id}
`);

// After (query builder)
await db
  .update(secrets)
  .set({ status, updatedAt: new Date() })
  .where(eq(secrets.id, secret.id))
  .returning({ id: secrets.id });
```

## Schema Changes

### New Columns (secrets table)

```sql
ALTER TABLE secrets
  ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN last_retry_at TIMESTAMP;
```

### Unique Constraint (disclosure_log table)

```sql
CREATE UNIQUE INDEX idx_disclosure_log_unique
  ON disclosure_log(secret_id, recipient_email)
  WHERE status = 'sent';
```

### Performance Index (disclosure_log table)

```sql
CREATE INDEX idx_disclosure_log_batch_fetch
  ON disclosure_log(secret_id, recipient_email, status, created_at);
```

## Migration Plan

### Phase 1: Schema Migration (5 min downtime)

1. **Backup production database** (automated)
2. **Find duplicate sent disclosures**:
   ```sql
   SELECT secret_id, recipient_email, COUNT(*)
   FROM disclosure_log
   WHERE status = 'sent'
   GROUP BY secret_id, recipient_email
   HAVING COUNT(*) > 1;
   ```
3. **Clean duplicates** (keep oldest):
   ```sql
   DELETE FROM disclosure_log
   WHERE id NOT IN (
     SELECT MIN(id) FROM disclosure_log
     WHERE status = 'sent'
     GROUP BY secret_id, recipient_email
   );
   ```
4. **Apply schema changes** (migration file)
5. **Verify constraints**:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'disclosure_log';
   SELECT * FROM information_schema.columns WHERE table_name = 'secrets';
   ```

### Phase 2: Code Deployment (zero downtime)

1. Deploy updated cron job code
2. Monitor first cron run for errors
3. Check metrics: processing time, success rate, retry counts

### Phase 3: Validation (24 hours)

1. Monitor error logs for constraint violations
2. Check disclosure_log for duplicates (should be zero)
3. Verify retry_count increments correctly
4. Confirm no secrets stuck in `processing_started_at`

### Rollback Plan

If critical issues detected:

1. **Code rollback**: Revert to previous deployment (zero downtime)
2. **Schema rollback** (if needed, requires downtime):
   ```sql
   DROP INDEX idx_disclosure_log_unique;
   DROP INDEX idx_disclosure_log_batch_fetch;
   ALTER TABLE secrets DROP COLUMN retry_count;
   ALTER TABLE secrets DROP COLUMN last_retry_at;
   ```

## Risks / Trade-offs

### Risk 1: Migration Duplicate Cleanup

**Issue**: Production may have existing duplicate sent emails\
**Mitigation**: Pre-migration query to count duplicates, manual review if count

> 100\
> **Fallback**: Skip unique constraint if duplicates can't be safely cleaned

### Risk 2: Increased Processing Time

**Issue**: Batch queries and parallel processing add complexity\
**Mitigation**: Integration tests with 100+ secrets, load testing\
**Monitoring**: Track cron job duration in metrics

### Risk 3: Database Constraint Violations

**Issue**: Race conditions may cause INSERT to fail on unique constraint\
**Mitigation**: Graceful handling with ON CONFLICT DO NOTHING\
**Recovery**: Log constraint violations for investigation

### Risk 4: Retry Loop Edge Cases

**Issue**: Retry counter may not increment due to errors\
**Mitigation**: Increment retry_count in outer try-catch\
**Monitoring**: Alert if secrets have retry_count > 10 (should be impossible)

## Open Questions

1. **Duplicate cleanup strategy**: Should we archive duplicate disclosure logs
   or hard delete?
   - **Decision**: Hard delete oldest duplicates to minimize migration
     complexity

2. **Retry backoff configuration**: Should retry delays be configurable?
   - **Decision**: Start with hardcoded values, make configurable if needed
     later

3. **Failed secret handling**: Should `status='failed'` secrets be hidden from
   UI or require manual intervention?
   - **Decision**: Show in UI with error state, allow manual retry button
     (future enhancement)

4. **Performance monitoring**: What metrics should we track for cron job health?
   - **Decision**: Track: duration, processed count, success rate, retry
     distribution, timeout occurrences
