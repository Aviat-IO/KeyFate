# Design Document: Security Audit Remediation

## Context

A comprehensive security audit identified 63 issues spanning critical security
vulnerabilities, performance problems, and code quality concerns. This design
addresses the implementation strategy for resolving these issues while
maintaining system stability and backward compatibility.

### Background

- Production system handling sensitive user data and secrets
- Zero-knowledge architecture requires careful security considerations
- Must maintain 99.9% uptime during remediation
- Current system lacks comprehensive monitoring and alerting

### Constraints

- No breaking API changes allowed
- Database migrations must be non-blocking
- Must support rollback for all changes
- Performance impact must be minimal (<5% latency increase)

### Stakeholders

- Security team (vulnerability remediation)
- Operations team (monitoring and alerting)
- Development team (code quality improvements)
- Users (improved security and reliability)

## Goals / Non-Goals

### Goals

1. **Security hardening:** Fix all 8 critical vulnerabilities before production
   launch
2. **Monitoring:** Implement comprehensive observability for cron jobs and
   system health
3. **Reliability:** Add circuit breakers, connection pooling, and retry logic
4. **Code quality:** Standardize error handling, validation, and testing
   patterns

### Non-Goals

- Complete rewrite of authentication system (incremental improvements only)
- Migration to different database or cloud provider
- UI/UX changes (backend focus)
- Performance optimization beyond critical path fixes

## Decisions

### 1. Database Connection Pooling

**Decision:** Use node-postgres (pg) connection pool with Drizzle ORM

**Rationale:**

- Drizzle already supports pg Pool instances
- Industry-standard connection pooling
- Configurable pool size and health monitoring
- Graceful degradation on connection failures

**Configuration:**

```typescript
{
  max: 20,              // Maximum connections (Cloud SQL limit: 25)
  min: 2,               // Minimum idle connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500         // Connection recycling
}
```

**Alternatives considered:**

- PgBouncer: Too complex for current scale, adds operational overhead
- Prisma: Would require full ORM migration
- Drizzle serverless: Not suitable for long-running cron jobs

### 2. Account Lockout Strategy

**Decision:** Progressive lockout with permanent lock after 20 attempts

**Lockout tiers:**

- 5 failed attempts → 1 hour lockout
- 10 failed attempts → 24 hour lockout
- 20 failed attempts → permanent lockout + admin alert

**Rationale:**

- Balances security (prevent brute force) with usability (temporary lockouts)
- Admin alerts for severe cases enable manual review
- Email-based reset flow for legitimate users

**Alternatives considered:**

- CAPTCHA after failures: Poor UX, bypassable
- Exponential backoff only: Doesn't prevent persistent attacks
- IP-based lockout only: Can block legitimate users behind NAT

### 3. Encryption Key Versioning

**Decision:** Store key version with each encrypted secret, support multiple
active keys

**Schema change:**

```sql
ALTER TABLE secrets ADD COLUMN key_version INTEGER DEFAULT 1;
CREATE INDEX idx_secrets_key_version ON secrets(key_version);
```

**Key rotation process:**

1. Deploy code with new key (ENCRYPTION_KEY_V2)
2. New secrets use v2, existing secrets stay on v1
3. Background job re-encrypts old secrets (future enhancement)
4. Decommission v1 key after migration complete

**Rationale:**

- Enables zero-downtime key rotation
- No forced re-encryption of all secrets immediately
- Supports gradual migration and rollback

**Alternatives considered:**

- Immediate re-encryption: Risky, could cause data loss
- Separate key per user: Overly complex key management
- No versioning: Cannot rotate keys safely

### 4. CSRF Protection Implementation

**Decision:** Double-submit cookie pattern with server-side token validation

**Flow:**

1. Client requests CSRF token from `/api/csrf-token`
2. Server generates token, stores in database with session ID
3. Client includes token in `X-CSRF-Token` header for state-changing requests
4. Server validates token against database, deletes after use (one-time use)

**Rationale:**

- More secure than cookie-only approach
- Works with API clients (not just browsers)
- One-time use tokens prevent replay attacks
- Database storage allows for token revocation

