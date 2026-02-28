# Tasks: fix-security-scalability-issues

## Important: Drizzle Migration Best Practices

**CRITICAL: Follow migration workflow from `@AGENTS.md`**

All database changes MUST follow this workflow:

1. Modify `src/lib/db/schema.ts`
2. Run `npx drizzle-kit generate --name="description_of_change"`
3. Review generated SQL in `drizzle/NNNN_*.sql`
4. Test locally: `npm run db:migrate -- --config=drizzle.config.ts`
5. Commit ALL three files (SQL, snapshot JSON, \_journal.json)

**NEVER:**

- ❌ Manually create SQL files in `drizzle/`
- ❌ Edit migration files after generation
- ❌ Skip `drizzle-kit generate` and create SQL directly

Missing snapshot JSON causes migrations to be silently skipped, leading to
schema drift.

## Phase 1: Critical Fixes (Week 1)

### 1.1 PostgreSQL-Based Rate Limiting

- [ ] 1.1.1 Add `rate_limits` unlogged table to schema.ts with indexes
- [ ] 1.1.2 Generate Drizzle migration:
      `npx drizzle-kit generate --name="add_rate_limits_table"`
- [ ] 1.1.3 Verify THREE files created: SQL, snapshot JSON, \_journal.json
      update
- [ ] 1.1.3 Create `src/lib/rate-limit-db.ts` with PostgreSQL backend
      implementation
- [ ] 1.1.4 Implement atomic increment with TTL handling using
      `INSERT ... ON CONFLICT`
- [ ] 1.1.5 Add cleanup function for expired rate limit entries
- [ ] 1.1.6 Write unit tests for PostgreSQL rate limiting (isolation, TTL,
      concurrency)
- [ ] 1.1.7 Update `checkRateLimit()` to use database instead of in-memory Map
- [ ] 1.1.8 Deploy to staging and validate with multi-instance setup
- [ ] 1.1.9 Load test: 10k rate limit checks/second
- [ ] 1.1.10 Enable in production with monitoring

### 1.2 Distributed Cron Job Locking

- [ ] 1.2.1 Create advisory lock helper functions (`acquireSecretLock`,
      `releaseSecretLock`)
- [ ] 1.2.2 Update `processOverdueSecret()` to acquire lock before processing
- [ ] 1.2.3 Ensure lock release in finally block (handle exceptions)
- [ ] 1.2.4 Add lock timeout after 30 seconds (prevent permanent locks)
- [ ] 1.2.5 Write integration tests: two cron instances processing same secret
- [ ] 1.2.6 Add monitoring for lock contention (`cron_lock_wait_total` metric)
- [ ] 1.2.7 Test with concurrent Cloud Scheduler executions
- [ ] 1.2.8 Deploy to staging with 2 Cloud Run instances
- [ ] 1.2.9 Chaos test: kill instance while holding lock (verify auto-release)

### 1.3 Database Performance Indexes

- [ ] 1.3.1 Add `idx_secrets_overdue_lookup` composite index to secrets table in
      schema.ts
- [ ] 1.3.2 Add `idx_webhook_events_provider_event` to webhook_events table in
      schema.ts
- [ ] 1.3.3 Add `idx_otp_rate_limits_cleanup` to otp_rate_limits table in
      schema.ts (if not exists)
- [ ] 1.3.4 Generate Drizzle migration:
      `npx drizzle-kit generate --name="add_performance_indexes"`
- [ ] 1.3.5 Verify THREE files created: SQL, snapshot JSON, \_journal.json
      update
- [ ] 1.3.6 Test migration locally:
      `npm run db:migrate -- --config=drizzle.config.ts`
- [ ] 1.3.7 Test migration rollback on staging
- [ ] 1.3.8 Benchmark overdue secrets query (before: ~1000ms, target: <10ms)
- [ ] 1.3.9 Deploy migration to staging and monitor query performance
- [ ] 1.3.10 Deploy to production during maintenance window
- [ ] 1.3.11 Verify EXPLAIN ANALYZE shows index usage
- [ ] 1.3.12 Monitor for slow query alerts (should decrease)

