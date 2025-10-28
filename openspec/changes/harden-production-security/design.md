# Production Security Hardening Design

## Context

KeyFate is a zero-knowledge dead man's switch platform that stores one encrypted
Shamir share server-side. A comprehensive security review identified 41 issues
preventing production launch, with 8 critical blockers requiring immediate
remediation. The application currently lacks fundamental security controls
including CSRF protection, rate limiting, secure OTP implementation, and proper
logging practices. These gaps expose the platform to authentication bypass,
brute-force attacks, and potential secret compromise.

**Stakeholders:** Security team, operations team, compliance team, end users

**Constraints:**

- Zero-knowledge architecture must be preserved (no access to original secrets)
- Cannot break existing API contracts for active users
- Must support both Stripe and BTCPay payment providers
- Must comply with GDPR for EU users
- Must maintain <500ms p95 response times under normal load

## Goals / Non-Goals

### Goals

- Eliminate all 8 critical security blockers preventing production launch
- Implement defense-in-depth with multiple security layers
- Enable security monitoring and incident response capabilities
- Achieve GDPR compliance for EU operations
- Maintain zero-knowledge security model throughout
- Support 10,000 concurrent users with existing infrastructure

### Non-Goals

- Implementing SMS/phone notifications (future feature)
- Adding two-factor authentication beyond OTP (future enhancement)
- Rewriting entire authentication system (strengthen existing)
- Migrating to different database or framework
- Supporting non-email contact methods in this phase

## Decisions

### Decision 1: Use NextAuth Built-in CSRF Protection

**What:** Leverage NextAuth's existing CSRF token implementation rather than
building custom solution

**Why:**

- Already integrated with authentication flow
- Battle-tested implementation with community support
- Automatic token generation and validation
- Works seamlessly with session management

**Alternatives considered:**

1. Custom CSRF middleware - Rejected: Duplicates existing functionality, more
   maintenance burden
2. SameSite cookies only - Rejected: Insufficient protection for cross-origin
   attacks
3. Double-submit cookie pattern - Rejected: More complex than NextAuth approach

**Trade-offs:**

- ✅ Quick to implement, well-documented
- ✅ Integrates with existing auth infrastructure
- ⚠️ Requires all API consumers to obtain CSRF tokens
- ⚠️ May need custom handling for cron/webhook endpoints

### Decision 2: Redis for Rate Limiting with LRU Cache Fallback

**What:** Use Redis for rate limiting in production, with in-memory LRU cache
for development

**Why:**

- Redis provides distributed rate limiting across multiple instances
- LRU cache sufficient for single-instance development
- Both solutions support TTL-based expiration
- Graceful degradation if Redis unavailable (log warning, allow request)

**Alternatives considered:**

1. Database-backed rate limiting - Rejected: Too slow, adds unnecessary load
2. In-memory only - Rejected: Doesn't work with horizontal scaling
3. Third-party service (Cloudflare, AWS WAF) - Rejected: Adds external
   dependency and cost

**Implementation:**