**Alternatives considered:**

- Cookie-only: Less secure, no API support
- JWT-based: More complex, harder to revoke
- Origin header only (current): Insufficient protection

### 5. Cron Job Monitoring Architecture

**Decision:** Centralized `CronMonitor` class with Google Cloud Monitoring
integration

**Components:**

- `CronMonitor` class: Metrics collection and anomaly detection
- Cloud Monitoring: Time-series metrics storage
- Alerting: Email/Slack notifications for failures
- Structured logging: JSON logs with request IDs

**Metrics tracked:**

- Execution duration (p50, p95, p99)
- Success/failure rates
- Processed/succeeded/failed counts
- Anomaly detection (sudden spikes, slow execution)

**Rationale:**

- Proactive issue detection before user impact
- Historical metrics for capacity planning
- Automated alerting reduces manual monitoring burden

**Alternatives considered:**

- Third-party APM (Datadog, New Relic): Too expensive for current scale
- Log-only monitoring: Insufficient for real-time alerting
- No monitoring: Unacceptable for production system

### 6. Circuit Breaker for Email Service

**Decision:** Simple state machine circuit breaker (CLOSED → OPEN → HALF_OPEN)

**States:**

- CLOSED: Normal operation
- OPEN: Service unavailable, fail fast
- HALF_OPEN: Testing service recovery

**Thresholds:**

- Open circuit after 5 consecutive failures
- Stay open for 60 seconds
- Allow 3 test requests in HALF_OPEN state

**Fallback:** Queue emails for later retry when circuit is open

**Rationale:**

- Prevents cascading failures
- Reduces wasted API calls during outages
- Automatic recovery testing
- User experience: delayed delivery better than failed delivery

**Alternatives considered:**

- Retry-only: Doesn't prevent resource exhaustion
- Multi-provider fallback: Adds complexity, cost
- No resilience: Unacceptable for critical notifications

### 7. Input Validation Strategy

**Decision:** Zod schemas for all API endpoints with centralized validation
middleware

**Approach:**

- Define Zod schemas per endpoint
- Validate in middleware before handler execution
- Return standardized 400 errors with field-level details
- Log validation failures for security monitoring

**Example:**

```typescript
const secretIdSchema = z.object({
  id: z.string().uuid(),
});

export const validateRequest = (schema: ZodSchema) => (handler) => {
  return async (req, res) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
    }
    return handler(req, res);
  };
};
```

**Rationale:**

- Type-safe validation with TypeScript inference
- Consistent validation across all endpoints
- Detailed error messages for debugging
- Prevents injection attacks and malformed data

**Alternatives considered:**

- Joi: Less TypeScript integration
- Express-validator: More boilerplate
- Manual validation: Error-prone, inconsistent

## Risks / Trade-offs

### Risk: Database Migration Performance Impact

- **Impact:** Index creation may lock tables, causing downtime
- **Mitigation:** Use `CONCURRENTLY` for index creation (PostgreSQL 11+)
- **Rollback:** Drop indexes if performance degrades

### Risk: Connection Pool Exhaustion

- **Impact:** New requests fail when pool is full
- **Mitigation:**
  - Set max pool size to 20 (80% of Cloud SQL limit)
  - Implement connection timeout and retry logic
  - Monitor pool utilization metrics
- **Rollback:** Reduce pool size or fall back to single connection

### Risk: Account Lockout False Positives

- **Impact:** Legitimate users locked out due to typos
- **Mitigation:**
  - Progressive lockout delays (not immediate permanent lock)
  - Admin unlock endpoint for support team
  - Clear error messages guiding users to support
- **Rollback:** Disable lockout feature via feature flag

### Risk: CSRF Token Storage Growth

- **Impact:** Database bloat from expired tokens
- **Mitigation:**
  - 1-hour token expiration
  - Daily cleanup job for expired tokens
  - One-time use (deleted after validation)
- **Rollback:** Disable CSRF validation, fall back to origin check

### Risk: Circuit Breaker False Opens

