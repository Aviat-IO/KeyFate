# fix-security-scalability-issues

**Status:** Proposed\
**Complexity:** High\
**Risk:** Medium\
**Dependencies:** None

## Why

The application is not production-ready for distributed deployment on Cloud Run.
Critical security and scalability issues prevent safe operation at scale and
expose the system to attacks and data loss.

## Problem

A comprehensive security and scalability review identified 20 issues across
critical, high, medium, and low priority categories. These issues pose
significant risks to production deployment:

**Critical Issues (5):**

1. In-memory rate limiting won't work across multiple Cloud Run instances
   (distributed system failure)
2. Race conditions in cron job secret processing could cause duplicate secret
   disclosures
3. Missing database indexes causing performance degradation under load
4. Webhook replay attack vulnerability (insufficient timestamp validation)
5. Sensitive data exposure in error logs (encryption keys, server shares, PII)

**High Priority Issues (5):** 6. Database connection pool exhaustion risk in
multi-instance deployments 7. OTP brute force vulnerability (parallelizable
across IPs) 8. Cron job timeout risk with large backlogs (>1000 overdue
secrets) 9. CSRF token reuse vulnerability 10. No encryption key rotation
mechanism

The system currently uses in-memory `Map` for rate limiting, which fails in
distributed Cloud Run deployments. PostgreSQL-based rate limiting offers
zero-cost solution using existing infrastructure.

## Solution

Implement critical and high-priority security/scalability fixes in phased
approach:

**Phase 1 (Critical - Week 1):**

- Replace in-memory rate limiting with PostgreSQL-backed distributed solution
  using unlogged tables
- Add PostgreSQL advisory locks for cron job coordination
- Create database migrations with missing performance indexes
- Tighten webhook timestamp validation to 2 minutes
- Implement structured error types to prevent sensitive data leaks

**Phase 2 (High Priority - Weeks 2-3):**

- Optimize database connection pooling with dynamic sizing
- Strengthen OTP security with global rate limits and longer codes
- Implement cron job state persistence for timeout handling
- Fix CSRF token reuse with one-time tokens
- Add encryption key rotation mechanism

**Technical Approach:**

- **PostgreSQL for rate limiting:** Use `UNLOGGED` tables for 2x faster writes,
  zero additional cost
- **Advisory locks:** Native PostgreSQL locks for distributed coordination
- **Structured errors:** Type-safe error handling that prevents data leaks by
  design
- **Cursor-based pagination:** Cron jobs resume from last position on timeout
- **Dynamic connection pooling:** Calculate pool size based on Cloud Run
  concurrency

## Impact

**Benefits:**

- Production-ready distributed rate limiting across Cloud Run instances
- Eliminates duplicate secret disclosure risk
- Improves query performance 10-100x with proper indexes
- Prevents webhook replay attacks
- Protects sensitive data in logs and error messages
- Handles 1000+ overdue secrets without timeout
- Scales to 100+ Cloud Run instances safely

**Risks:**

- Database load increase from rate limiting (minimal - <1% based on PostgreSQL
  benchmarks)
- Migration complexity with multiple schema changes
- Requires coordination of code + database changes

**Rollback Plan:**

- Database migrations include rollback scripts
- Feature flags for new rate limiting (gradual rollout)
- Old code compatible with new schema (additive changes only)

## Estimation

**Effort:** 140 hours (~3.5 weeks full-time)

- Phase 1 (Critical): 40 hours
- Phase 2 (High Priority): 60 hours
- Testing & validation: 40 hours

**Timeline:**

- Week 1: Critical fixes
- Weeks 2-3: High priority fixes
- Week 4: Integration testing, documentation

## Decisions

1. **Scope:** Implement all high-priority fixes in Phase 2 ✅
2. **Feature flags:** No feature flags - direct implementation ✅
3. **Encryption key rotation:** Manual admin-triggered rotation ✅
4. **Performance target:** <5ms for rate limiting checks ✅

## References

- Full security review: `/SECURITY_SCALABILITY_REVIEW.md`
- PostgreSQL vs Redis vs Firestore cost analysis (in task session)
- Current rate limiting: `frontend/src/lib/rate-limit.ts`
- Cron job processing: `frontend/src/app/api/cron/process-reminders/route.ts`