```typescript
// frontend/src/lib/rate-limit.ts
import Redis from "ioredis";
import { LRUCache } from "lru-cache";

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

const lruCache = new LRUCache<string, number>({ max: 10000 });

export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<{ success: boolean; remaining: number }> {
  if (redis) {
    const key = `ratelimit:${identifier}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, Math.ceil(windowMs / 1000));
    return { success: count <= limit, remaining: Math.max(0, limit - count) };
  }

  // Fallback to LRU cache
  const count = (lruCache.get(identifier) || 0) + 1;
  lruCache.set(identifier, count, { ttl: windowMs });
  return { success: count <= limit, remaining: Math.max(0, limit - count) };
}
```

**Trade-offs:**

- ✅ Scalable, distributed, production-ready
- ✅ Fallback enables local development without Redis
- ⚠️ Redis adds infrastructure dependency
- ⚠️ Must monitor Redis availability and performance

### Decision 3: Strengthen OTP to 8 Digits with 5-Minute Expiration

**What:** Increase OTP from 6 to 8 digits and reduce expiration from 10 to 5
minutes

**Why:**

- 6 digits = 1M combinations vulnerable to brute-force (333 attempts/hour at 3
  requests/hour)
- 8 digits = 100M combinations makes brute-force infeasible
- 5-minute expiration reduces attack window and aligns with industry standards
  (Google, GitHub)
- Combined with per-email rate limiting, achieves strong protection

**Math:**

- Current: 1,000,000 combinations / 3 requests per hour = 333,333 hours to
  brute-force one email
- With 5 validation attempts per token, attacker gets 15 guesses per hour
- Probability of success in 24 hours: 360 / 1,000,000 = 0.036% (still too high)
- Improved: 100,000,000 combinations / 15 attempts per hour = 6,666,667 hours
  (761 years)

**Alternatives considered:**

1. Keep 6 digits with more aggressive rate limiting - Rejected: Poor user
   experience, still vulnerable
2. Add CAPTCHA to OTP requests - Rejected: Adds complexity, doesn't prevent all
   attacks
3. Use TOTP (Google Authenticator style) - Rejected: Breaks passwordless flow,
   requires app

**Migration Path:**

1. Deploy 8-digit generation code
2. Accept both 6 and 8 digit codes for 24 hours
3. Email users about change during grace period
4. Switch to 8-digit only validation after 24 hours

**Trade-offs:**

- ✅ Dramatically increases security against brute-force
- ✅ Aligns with industry best practices
- ⚠️ Users must adapt to 8-digit codes (minor UX impact)
- ⚠️ 5-minute window may be tight for slow email delivery (monitor bounce rate)

### Decision 4: Structured Logging with Sentry APM

**What:** Implement structured logging with automatic sensitive data redaction
and Sentry for error tracking

**Why:**

- Current logging uses console.log with potential sensitive data exposure
- Need centralized error tracking for production monitoring
- Sentry provides automatic error grouping, alerts, and performance monitoring
- Structured logging enables better debugging and audit trails

**Redaction Strategy:**

- Automatically redact fields: `serverShare`, `encryptedShare`, `secret`,
  `token`, `password`, `key`, `otp`
- Use allowlist for safe data: `userId`, `secretId`, `status`, `timestamp`,
  `method`, `path`
- Replace sensitive values with `[REDACTED]` in logs
- Never log raw request/response bodies without sanitization

**Alternatives considered:**

1. ELK Stack (Elasticsearch, Logstash, Kibana) - Rejected: Over-engineered for
   current scale
2. Datadog - Rejected: More expensive than Sentry for similar features
3. CloudWatch only - Rejected: Limited alerting and error grouping capabilities

**Implementation:**

```typescript
// frontend/src/lib/logger.ts
import * as Sentry from "@sentry/nextjs";

const SENSITIVE_FIELDS = [
  "serverShare",
  "encryptedShare",
  "secret",
  "token",
  "password",
  "key",
  "otp",
];

function sanitize(data: any): any {
  if (!data || typeof data !== "object") return data;

  const sanitized = Array.isArray(data) ? [] : {};
  for (const [key, value] of Object.entries(data)) {
    if (
      SENSITIVE_FIELDS.some((field) =>
        key.toLowerCase().includes(field.toLowerCase())
      )
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  info: (message: string, data?: any) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        data: sanitize(data),
        timestamp: new Date().toISOString(),
      }),
    );
  },
  error: (message: string, error?: any, data?: any) => {
    const sanitizedData = sanitize(data);
    console.error(
      JSON.stringify({
        level: "error",
        message,
        error: error?.message,
        data: sanitizedData,
        timestamp: new Date().toISOString(),
      }),
    );
    Sentry.captureException(error, { extra: sanitizedData });
  },
  warn: (message: string, data?: any) => {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        data: sanitize(data),
        timestamp: new Date().toISOString(),
      }),
    );
  },
};
```

**Trade-offs:**

- ✅ Centralized monitoring with alerting
- ✅ Automatic error grouping and performance tracking
- ✅ Prevents sensitive data leaks
- ⚠️ Sentry costs scale with event volume (free tier: 5k events/month)
- ⚠️ Must carefully configure data scrubbing rules

### Decision 5: Webhook Replay Protection via Database Deduplication

**What:** Store processed webhook event IDs in database with unique constraint
to prevent replay attacks

**Why:**

- Payment webhooks grant Pro access - replay attacks could give free upgrades
- Stripe and BTCPay both provide unique event IDs
- Database unique constraint provides atomic deduplication
- Simple, reliable, no external dependencies

**Schema:**

```typescript
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 50 }).notNull(), // 'stripe' | 'btcpay'
    externalId: varchar("external_id", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
    payload: jsonb("payload"),
  },
  (table) => ({
    uniqueEvent: unique().on(table.provider, table.externalId),
  }),
);
```

**Processing Flow:**

1. Receive webhook
2. Verify signature (already implemented)
3. Attempt to insert webhook event into database
4. If unique constraint violation, return 200 OK (idempotent)
5. If insert succeeds, process webhook and return 200 OK
6. Clean up events older than 30 days (cron job)

**Alternatives considered:**

1. Redis-based deduplication - Rejected: Adds dependency, no persistence
   guarantee
2. In-memory cache - Rejected: Lost on restart, doesn't work with multiple
   instances
3. Timestamp-based replay protection - Rejected: Clock skew issues, less
   reliable

**Trade-offs:**

- ✅ Simple, reliable, atomic deduplication
- ✅ Audit trail of all webhook events
- ✅ No additional infrastructure required
- ⚠️ Database write on every webhook (low volume, acceptable)
- ⚠️ Must implement cleanup to prevent unbounded growth

### Decision 6: Startup Validation Script Blocks Application Start

**What:** Run validation script that checks all required environment variables
before application accepts traffic

**Why:**

- Fail-fast principle: catch misconfigurations before they cause runtime errors
- Current lazy validation crashes mid-request when encryption needed
- Clearer error messages during deployment
- Prevents partial deployments with missing configuration

**Implementation:**

```typescript
// scripts/validate-env.js
const required = {
  ENCRYPTION_KEY: (val) => {
    const decoded = Buffer.from(val, "base64");
    if (decoded.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be 32 bytes");
    }
  },
  NEXTAUTH_SECRET: (val) => {
    if (val.length < 32) {
      throw new Error("NEXTAUTH_SECRET must be at least 32 characters");
    }
  },
  CRON_SECRET: (val) => {
    if (val.length < 32) {
      throw new Error("CRON_SECRET must be at least 32 characters");
    }
  },
  ADMIN_TOKEN: (val) => {
    if (val.length < 32) {
      throw new Error("ADMIN_TOKEN must be at least 32 characters");
    }
  },
  DATABASE_URL: (val) => {
    if (!val.startsWith("postgresql://")) {
      throw new Error("DATABASE_URL must be PostgreSQL connection string");
    }
  },
  SENDGRID_API_KEY: () => {},
  SENDGRID_ADMIN_EMAIL: (val) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      throw new Error("SENDGRID_ADMIN_EMAIL must be valid email");
    }
  },
};

