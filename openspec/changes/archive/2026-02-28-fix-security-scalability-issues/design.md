# Design Document: Security & Scalability Fixes

## Architecture Decisions

### 1. PostgreSQL for Distributed Rate Limiting

**Decision:** Use PostgreSQL `UNLOGGED` tables instead of Redis/Memorystore or
Firestore.

**Rationale:**

- **Zero cost:** Already running Cloud SQL PostgreSQL
- **Performance:** 0.65ms latency (vs Redis 0.1ms, Firestore 50-100ms)
- **Reliability:** Immediate TTL expiration (vs Firestore's 24-hour delay)
- **Simplicity:** Familiar SQL, integrates with existing Drizzle ORM

**Trade-offs:**

- 85% slower than Redis but fast enough for rate limiting use case
- Adds load to primary database (estimated <1% based on 50k ops/day)
- Need periodic cleanup job for expired entries

**When to switch to Redis:**

- Traffic exceeds 100k operations/day
- Sub-millisecond latency becomes critical
- Budget allows $48+/month

### 2. PostgreSQL Advisory Locks for Cron Coordination

**Decision:** Use native PostgreSQL advisory locks instead of distributed lock
service.

**Rationale:**

- **Built-in:** No additional infrastructure
- **Reliable:** ACID guarantees, automatic cleanup on connection loss
- **Simple:** Single SQL call to acquire/release lock

**Alternative considered:**

- Redis-based locks (RedLock algorithm) - rejected due to cost
- Database row-level locks - rejected due to deadlock risk
- Cloud Tasks as coordinator - rejected due to complexity

**Implementation:**

```sql
-- Acquire lock
SELECT pg_try_advisory_lock(hashtext('secret-id'))

-- Release lock
SELECT pg_advisory_unlock(hashtext('secret-id'))
```

### 3. Structured Error Types

**Decision:** Create type-safe error hierarchy that prevents sensitive data in
messages.

**Rationale:**

- **Compile-time safety:** TypeScript prevents accidental data leaks
- **Explicit:** Error codes instead of freeform messages
- **Auditable:** Easy to grep for all error sources

**Pattern:**

```typescript
class SecretProcessingError extends Error {
  constructor(
    public readonly secretId: string,
    public readonly errorCode: string,
    private readonly context?: Record<string, unknown>,
  ) {
    super(`Secret processing failed: ${errorCode}`);
  }

  toJSON() {
    return { secretId: this.secretId, errorCode: this.errorCode };
    // context never serialized
  }
}
```

### 4. Cursor-Based Pagination for Cron Jobs

**Decision:** Implement cursor-based pagination with database state persistence.

**Rationale:**

- **Timeout resilience:** Jobs resume from last position
- **Consistency:** Ordered by ID ensures no secrets skipped
- **Observable:** State table shows progress

**Alternative considered:**

- Offset-based pagination - rejected (skips new secrets added during processing)
- Cloud Tasks fan-out - rejected (complexity, cost)
- Multiple cron jobs by shard - rejected (premature optimization)

## Data Model Changes

### New Tables

#### `rate_limits` (UNLOGGED)

```sql
CREATE UNLOGGED TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);
```

**Why UNLOGGED:**

- 2x faster writes (no WAL overhead)
- Data not critical (acceptable to lose on crash)
- Perfect for ephemeral rate limiting data

#### `cron_job_state`

```sql
CREATE TABLE cron_job_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  last_processed_id TEXT,
  processed_count INTEGER DEFAULT 0,
  started_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(job_name, started_at)
);

CREATE INDEX idx_cron_job_state_lookup ON cron_job_state(job_name, started_at DESC);
```

#### `csrf_tokens`

```sql
CREATE TABLE csrf_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_csrf_tokens_session ON csrf_tokens(session_id);
CREATE INDEX idx_csrf_tokens_expires ON csrf_tokens(expires_at);
```

### Index Additions

#### `secrets` table

```sql
-- For overdue secret lookup
CREATE INDEX idx_secrets_overdue_lookup
  ON secrets(status, next_check_in, last_retry_at, retry_count)
  WHERE status = 'active';

-- Partial index for better performance
```

#### `webhook_events` table

```sql
-- For deduplication
CREATE INDEX idx_webhook_events_provider_event
  ON webhook_events(provider, event_id);
```

## Security Considerations

### Rate Limiting

**Threat Model:**

- Attacker with 1000 IPs attempting OTP brute force
- DDoS via secret creation endpoint
- Check-in endpoint abuse

**Mitigation:**

- Per-IP limits (100 req/min general, 5 req/min OTP)
- Per-user limits (50 req/min general)
- Per-endpoint limits (5 req/hour secret creation)
- Global email-based limits (20 OTP attempts/hour across all IPs)

### Webhook Security

**Threat Model:**

- Attacker replays old valid webhooks
- Attacker tries timing attacks on signature validation

**Mitigation:**

- 2-minute timestamp window (down from 5 minutes)
- Constant-time signature validation
- Event ID + timestamp deduplication

### Error Handling

**Threat Model:**

- Encryption keys leaked in error messages
- Server shares exposed in stack traces
- Database schema revealed in errors

**Mitigation:**

- Structured error types with explicit allow-list
- Separate error codes from error messages
- Context object never serialized
- Generic client-facing messages

## Performance Impact

### Rate Limiting Overhead

**Current (in-memory):**

- Latency: <0.01ms
- Memory: ~1KB per 1000 requests
- Scalability: None (per-instance only)

**New (PostgreSQL):**

- Latency: ~0.65ms (65x slower but still fast)
- Database load: +50k queries/day = ~0.58 req/sec avg
- Connection overhead: Uses existing pool
- Storage: ~10MB for 1M entries (auto-cleanup keeps <1000 entries)

**Impact Assessment:**

- API response time increase: <1ms (negligible)
- Database CPU increase: <1% (PostgreSQL handles 10k+ TPS)
- Acceptable trade-off for distributed correctness

### Index Impact

**Query Performance Improvements:**

- Overdue secrets lookup: 1000ms → 5ms (200x faster)
- Webhook deduplication: 100ms → 0.5ms (200x faster)
- OTP cleanup: 500ms → 2ms (250x faster)

**Storage Cost:**

- Indexes: ~50MB additional storage
- Negligible compared to Cloud SQL minimum (10GB)

**Write Performance:**

- Insert overhead: +2-5ms per write (index updates)
- Acceptable for non-hot-path operations

## Migration Strategy

### Drizzle Migration Best Practices

**CRITICAL: All database migrations MUST follow the Drizzle workflow from
`@AGENTS.md`**

Required workflow for every schema change:

1. Modify `src/lib/db/schema.ts` (never edit SQL directly)
2. Run `npx drizzle-kit generate --name="descriptive_name"`
3. Verify THREE files created:
   - SQL file: `drizzle/NNNN_name.sql`
   - Snapshot JSON: `drizzle/meta/NNNN_name_snapshot.json`
   - Journal update: `drizzle/meta/_journal.json`
4. Review generated SQL for correctness
5. Test locally: `npm run db:migrate -- --config=drizzle.config.ts`
6. Commit ALL three files together

**Why this matters:** Drizzle's migration runner requires BOTH the SQL file AND
snapshot JSON. Missing snapshots cause migrations to be silently skipped,
leading to schema drift between environments.

**Never:**

- ❌ Manually create SQL files in `drizzle/`
- ❌ Edit migration files after generation
- ❌ Skip `drizzle-kit generate` and write SQL directly
- ❌ Commit only the SQL file without snapshot

### Phase 1: Schema Changes

1. Create new tables (`rate_limits`, `cron_job_state`, `csrf_tokens`) using
   Drizzle workflow
2. Add indexes to existing tables using Drizzle workflow
3. Deploy schema changes (backward compatible)
4. Monitor for performance regressions

### Phase 2: Code Changes

1. Deploy new rate limiting code (feature flagged)
2. Run old + new in parallel (shadow mode)
3. Compare results for 24 hours
4. Enable new rate limiting for 10% traffic
5. Gradually increase to 100%
6. Remove old code

### Phase 3: Validation

1. Load testing with new rate limiting
2. Test cron job timeout scenarios
3. Verify webhook replay protection
4. Test error handling (no sensitive leaks)
5. Performance benchmarking

## Monitoring & Observability

### New Metrics

**Rate Limiting:**

- `rate_limit_checks_total` (counter by type, result)
- `rate_limit_duration_seconds` (histogram)
- `rate_limit_cache_size` (gauge)

**Cron Jobs:**

- `cron_job_duration_seconds` (histogram by job_name)
- `cron_job_processed_total` (counter by job_name, status)
- `cron_job_resume_count` (counter - indicates timeouts)

**Errors:**

- `error_total` (counter by error_code, severity)
- `sensitive_data_leak_total` (counter - should always be 0)

### Alerts

**Critical:**

- Rate limiting errors > 1% of requests (15min window)
- Cron job failed 3 consecutive times
- Sensitive data detected in logs (immediate page)

**Warning:**

- Cron job resumed from timeout (indicates load issue)
- Database connection pool >80% utilization
- Rate limit table size >10k entries (cleanup failing)

## Rollback Procedures

### Rate Limiting Rollback

1. Disable feature flag (revert to in-memory)
2. No data loss (tables remain for future attempt)
3. ETA: <5 minutes

### Schema Rollback

**If needed within 24 hours:**

```sql
-- Drop new tables
DROP TABLE rate_limits;
DROP TABLE cron_job_state;
DROP TABLE csrf_tokens;

-- Drop new indexes
DROP INDEX idx_secrets_overdue_lookup;
DROP INDEX idx_webhook_events_provider_event;
```

**If needed after 24 hours:**

- Use point-in-time recovery to pre-migration state
- Acceptable data loss: <24 hours of rate limiting data (non-critical)
- ETA: ~2 hours (Cloud SQL PITR)

## Testing Strategy

### Unit Tests

- Rate limiting logic (PostgreSQL backend)
- Advisory lock acquire/release
- Error type serialization
- Cursor pagination logic

### Integration Tests

- Multi-instance rate limiting (Docker Compose with 3 replicas)
- Concurrent cron execution (verify only one processes each secret)
- Webhook replay detection
- Error handling (verify no leaks)

### Load Tests

- 1000 concurrent users
- 10,000 rate limit checks/second
- 1000 overdue secrets processing
- Database connection pool stress test

### Chaos Tests

- Kill cron job mid-processing (verify resume)
- Database connection failures (verify retry)
- Rate limit table full (verify cleanup)

## Documentation Updates

**User-Facing:**

- None (internal infrastructure changes)

**Developer-Facing:**

- Update README with new rate limiting approach
- Document advisory lock usage patterns
- Error handling guidelines
- Migration guide for new tables

**Operational:**

- Runbook for cron job stuck state
- Rate limit table cleanup procedures
- Rollback procedures (this document)