- **Impact:** Email service appears down when it's actually operational
- **Mitigation:**
  - Configurable failure threshold (default: 5)
  - Quick recovery testing (HALF_OPEN after 60s)
  - Admin dashboard showing circuit breaker state
- **Rollback:** Disable circuit breaker via feature flag

### Trade-off: Security vs. Performance

- **Decision:** Prioritize security even if it adds latency
- **Impact:** CSRF validation, input validation, and rate limiting add ~10-50ms
  per request
- **Justification:** Security requirements outweigh minor latency increase for
  sensitive operations

### Trade-off: Monitoring Cost vs. Observability

- **Decision:** Invest in comprehensive monitoring despite cost
- **Impact:** Google Cloud Monitoring costs ~$50-100/month
- **Justification:** Early problem detection saves more than monitoring cost

## Migration Plan

### Phase 1: Critical Fixes (Week 1)

1. Deploy webhook cleanup fix (no migration needed)
2. Deploy database connection pooling (config change only)
3. Deploy server-env protection (build-time change)
4. **Database migration:** Create `account_lockouts` table
5. Deploy account lockout logic
6. Deploy HTTPS enforcement (middleware change)
7. **Database migration:** Add `key_version` column to secrets
8. Deploy encryption key validation
9. Deploy IP-based rate limiting (in-memory state)
10. Deploy input validation fixes

**Rollback:** Revert deployment, migrations are additive only

### Phase 2: High Severity Fixes (Week 2)

1. **Database migration:** Create `csrf_tokens` table
2. Deploy CSRF token implementation
3. Deploy secure memory handling (code change only)
4. Deploy request ID propagation (code change only)
5. Deploy email circuit breaker (code change only)
6. **Database migration:** Create performance indexes
7. Deploy timing attack fix (code change only)
8. Deploy cron job monitoring (code change only)

**Rollback:** Revert deployment, keep database tables/indexes

### Phase 3: Medium/Low Severity (Weeks 3-4)

- Deploy incrementally with feature flags
- Monitor metrics for regression
- Rollback individual features if needed

### Phase 4: Validation (Week 5)

- Security audit re-run
- Load testing
- Penetration testing
- Production deployment with gradual rollout

**Rollback strategy:**

- Feature flags for all major changes
- Database migrations are non-destructive (add only, no drop)
- Keep previous deployment ready for quick rollback
- Monitor error rates and rollback if >1% increase

## Open Questions

1. **Q:** Should we implement automatic key rotation schedule? **A:** Defer to
   future enhancement; manual rotation sufficient initially

2. **Q:** What's the appropriate alert threshold for circuit breaker opens?
   **A:** Alert immediately on OPEN state, critical alert if open >5 minutes

3. **Q:** Should account lockout apply to all authentication methods or just
   OTP? **A:** Start with OTP only; expand to OAuth failures in future

4. **Q:** How to handle existing sessions when security fixes are deployed?
   **A:** Allow existing sessions to continue; new sessions use new security
   rules

5. **Q:** Should we add rate limiting to all API endpoints or just
   authentication? **A:** Start with authentication and payment endpoints;
   expand based on abuse patterns

## Success Criteria

### Security

- ✅ All 8 critical vulnerabilities resolved
- ✅ Security audit shows no high-risk findings
- ✅ Penetration testing passes without critical issues
- ✅ Zero security incidents in first 30 days post-deployment

### Reliability

- ✅ 99.9% uptime maintained during deployment
- ✅ Database connection pool utilization <80%
- ✅ Email circuit breaker recovers automatically from outages
- ✅ No user-reported lockout issues (except legitimate security blocks)

### Observability

- ✅ All cron jobs reporting metrics to monitoring system
- ✅ Alerting functional for critical failures
- ✅ Request IDs in 100% of logs
- ✅ Dashboard showing system health at a glance

### Performance

- ✅ API latency increase <10% (p95)
- ✅ Database query performance maintained or improved
- ✅ No regression in test coverage (<80%)
- ✅ Build and deployment time <15 minutes

### Deployment

- ✅ Zero-downtime deployment achieved
- ✅ Database migrations complete in <5 minutes
- ✅ Rollback tested and documented
- ✅ All runbooks updated with new procedures