for (const [key, validate] of Object.entries(required)) {
  const value = process.env[key];
  if (!value) {
    console.error(`FATAL: Required environment variable ${key} is not set`);
    process.exit(1);
  }
  try {
    validate(value);
  } catch (err) {
    console.error(`FATAL: ${key} validation failed: ${err.message}`);
    process.exit(1);
  }
}

console.log("✓ All environment variables validated successfully");
```

**Startup Script Update:**

```json
{
  "scripts": {
    "build": "node scripts/validate-env.js && next build",
    "start": "node scripts/validate-env.js && next start",
    "dev": "node scripts/validate-env.js && next dev"
  }
}
```

**Alternatives considered:**

1. Runtime validation on first use - Rejected: Current approach, causes
   mid-request failures
2. Validation endpoint - Rejected: Doesn't prevent app startup with bad config
3. TypeScript-based validation - Rejected: Doesn't catch missing env vars at
   build time

**Trade-offs:**

- ✅ Fail-fast, clear error messages
- ✅ Catches issues before production traffic
- ✅ Simple to implement and maintain
- ⚠️ Slows startup by ~100ms (negligible)
- ⚠️ Must keep validation rules in sync with code

## Risks / Trade-offs

### High Risk: OTP Change Impacts Active Users

**Risk:** Users with in-flight OTP codes during deployment will experience login
failures

**Mitigation:**

1. Implement grace period accepting both 6 and 8 digit codes for 24 hours
2. Send advance email notification 7 days before deployment
3. Deploy during low-traffic window (3 AM UTC Tuesday)
4. Monitor login failure rate and rollback if >5% spike
5. Prepare support team with talking points about OTP changes

**Monitoring:**

- Track login success rate before/after deployment
- Alert if login failure rate exceeds baseline by 2x
- Dashboard showing OTP validation attempts by code length

### Medium Risk: Rate Limiting Blocks Legitimate Users

**Risk:** Aggressive rate limits may block legitimate users in edge cases
(shared IPs, corporate NAT)

**Mitigation:**

1. Start with generous limits (100 req/min per IP, 50 req/min per user)
2. Monitor rate limit hits in first week
3. Implement allowlist for known good IPs (support team, monitoring)
4. Add clear error messages with contact support link
5. Provide rate limit status in response headers (`X-RateLimit-Remaining`)

**Tuning Strategy:**

- Week 1: Collect baseline metrics, identify false positives
- Week 2: Adjust limits based on p99 usage patterns
- Week 3: Tighten limits if no legitimate user impact
- Ongoing: Review rate limit logs weekly for patterns

### Medium Risk: CSRF Tokens Break Existing Integrations

**Risk:** Undocumented API consumers may break if not updated to include CSRF
tokens

**Mitigation:**

1. Audit codebase for all API routes, identify which need exemptions (cron,
   webhooks)
2. Add exemptions for authenticated machine-to-machine endpoints
3. Update API documentation with CSRF token requirements
4. Provide clear error messages with links to documentation
5. Monitor 403 CSRF errors, reach out to affected users

**Exemption Strategy:**

- Exempt cron endpoints (authenticated with `CRON_SECRET`)
- Exempt webhook endpoints (authenticated with provider signatures)
- Require CSRF for all user-facing API routes
- Consider API key authentication for future programmatic access

### Low Risk: Sentry Cost Overruns

**Risk:** High error volume could exceed Sentry free tier limits

**Mitigation:**

1. Set up error rate limiting in Sentry (max 100 events/min)
2. Configure alert for approaching quota (80% of monthly limit)
3. Have credit card on file for seamless tier upgrade if needed
4. Implement client-side error deduplication
5. Set aggressive sampling for non-critical errors

**Budget Planning:**

- Free tier: 5,000 events/month
- Paid tier: $26/month for 50,000 events
- Expected: ~1,000 events/month at current traffic
- Alert threshold: 4,000 events/month

## Migration Plan

### Phase 1: Foundation (Week 1 - Non-Breaking)

1. Deploy startup validation script to staging
2. Test with missing env vars to verify failure
3. Add structured logging library
4. Audit and replace console.log calls
5. Test log sanitization with sample data
6. Deploy to production (non-breaking, additive)
7. Monitor logs for 48 hours to verify no sensitive data

**Rollback:** Revert to previous version, no data migration needed

### Phase 2: Authentication Hardening (Week 1-2 - BREAKING)

1. Deploy OTP changes with grace period (accept 6 or 8 digits)
2. Send email notification to all users about 8-digit OTP
3. Monitor login success rate for anomalies
4. After 24 hours, switch to 8-digit only
5. Deploy email verification enforcement
6. Deploy session timeout changes
7. Deploy admin authentication hardening

**Pre-deployment:**

- Email all users 7 days in advance
- Brief support team on OTP changes
- Prepare rollback script

**Rollback:**

- Revert to 6-digit OTP generation
- Remove email verification enforcement
- Extend session timeout to 30 days
- Restore admin token fallback (temporary)

### Phase 3: API Security (Week 2 - BREAKING)

1. Deploy rate limiting with generous limits
2. Monitor rate limit hits for 24 hours
3. Deploy CSRF protection with exemptions
4. Monitor 403 errors for false positives
5. Deploy webhook replay protection
6. Deploy cron job authentication hardening

**Pre-deployment:**

- Update API documentation
- Test all cron jobs with new authentication
- Verify webhook signature validation working

**Rollback:**

- Disable rate limiting (allow all)
- Disable CSRF validation
- Revert webhook deduplication (process all)
- Remove cron authentication requirements

### Phase 4: Monitoring & Compliance (Week 2-3 - Non-Breaking)

1. Deploy Sentry integration
2. Configure error alerts and thresholds
3. Deploy request ID middleware
4. Deploy privacy policy acceptance tracking
5. Deploy GDPR data export/deletion endpoints
6. Test end-to-end with sample user

**Rollback:** Disable Sentry, revert privacy policy enforcement

### Phase 5: Validation & Launch (Week 3)

1. Run full integration test suite
2. Run security scan (OWASP ZAP)
3. Perform load testing (10k users)
4. Independent security audit
5. Final go/no-go decision
6. Production deployment during maintenance window
7. Monitor for 24 hours post-launch

**Go/No-Go Criteria:**

- ✅ All 8 critical blockers resolved
- ✅ Zero sensitive data in logs (24-hour observation)
- ✅ Integration test suite passing (>80% coverage)
- ✅ Security audit passed with no critical/high findings
- ✅ Load testing successful (<500ms p95, no errors)
- ✅ Monitoring alerts functional (<5 minute latency)

## Open Questions

1. **Q:** Should we implement geographic IP blocking for high-risk countries?
   **A:** Deferred to post-launch. Too broad, could block legitimate users.
   Better to focus on behavior-based detection.

2. **Q:** Should webhook events be stored indefinitely or cleaned up? **A:**
   Clean up after 30 days. Long enough for debugging, short enough to prevent
   unbounded growth.

3. **Q:** Should we add honeypot fields to forms for bot detection? **A:**
   Deferred to post-launch. Current rate limiting should be sufficient. Can add
   if bot traffic becomes issue.

4. **Q:** Should we implement IP-based geolocation for GDPR determination?
   **A:** Not needed initially. Privacy policy applies globally. Can add
   regional differences later if needed.

5. **Q:** Should we add security headers (CSP, HSTS, X-Frame-Options)? **A:**
   Yes, but as separate follow-up change. Not blocking for launch. Next.js
   provides some defaults.

6. **Q:** Should we implement account lockout after failed login attempts?
   **A:** Yes, included in OTP strengthening (task 2.1.5). Lock after 10
   failures in 1 hour, require support contact to unlock.

7. **Q:** What's the process for rotating ENCRYPTION_KEY if compromised? **A:**
   Out of scope for this change. Requires re-encrypting all server shares.
   Should be separate emergency procedure doc.

8. **Q:** Should we add audit logging for all secret access/modifications?
   **A:** Already implemented for Pro users. Free users get no audit logs per
   business model.