### 1.4 Webhook Replay Protection

- [ ] 1.4.1 Update `verifyHMACSignature()` to reduce timestamp window from 5min
      to 2min
- [ ] 1.4.2 Add webhook-specific deduplication with timestamp check
- [ ] 1.4.3 Update `isWebhookProcessed()` to check events within last 24 hours
      only
- [ ] 1.4.4 Add logging for replay attempts (timestamp outside window)
- [ ] 1.4.5 Write tests for old webhook rejection (>2 minutes old)
- [ ] 1.4.6 Test duplicate webhook with different timestamps
- [ ] 1.4.7 Deploy to staging and verify existing webhooks still work
- [ ] 1.4.8 Monitor webhook failure rate (should stay <1%)

### 1.5 Structured Error Handling

- [ ] 1.5.1 Create `src/lib/errors/structured-errors.ts` with base error types
- [ ] 1.5.2 Define error codes enum (DECRYPTION_FAILED, RATE_LIMIT_EXCEEDED,
      etc.)
- [ ] 1.5.3 Implement SecretProcessingError, AuthenticationError, DatabaseError
      classes
- [ ] 1.5.4 Add `toJSON()` method that excludes sensitive context
- [ ] 1.5.5 Update cron job error handling to use structured errors
- [ ] 1.5.6 Update API route error handling to use structured errors
- [ ] 1.5.7 Add global error handler middleware with sanitization
- [ ] 1.5.8 Write tests verifying no sensitive data in serialized errors
- [ ] 1.5.9 Audit all error logs for sensitive data patterns (grep for keys,
      shares)
- [ ] 1.5.10 Deploy and monitor error logs for leaks

### 1.6 Integration & Validation

- [ ] 1.6.1 Run full test suite with all Phase 1 changes
- [ ] 1.6.2 Load test with 1000 concurrent users
- [ ] 1.6.3 Test cron job with 1000 overdue secrets
- [ ] 1.6.4 Verify rate limiting works across 3 Cloud Run instances
- [ ] 1.6.5 Test webhook replay scenarios
- [ ] 1.6.6 Review all error logs for sensitive data
- [ ] 1.6.7 Performance baseline: API p95 latency, database CPU, query times
- [ ] 1.6.8 Deploy to production with gradual rollout (10% → 50% → 100%)

## Phase 2: High Priority Fixes (Weeks 2-3)

### 2.1 Database Connection Pool Optimization

- [ ] 2.1.1 Add environment variables: CLOUD_RUN_CONCURRENCY,
      EXPECTED_INSTANCES, CLOUDSQL_MAX_CONNECTIONS
- [ ] 2.1.2 Implement dynamic pool size calculation based on instance count
- [ ] 2.1.3 Update connection-manager.ts with new pool sizing logic
- [ ] 2.1.4 Add connection pool monitoring (active, idle, waiting)
- [ ] 2.1.5 Implement graceful degradation when pool exhausted (503 with
      retry-after)
- [ ] 2.1.6 Test connection pool exhaustion scenario
- [ ] 2.1.7 Configure PgBouncer with transaction mode
- [ ] 2.1.8 Deploy to staging with 10 Cloud Run instances
- [ ] 2.1.9 Load test: verify no connection exhaustion at 1000 concurrent
      requests

### 2.2 OTP Security Hardening

- [ ] 2.2.1 Increase OTP length from 8 digits to 10 digits (1B possible codes)
- [ ] 2.2.2 Implement global rate limit per email (20 attempts/hour across all
      IPs)
- [ ] 2.2.3 Add `checkGlobalOTPRateLimit()` function querying
      verification_tokens
- [ ] 2.2.4 Update `createOTPToken()` to check both IP and global limits
- [ ] 2.2.5 Add account lockout after 50 failed attempts (24 hour cooldown)
- [ ] 2.2.6 Send security alert email when account locked
- [ ] 2.2.7 Write tests for multi-IP brute force scenario
- [ ] 2.2.8 Update OTP email template with longer code format
- [ ] 2.2.9 Deploy to staging and test OTP flow end-to-end

### 2.3 Cron Job Timeout Handling

- [ ] 2.3.1 Add `cron_job_state` table to schema.ts with indexes
- [ ] 2.3.2 Generate Drizzle migration:
      `npx drizzle-kit generate --name="add_cron_job_state_table"`
- [ ] 2.3.3 Verify THREE files created: SQL, snapshot JSON, \_journal.json
      update
- [ ] 2.3.4 Implement state persistence in process-reminders route
- [ ] 2.3.5 Update secret query to use cursor pagination (WHERE id >
      last_processed_id)
- [ ] 2.3.6 Add timeout check in processing loop (exit at 8:30 to allow cleanup)
- [ ] 2.3.7 Save state before timeout exit
- [ ] 2.3.8 Clear state table when job completes
- [ ] 2.3.9 Add monitoring: cron_job_resume_count metric
- [ ] 2.3.10 Test with 2000 overdue secrets (should resume after timeout)
- [ ] 2.3.11 Verify no secrets skipped or duplicated

### 2.4 CSRF Token One-Time Use

- [ ] 2.4.1 Add `csrf_tokens` table to schema.ts with indexes
- [ ] 2.4.2 Generate Drizzle migration:
      `npx drizzle-kit generate --name="add_csrf_tokens_table"`
- [ ] 2.4.3 Verify THREE files created: SQL, snapshot JSON, \_journal.json
      update
- [ ] 2.4.4 Update `generateCSRFToken()` to store in database with 5min TTL
- [ ] 2.4.5 Update `requireCSRFProtection()` to delete token after use
      (transaction)
- [ ] 2.4.6 Add CSRF token refresh mechanism (generate new token in response)
- [ ] 2.4.7 Update API routes to include new token in response headers
- [ ] 2.4.8 Add periodic cleanup job for expired CSRF tokens
- [ ] 2.4.9 Write tests for token reuse (should fail)
- [ ] 2.4.10 Write tests for concurrent token usage (race condition)
- [ ] 2.4.11 Deploy to staging and test UI flows

### 2.5 Encryption Key Rotation

- [ ] 2.5.1 Create `src/lib/encryption/key-rotation.ts` module
- [ ] 2.5.2 Implement `rotateEncryptionKey()` to generate new key version
- [ ] 2.5.3 Store new key in Google Secret Manager (not env vars)
- [ ] 2.5.4 Implement background re-encryption job (batch processing)
- [ ] 2.5.5 Add `reEncryptSecrets()` function processing 100 secrets at a time
- [ ] 2.5.6 Add progress tracking table for re-encryption job
- [ ] 2.5.7 Add admin API endpoint to trigger rotation (manual for now)
- [ ] 2.5.8 Write tests for re-encryption (decrypt with old, encrypt with new)
- [ ] 2.5.9 Document key rotation procedure in ops runbook
- [ ] 2.5.10 Test rotation on staging with 1000 secrets

### 2.6 Integration & Validation

- [ ] 2.6.1 Run full test suite with all Phase 2 changes
- [ ] 2.6.2 Load test with 2000 concurrent users
- [ ] 2.6.3 Test complete OTP flow with new security measures
- [ ] 2.6.4 Verify cron job handles 3000 overdue secrets (multiple resumes)
- [ ] 2.6.5 Test CSRF token flow in UI (ensure smooth UX)
- [ ] 2.6.6 Perform test key rotation on staging
- [ ] 2.6.7 Security audit: attempt to bypass new protections
- [ ] 2.6.8 Deploy to production with monitoring

## Phase 3: Testing & Documentation (Week 4)

### 3.1 Comprehensive Testing

- [ ] 3.1.1 Unit tests: 100% coverage for new modules
- [ ] 3.1.2 Integration tests: multi-instance scenarios (Docker Compose)
- [ ] 3.1.3 Load tests: 5000 concurrent users for 30 minutes
- [ ] 3.1.4 Chaos tests: database failures, instance crashes, network issues
- [ ] 3.1.5 Security tests: attempt rate limit bypass, OTP brute force, webhook
      replay
- [ ] 3.1.6 Performance regression tests: ensure no slowdown in critical paths

### 3.2 Monitoring & Alerting

- [ ] 3.2.1 Add all metrics to Cloud Monitoring dashboard
- [ ] 3.2.2 Configure critical alerts (rate limit errors, cron failures, pool
      exhaustion)
- [ ] 3.2.3 Configure warning alerts (cron resumes, high pool utilization)
- [ ] 3.2.4 Set up log-based metrics for sensitive data leaks (should be 0)
- [ ] 3.2.5 Create on-call runbook with troubleshooting steps

### 3.3 Documentation

- [ ] 3.3.1 Update README with rate limiting architecture
- [ ] 3.3.2 Document advisory lock patterns for future cron jobs
- [ ] 3.3.3 Create error handling guidelines for developers
- [ ] 3.3.4 Update deployment docs with new migration procedures
- [ ] 3.3.5 Write ops runbook for common issues (stuck cron, pool exhaustion)
- [ ] 3.3.6 Document rollback procedures for each component

### 3.4 Production Deployment

- [ ] 3.4.1 Schedule maintenance window for migration
- [ ] 3.4.2 Deploy schema migrations during window
- [ ] 3.4.3 Deploy code with feature flags enabled
- [ ] 3.4.4 Monitor for 24 hours with heightened alerting
- [ ] 3.4.5 Gradually enable new features (10% → 50% → 100%)
- [ ] 3.4.6 Verify all metrics within expected ranges
- [ ] 3.4.7 Close out security review findings in tracking system

## Dependencies

- Phase 2 depends on Phase 1 completion (database schema)
- Phase 3 runs in parallel with Phase 2 (testing during development)
- Production deployment requires all phases complete

## Success Criteria

- [ ] All critical and high-priority issues resolved
- [ ] Rate limiting works correctly across multiple Cloud Run instances
- [ ] No duplicate secret disclosures (verified in tests)
- [ ] Query performance improved 100x+ (verified with EXPLAIN ANALYZE)
- [ ] No webhook replay attacks possible (verified in security tests)
- [ ] Zero sensitive data leaks in error logs (verified in audit)
- [ ] System handles 1000+ overdue secrets without timeout
- [ ] Database connections scale to 100+ Cloud Run instances
- [ ] OTP brute force attack infeasible (verified mathematically)
- [ ] CSRF tokens cannot be reused (verified in tests)
- [ ] Encryption key rotation procedure documented and tested

## Validation Checkpoints

After Phase 1:

- [ ] Rate limiting query: `SELECT COUNT(*) FROM rate_limits` returns >0 on
      production
- [ ] Cron lock query: Check pg_locks for advisory locks during cron execution
- [ ] Index usage: `EXPLAIN ANALYZE` on overdue secrets query shows index scan
- [ ] Webhook test: Send old webhook (>2min), verify rejection
- [ ] Error log audit: No encryption keys, shares, or PII in logs

After Phase 2:

- [ ] Connection pool: Monitor shows dynamic sizing based on instance count
- [ ] OTP attempts: Verify global rate limit triggers after 20 attempts
- [ ] Cron state: `SELECT * FROM cron_job_state` shows resume behavior
- [ ] CSRF test: Reuse token, verify rejection
- [ ] Key rotation: Verify secrets can be decrypted after rotation

Final Production Validation:

- [ ] 7-day uptime with no rate limiting errors
- [ ] 7-day uptime with no duplicate secret disclosures
- [ ] Query performance dashboards show <10ms p95
- [ ] Security scan shows all critical findings resolved
- [ ] Load test passes at 2x expected production traffic
