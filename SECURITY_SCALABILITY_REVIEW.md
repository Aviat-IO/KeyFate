# Security & Scalability Review: Dead Man's Switch Application

**Review Date:** November 24, 2025\
**Reviewer:** Security & Scalability Analysis\
**Scope:** Full codebase including authentication, payment integration, cron
jobs, database, and infrastructure

---

## Executive Summary

This Dead Man's Switch application demonstrates **strong security fundamentals**
with proper encryption, authentication, and privacy-first design. However,
several **critical and high-priority issues** were identified that could impact
security, reliability, and scalability in production environments.

**Key Strengths:**

- ✅ Proper encryption with AES-256-GCM and key versioning
- ✅ Timing-safe authentication comparisons
- ✅ CSRF protection on sensitive endpoints
- ✅ Re-authentication requirements for sensitive operations
- ✅ Comprehensive audit logging
- ✅ GDPR compliance implementation
- ✅ Database connection pooling with circuit breaker pattern

**Critical Concerns:**

- 🚨 In-memory rate limiting won't scale across multiple instances
- 🚨 Race conditions in cron job secret processing
- 🚨 Missing database indexes for critical queries
- 🚨 Webhook replay attack vulnerability
- 🚨 Sensitive data exposure in error logs

---

## Critical Findings (Fix Immediately)

### 1. 🚨 In-Memory Rate Limiting - Scalability Failure

**Location:** `frontend/src/lib/rate-limit.ts` (lines 13-24)

**Issue:** Rate limiting uses in-memory `Map` storage, which will fail in
multi-instance deployments (Cloud Run with multiple replicas).

```typescript
const tokenCache = new Map<string, { timestamps: number[]; expiry: number }>();
```

**Impact:**

- Each Cloud Run instance maintains separate rate limit counters
- Attackers can bypass rate limits by distributing requests across instances
- OTP brute-force attacks become feasible
- Secret creation limits can be circumvented

**Severity:** CRITICAL

**Recommendation:**

```typescript
// Use Redis for distributed rate limiting
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

export async function checkRateLimit(
  type: string,
  identifier: string,
  limit: number,
): Promise<RateLimitResult> {
  const key = `ratelimit:${type}:${identifier}`;
  const now = Date.now();
  const window = 60 * 1000; // 1 minute

  // Use Redis sorted sets for sliding window
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, now - window);
  pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  pipeline.zcard(key);
  pipeline.expire(key, 60);

  const results = await pipeline.exec();
  const count = results[2] as number;

  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: Math.ceil((now + window) / 1000),
  };
}
```

**Alternative:** Use Google Cloud Memorystore (Redis) or implement
database-backed rate limiting with proper indexes.

---

### 2. 🚨 Race Condition in Secret Processing

**Location:** `frontend/src/app/api/cron/process-reminders/route.ts` (lines
76-89)

**Issue:** Secret status update uses optimistic locking but doesn't handle
concurrent processing properly.

```typescript
const updated = await db
  .update(secrets)
  .set({
    status: "triggered",
    processingStartedAt: new Date(),
  })
  .where(and(eq(secrets.id, secret.id), eq(secrets.status, "active")))
  .returning({ id: secrets.id });

if (updated.length === 0) {
  return { success: false, sent: 0, failed: 0, alreadyProcessing: true };
}
```

**Problem:** If two cron instances run simultaneously (Cloud Scheduler can
trigger overlapping executions), both might:

1. Fetch the same overdue secret
2. Both attempt to process it
3. One succeeds, one fails silently
4. Recipients might receive duplicate emails

**Impact:**

- Duplicate secret disclosures to recipients
- Inconsistent secret state
- Wasted processing resources
- User confusion from duplicate emails

**Severity:** CRITICAL

**Recommendation:**

```typescript
// Add distributed lock using database advisory locks
async function acquireSecretLock(db: any, secretId: string): Promise<boolean> {
  try {
    // PostgreSQL advisory lock with timeout
    const result = await db.execute(sql`
      SELECT pg_try_advisory_lock(hashtext(${secretId}))
    `);
    return result[0]?.pg_try_advisory_lock === true;
  } catch {
    return false;
  }
}

async function releaseSecretLock(db: any, secretId: string): Promise<void> {
  await db.execute(sql`
    SELECT pg_advisory_unlock(hashtext(${secretId}))
  `);
}

// In processOverdueSecret:
const lockAcquired = await acquireSecretLock(db, secret.id);
if (!lockAcquired) {
  return { success: false, sent: 0, failed: 0, alreadyProcessing: true };
}

try {
  // Process secret...
} finally {
  await releaseSecretLock(db, secret.id);
}
```

---

### 3. 🚨 Missing Database Indexes - Performance Degradation

**Location:** `frontend/src/lib/db/schema.ts`

**Issue:** Several critical queries lack proper indexes, causing full table
scans.

**Missing Indexes:**

1. **Overdue Secrets Query** (lines 360-381 in `process-reminders/route.ts`):

```sql
-- Current query does full table scan
SELECT * FROM secrets
WHERE status = 'active'
  AND next_check_in < NOW()
  AND (last_retry_at IS NULL OR ...)
```

**Missing index:**

```typescript
// Add to schema.ts secrets table:
statusNextCheckinRetryIdx: index("idx_secrets_overdue_lookup").on(
  table.status,
  table.nextCheckIn,
  table.lastRetryAt,
  table.retryCount,
);
```

2. **Webhook Deduplication** (not indexed):

```typescript
// In webhookEvents table, add:
providerEventIdIdx: index("idx_webhook_events_provider_event").on(
  table.provider,
  table.eventId,
);
```

3. **OTP Rate Limit Cleanup** (missing composite index):

```typescript
// In otpRateLimits table, add:
cleanupIdx: index("idx_otp_rate_limits_cleanup").on(table.windowEnd);
```

**Impact:**

- Slow cron job execution (9-minute timeout risk)
- Database CPU spikes during peak hours
- Increased Cloud SQL costs
- Potential timeout failures

**Severity:** CRITICAL

**Recommendation:** Add all missing indexes via migration:

```bash
cd frontend
npx drizzle-kit generate --name="add_performance_indexes"
```

---

### 4. 🚨 Webhook Replay Attack Vulnerability

**Location:** `frontend/src/app/api/webhooks/btcpay/route.ts` (lines 70-77)

**Issue:** Webhook deduplication uses event ID only, without timestamp
validation.

```typescript
const alreadyProcessed = await isWebhookProcessed(
  "btcpay",
  event.id || `btcpay-${Date.now()}`,
);
```

**Problem:**

- Attacker can replay old webhook signatures
- No timestamp validation in signature verification
- Event IDs might be reused across different time periods

**Impact:**

- Duplicate subscription activations
- Financial discrepancies
- Audit log pollution

**Severity:** CRITICAL

**Recommendation:**

```typescript
// In cron/utils.ts verifyHMACSignature (lines 67-120):
const age = now - timestampMs;

// CURRENT: 5 minutes
if (age < 0 || age > 5 * 60 * 1000) {
  return false;
}

// RECOMMENDED: 2 minutes for webhooks
if (age < 0 || age > 2 * 60 * 1000) {
  logger.warn("Webhook timestamp outside acceptable window", {
    age,
    timestamp: timestampMs,
  });
  return false;
}

// Add webhook-specific deduplication with TTL
async function isWebhookProcessed(
  provider: string,
  eventId: string,
  timestamp: number,
): Promise<boolean> {
  const db = await getDatabase();

  // Check if processed within last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const existing = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, provider),
        eq(webhookEvents.eventId, eventId),
        gt(webhookEvents.createdAt, oneDayAgo),
      ),
    )
    .limit(1);

  return existing.length > 0;
}
```

---

### 5. 🚨 Sensitive Data in Error Logs

**Location:** Multiple files, particularly `frontend/src/lib/cron/utils.ts`
(lines 4-30)

**Issue:** While `sanitizeError()` attempts to redact sensitive data, it's
incomplete and error-prone.

**Problems:**

1. Regex-based sanitization can be bypassed
2. New fields aren't automatically redacted
3. Stack traces may contain sensitive data
4. Database errors expose schema details

**Example vulnerability:**

```typescript
// This would NOT be caught:
const error = new Error(`Failed to decrypt: ${serverShare}`);
// serverShare is in the message, not a JSON field
```

**Impact:**

- Encryption keys leaked in logs
- Server shares exposed in error messages
- PII in stack traces
- Compliance violations (GDPR)

**Severity:** CRITICAL

**Recommendation:**

```typescript
// Create structured error types that never include sensitive data
class SecretProcessingError extends Error {
  constructor(
    public readonly secretId: string,
    public readonly errorCode: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(`Secret processing failed: ${errorCode}`);
    this.name = "SecretProcessingError";
  }

  toJSON() {
    return {
      secretId: this.secretId,
      errorCode: this.errorCode,
      // Never include context in JSON serialization
    };
  }
}

// Use error codes instead of messages
throw new SecretProcessingError(
  secret.id,
  "DECRYPTION_FAILED",
  { keyVersion: secret.keyVersion }, // Safe metadata only
);

// In logging:
console.error("Secret processing error:", {
  secretId: error.secretId,
  errorCode: error.errorCode,
  // Never log error.context
});
```

---

## High Priority Findings

### 6. ⚠️ Database Connection Pool Exhaustion Risk

**Location:** `frontend/src/lib/db/connection-manager.ts` (lines 163-179)

**Issue:** Connection pool size is hardcoded and doesn't scale with load.

```typescript
const enhancedOptions: ConnectionOptions = {
  max: process.env.NODE_ENV === "production" ? 20 : 10,
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
};
```

**Problem:**

- Cloud Run can scale to 100+ instances
- Each instance creates 20 connections = 2000+ connections
- Cloud SQL default max_connections = 100
- Connection exhaustion causes cascading failures

**Impact:**

- Service outages during traffic spikes
- "Too many connections" errors
- Slow query performance
- Increased Cloud SQL costs

**Severity:** HIGH

**Recommendation:**

```typescript
// Calculate pool size based on Cloud Run concurrency
const CLOUD_RUN_CONCURRENCY = parseInt(
  process.env.CLOUD_RUN_CONCURRENCY || "80",
);
const EXPECTED_INSTANCES = parseInt(process.env.EXPECTED_INSTANCES || "10");
const TOTAL_CONNECTIONS = parseInt(
  process.env.CLOUDSQL_MAX_CONNECTIONS || "100",
);

// Reserve 20% for admin/maintenance
const AVAILABLE_CONNECTIONS = Math.floor(TOTAL_CONNECTIONS * 0.8);

// Calculate per-instance pool size
const POOL_SIZE = Math.max(
  2, // Minimum 2 connections
  Math.floor(AVAILABLE_CONNECTIONS / EXPECTED_INSTANCES),
);

const enhancedOptions: ConnectionOptions = {
  max: POOL_SIZE,
  idle_timeout: 20, // Shorter timeout to release connections faster
  connect_timeout: 5,
  max_lifetime: 60 * 10, // Shorter lifetime for better distribution
  // Use PgBouncer in transaction mode for better pooling
  prepare: false, // Disable prepared statements for PgBouncer compatibility
};
```

**Also implement:**

- PgBouncer in transaction mode (already configured in `pgbouncer.ini`)
- Connection monitoring and alerting
- Graceful degradation when pool is exhausted

---

### 7. ⚠️ OTP Brute Force Vulnerability

**Location:** `frontend/src/lib/auth/otp.ts` (lines 125-262)

**Issue:** OTP validation allows 5 attempts per 15-minute window, but lacks
IP-based rate limiting.

```typescript
const OTP_RATE_LIMIT_VALIDATION_ATTEMPTS = 5;
const OTP_RATE_LIMIT_VALIDATION_WINDOW_MINUTES = 15;
```

**Problem:**

- Attacker can try 5 codes per email per 15 minutes
- With 100 million possible 8-digit codes
- Expected attempts to crack: 50 million
- At 5 attempts per 15 minutes = 150 million minutes = 285 years
- BUT: Attacker can parallelize across multiple IPs

**Attack scenario:**

1. Attacker controls 1000 IPs (cheap via cloud providers)
2. Each IP tries 5 codes per 15 minutes
3. 1000 IPs × 5 codes × 4 windows/hour = 20,000 attempts/hour
4. Expected time to crack: 2,500 hours = 104 days

**Impact:**

- Account takeover via OTP brute force
- Unauthorized access to secrets
- Data breach

**Severity:** HIGH

**Recommendation:**

```typescript
// Add IP-based rate limiting in createOTPToken (line 36)
export async function createOTPToken(
  email: string,
  purpose: "authentication" | "email_verification",
  ipAddress?: string,
): Promise<CreateOTPTokenResult> {
  // EXISTING: Check IP-based rate limit (5 requests per minute per IP)
  if (ipAddress) {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const ipRateLimit = await checkRateLimit("ip", ipAddress, 5);
    // ... existing code
  }

  // ADD: Global rate limit per email across all IPs
  const globalRateLimit = await checkGlobalOTPRateLimit(email);
  if (!globalRateLimit.allowed) {
    // Exponential backoff after repeated failures
    return {
      success: false,
      error:
        `Too many OTP requests from multiple sources. Account temporarily locked.`,
    };
  }

  // ADD: Increase OTP length to 10 digits for better security
  const code = crypto.randomInt(0, 10000000000).toString().padStart(10, "0");

  // ... rest of existing code
}

// Add validation attempt tracking across IPs
async function checkGlobalOTPRateLimit(email: string): Promise<{
  allowed: boolean;
  resetAt?: Date;
}> {
  const db = await getDatabase();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour

  // Count total validation attempts across all IPs
  const attempts = await db
    .select({ count: sql<number>`count(*)` })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        gt(verificationTokens.attemptCount, 0),
        gt(verificationTokens.expires, windowStart),
      ),
    );

  const totalAttempts = attempts[0]?.count || 0;

  // Allow max 20 attempts per hour across all IPs
  if (totalAttempts >= 20) {
    return {
      allowed: false,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }

  return { allowed: true };
}
```

---

### 8. ⚠️ Cron Job Timeout Risk

**Location:** `frontend/src/app/api/cron/process-reminders/route.ts` (lines
406-458)

**Issue:** Cron job processes secrets sequentially with concurrency limit of 20,
risking timeout.

```typescript
const CRON_CONFIG = {
  TIMEOUT_MS: 9 * 60 * 1000, // 9 minutes
  MAX_CONCURRENT_SECRETS: 20,
};
```

**Problem:**

- Cloud Scheduler timeout: 10 minutes (hard limit)
- Current timeout check: 9 minutes
- If 1000 secrets are overdue, processing takes: 1000 / 20 = 50 batches
- If each batch takes 15 seconds = 750 seconds = 12.5 minutes
- Job will timeout, leaving secrets unprocessed

**Impact:**

- Missed secret disclosures
- Angry users who didn't receive their dead man's switch
- Reputation damage
- Potential legal liability

**Severity:** HIGH

**Recommendation:**

```typescript
// 1. Implement cursor-based pagination with state persistence
interface CronJobState {
  jobId: string;
  lastProcessedSecretId: string;
  processedCount: number;
  startedAt: Date;
}

// 2. Store state in database
const cronJobState = pgTable("cron_job_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name").notNull(),
  lastProcessedId: text("last_processed_id"),
  processedCount: integer("processed_count").default(0),
  startedAt: timestamp("started_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// 3. Resume from last position
export async function POST(req: NextRequest) {
  const db = await getDatabase();

  // Get or create job state
  let state = await db
    .select()
    .from(cronJobState)
    .where(eq(cronJobState.jobName, "process-reminders"))
    .orderBy(desc(cronJobState.startedAt))
    .limit(1);

  const lastProcessedId = state[0]?.lastProcessedId;

  // Fetch secrets AFTER last processed ID
  const overdueSecrets = await db
    .select()
    .from(secrets)
    .where(
      and(
        eq(secrets.status, "active"),
        lt(secrets.nextCheckIn, now),
        lastProcessedId ? gt(secrets.id, lastProcessedId) : undefined,
      ),
    )
    .orderBy(secrets.id) // Consistent ordering
    .limit(100);

  // Process with timeout check
  for (const secret of overdueSecrets) {
    if (isApproachingTimeout(startTime)) {
      // Save state and exit gracefully
      await db.update(cronJobState).set({
        lastProcessedId: secret.id,
        processedCount: state[0].processedCount + processed,
        updatedAt: new Date(),
      });

      return NextResponse.json({
        status: "partial",
        processed,
        remaining: overdueSecrets.length - processed,
        message: "Job will resume on next run",
      });
    }

    await processOverdueSecret(secret, user, startTime);
    processed++;
  }

  // Clear state when complete
  await db
    .delete(cronJobState)
    .where(eq(cronJobState.jobName, "process-reminders"));

  return NextResponse.json({ status: "complete", processed });
}
```

---

### 9. ⚠️ CSRF Token Reuse Vulnerability

**Location:** `frontend/src/lib/csrf.ts` (not shown but referenced in routes)

**Issue:** CSRF tokens might be reused across multiple requests if not properly
invalidated.

**Problem:**

- If CSRF token is long-lived, attacker can steal and reuse it
- No evidence of token rotation after use
- Session-based CSRF tokens can be leaked via XSS

**Impact:**

- CSRF attacks despite protection
- Unauthorized secret creation/deletion
- Account takeover

**Severity:** HIGH

**Recommendation:**

```typescript
// Implement one-time CSRF tokens
export async function requireCSRFProtection(
  request: NextRequest,
): Promise<{ valid: boolean; token?: string }> {
  const token = request.headers.get("x-csrf-token");

  if (!token) {
    return { valid: false };
  }

  const db = await getDatabase();

  // Verify and DELETE token in single transaction
  const result = await db.transaction(async (tx) => {
    const tokens = await tx
      .select()
      .from(csrfTokens)
      .where(
        and(eq(csrfTokens.token, token), gt(csrfTokens.expiresAt, new Date())),
      )
      .limit(1)
      .for("update"); // Lock row

    if (tokens.length === 0) {
      return { valid: false };
    }

    // Delete token immediately (one-time use)
    await tx.delete(csrfTokens).where(eq(csrfTokens.token, token));

    return { valid: true };
  });

  return result;
}

// Generate new token for response
export async function generateCSRFToken(sessionId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const db = await getDatabase();
  await db.insert(csrfTokens).values({
    sessionId,
    token,
    expiresAt,
  });

  return token;
}
```

---

### 10. ⚠️ Encryption Key Rotation Not Implemented

**Location:** `frontend/src/lib/encryption.ts` (lines 6-81)

**Issue:** Key versioning exists but no rotation mechanism.

```typescript
const ENCRYPTION_KEYS: Map<number, EncryptionKeyConfig> = new Map();
let CURRENT_KEY_VERSION = 1;
```

**Problem:**

- If key is compromised, all historical data is at risk
- No way to rotate keys without manual intervention
- Secrets encrypted with old keys remain vulnerable

**Impact:**

- Long-term key compromise affects all secrets
- Difficult incident response
- Compliance issues (PCI-DSS requires key rotation)

**Severity:** HIGH

**Recommendation:**

```typescript
// Implement automatic key rotation
export async function rotateEncryptionKey(): Promise<number> {
  const newVersion = CURRENT_KEY_VERSION + 1;

  // Generate new key
  const newKey = crypto.randomBytes(32);

  // Store in Secret Manager (not env vars)
  await storeKeyInSecretManager(newVersion, newKey);

  // Update current version
  CURRENT_KEY_VERSION = newVersion;

  // Schedule background re-encryption job
  await scheduleReEncryptionJob(newVersion);

  return newVersion;
}

// Background job to re-encrypt secrets
async function reEncryptSecrets(newKeyVersion: number) {
  const db = await getDatabase();

  // Process in batches
  const batchSize = 100;
  let offset = 0;

  while (true) {
    const secrets = await db
      .select()
      .from(secretsTable)
      .where(lt(secretsTable.keyVersion, newKeyVersion))
      .limit(batchSize)
      .offset(offset);

    if (secrets.length === 0) break;

    for (const secret of secrets) {
      // Decrypt with old key
      const decrypted = await decryptMessage(
        secret.serverShare,
        Buffer.from(secret.iv, "base64"),
        Buffer.from(secret.authTag, "base64"),
        secret.keyVersion,
      );

      // Re-encrypt with new key
      const encrypted = await encryptMessage(
        decrypted,
        undefined,
        newKeyVersion,
      );

      // Update secret
      await db
        .update(secretsTable)
        .set({
          serverShare: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: newKeyVersion,
        })
        .where(eq(secretsTable.id, secret.id));
    }

    offset += batchSize;
  }
}
```

---

## Medium Priority Findings

### 11. ⚠️ No Request ID Propagation in Async Operations

**Location:** `frontend/src/middleware.ts` (lines 23-26)

**Issue:** Request ID is generated but not propagated to async operations.

```typescript
const requestId = crypto.randomUUID();
const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-request-id", requestId);
```

**Problem:**

- Cron jobs don't have request IDs
- Database operations lose tracing context
- Difficult to debug distributed operations

**Recommendation:** Use AsyncLocalStorage for request context propagation:

```typescript
// lib/request-context.ts
import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return requestContext.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

// In middleware:
return withRequestContext(
  { requestId, userId: token?.sub, startTime: Date.now() },
  async () => {
    return NextResponse.next();
  },
);

// In database queries:
const context = getRequestContext();
console.log(`[${context?.requestId}] Executing query...`);
```

---

### 12. ⚠️ Email Delivery Failures Not Monitored

**Location:** `frontend/src/lib/email/email-failure-logger.ts` (referenced but
not shown)

**Issue:** Email failures are logged but no alerting mechanism.

**Problem:**

- Critical reminder emails might fail silently
- No notification when disclosure emails fail
- Users don't know their dead man's switch is broken

**Recommendation:**

```typescript
// Implement email failure alerting
export async function logEmailFailure(failure: EmailFailureInsert) {
  const db = await getDatabase();

  // Log failure
  await db.insert(emailFailures).values(failure);

  // Check failure rate
  const recentFailures = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailFailures)
    .where(
      and(
        eq(emailFailures.emailType, failure.emailType),
        gt(emailFailures.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );

  const failureCount = recentFailures[0]?.count || 0;

  // Alert if failure rate exceeds threshold
  if (failureCount > 10) {
    await sendAdminAlert({
      type: "email_delivery_failure",
      severity: "high",
      message: `High email failure rate: ${failureCount} failures in last hour`,
      details: {
        emailType: failure.emailType,
        provider: failure.provider,
        failureCount,
      },
    });
  }

  // Alert user if their critical emails are failing
  if (failure.emailType === "reminder" || failure.emailType === "disclosure") {
    await notifyUserOfEmailFailure(failure.recipient, failure.emailType);
  }
}
```

---

### 13. ⚠️ Database Transaction Boundaries Too Large

**Location:** `frontend/src/app/api/secrets/route.ts` (lines 209-226)

**Issue:** Secret creation transaction includes reminder scheduling.

```typescript
const data = await db.transaction(async (tx) => {
  const [newSecret] = await tx.insert(secretsTable).values(insertData).returning()
  await tx.insert(secretRecipients).values(...)
  return newSecret
})

await scheduleRemindersForSecret(data.id, data.nextCheckIn!, validatedData.check_in_days)
```

**Problem:**

- If reminder scheduling fails, secret is still created
- Inconsistent state: secret exists but no reminders
- User thinks they're protected but they're not

**Recommendation:**

```typescript
// Include reminder scheduling in transaction
const data = await db.transaction(async (tx) => {
  // 1. Create secret
  const [newSecret] = await tx
    .insert(secretsTable)
    .values(insertData)
    .returning();

  // 2. Create recipients
  await tx.insert(secretRecipients).values(
    validatedData.recipients.map((recipient) => ({
      secretId: newSecret.id,
      name: recipient.name,
      email: recipient.email,
    })),
  );

  // 3. Schedule reminders (in same transaction)
  const reminders = calculateReminderSchedule(
    newSecret.nextCheckIn!,
    validatedData.check_in_days,
  );

  await tx.insert(reminderJobs).values(
    reminders.map((reminder) => ({
      secretId: newSecret.id,
      reminderType: reminder.type,
      scheduledFor: reminder.scheduledFor,
      status: "pending" as const,
    })),
  );

  return newSecret;
});
```

---

### 14. ⚠️ No Circuit Breaker for External Services

**Location:** `frontend/src/lib/email/email-service.ts` (not shown but
referenced)

**Issue:** Email service failures can cascade.

**Problem:**

- If Resend/SendGrid is down, all email operations fail
- No fallback mechanism
- Cron jobs timeout waiting for email responses

**Recommendation:**

```typescript
// Implement circuit breaker for email service
import { CircuitBreaker } from "opossum";

const emailCircuitBreaker = new CircuitBreaker(sendEmailInternal, {
  timeout: 5000, // 5 second timeout
  errorThresholdPercentage: 50, // Open after 50% failures
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 60000, // 1 minute window
  rollingCountBuckets: 10,
});

emailCircuitBreaker.on("open", () => {
  console.error("Email circuit breaker OPEN - email service degraded");
  sendAdminAlert({
    type: "circuit_breaker_open",
    severity: "high",
    message: "Email service circuit breaker opened",
  });
});

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  try {
    return await emailCircuitBreaker.fire(params);
  } catch (error) {
    // Circuit breaker open - queue for retry
    await queueEmailForRetry(params);

    return {
      success: false,
      error: "Email service temporarily unavailable",
      provider: "circuit-breaker",
    };
  }
}
```

---

### 15. ⚠️ Webhook Signature Verification Timing Attack

**Location:** `frontend/src/lib/cron/utils.ts` (lines 107-116)

**Issue:** While using `timingSafeEqual`, the signature is validated as hex
string first.

```typescript
// Validate signature is valid hex (SHA256 = 64 hex chars)
if (!/^[a-f0-9]{64}$/i.test(signature)) {
  return false;
}
```

**Problem:**

- Regex validation leaks timing information
- Attacker can determine valid signature format
- Reduces brute-force search space

**Recommendation:**

```typescript
// Constant-time hex validation
function isValidHexSignature(signature: string): boolean {
  if (signature.length !== 64) {
    // Still need to do constant-time comparison
    // to avoid leaking length information
    const dummy = "0".repeat(64);
    try {
      timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(dummy, "hex"));
    } catch {
      // Intentionally fail
    }
    return false;
  }

  // Validate hex without regex (constant time)
  try {
    const buffer = Buffer.from(signature, "hex");
    return buffer.length === 32; // SHA256 = 32 bytes
  } catch {
    return false;
  }
}
```

---

## Low Priority / Future Considerations

### 16. 📝 No Database Query Timeout

**Location:** `frontend/src/lib/db/connection-manager.ts` (line 169)

**Issue:** Statement timeout is 30 seconds, which is too long for API requests.

```typescript
statement_timeout: 30000, // 30 second statement timeout
```

**Recommendation:**

- API requests: 5 second timeout
- Cron jobs: 30 second timeout
- Background jobs: 60 second timeout

---

### 17. 📝 Missing Observability

**Issue:** No structured logging, metrics, or tracing.

**Recommendation:**

- Implement OpenTelemetry for distributed tracing
- Add Prometheus metrics for key operations
- Use structured logging (JSON format)
- Integrate with Google Cloud Monitoring

---

### 18. 📝 No Database Backup Verification

**Issue:** Backups exist but no verification they can be restored.

**Recommendation:**

- Automated backup restoration tests
- Point-in-time recovery testing
- Backup encryption verification

---

### 19. 📝 Environment Variable Validation at Runtime

**Location:** `frontend/src/lib/server-env.ts` (lines 11-148)

**Issue:** Environment variables validated lazily on first access.

**Recommendation:**

```typescript
// Validate all required env vars at startup
export function validateEnvironment() {
  const required = [
    "DATABASE_URL",
    "ENCRYPTION_KEY",
    "NEXTAUTH_SECRET",
    "CRON_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  // Validate encryption key format
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, "base64");
    if (key.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be 32 bytes (base64 encoded)");
    }
  } catch (error) {
    throw new Error("Invalid ENCRYPTION_KEY format");
  }
}

// Call at app startup
validateEnvironment();
```

---

### 20. 📝 No Rate Limiting on Check-In Endpoint

**Location:** `frontend/src/app/api/check-in/route.ts` (not shown)

**Issue:** Check-in endpoint might not have rate limiting.

**Recommendation:**

```typescript
// Add rate limiting to check-in endpoint
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Rate limit by token (prevent abuse)
  const rateLimitResult = await checkRateLimit("checkIn", token, 5);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  // ... rest of check-in logic
}
```

---

## Positive Security Practices Found ✅

The codebase demonstrates several excellent security practices:

1. **Encryption:**
   - AES-256-GCM with proper IV and auth tag handling
   - Key versioning for rotation support
   - Entropy validation for encryption keys

2. **Authentication:**
   - Timing-safe comparisons for secrets
   - HMAC signature verification for webhooks
   - Re-authentication for sensitive operations
   - Account lockout after failed attempts

3. **Authorization:**
   - Proper user ownership checks
   - Tier-based access control
   - CSRF protection on state-changing operations

4. **Data Protection:**
   - Secrets encrypted at rest
   - Sensitive data sanitization in logs (partial)
   - GDPR compliance with data export and deletion

5. **Database Security:**
   - Parameterized queries (Drizzle ORM)
   - No SQL injection vulnerabilities found
   - Foreign key constraints properly defined
   - Cascade deletes configured correctly

6. **Infrastructure:**
   - Connection pooling with circuit breaker
   - Graceful shutdown handling
   - Retry logic with exponential backoff
   - Health check endpoints

7. **Audit Logging:**
   - Comprehensive audit trail
   - User actions tracked
   - IP address logging

---

## Scalability Assessment

### Current Capacity Estimates

**Database:**

- Cloud SQL instance: Likely db-f1-micro or db-g1-small
- Max connections: 100 (default)
- Current pool size: 20 per instance
- Max instances before exhaustion: 5

**Cloud Run:**

- Default concurrency: 80 requests per instance
- With 5 instances: 400 concurrent requests
- Estimated throughput: ~1000 req/min (assuming 200ms avg response time)

**Bottlenecks:**

1. **Database connections** (most critical)
2. In-memory rate limiting (fails at 2+ instances)
3. Cron job timeout (fails at ~1000 overdue secrets)
4. Email service (no circuit breaker)

### Scaling Recommendations

**Immediate (0-100 users):**

- ✅ Current setup adequate
- Add Redis for rate limiting
- Implement database connection pooling with PgBouncer

**Short-term (100-1,000 users):**

- Upgrade Cloud SQL to db-custom-2-4096 (2 vCPU, 4GB RAM)
- Increase max_connections to 500
- Implement distributed locking for cron jobs
- Add missing database indexes

**Medium-term (1,000-10,000 users):**

- Implement read replicas for reporting queries
- Add caching layer (Redis/Memorystore)
- Separate cron job processing to dedicated Cloud Run service
- Implement job queue (Cloud Tasks) for async operations

**Long-term (10,000+ users):**

- Shard database by user ID
- Implement event-driven architecture (Pub/Sub)
- Add CDN for static assets
- Consider multi-region deployment

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Week 1)

1. **Implement Redis-based rate limiting** (Issue #1)
   - Deploy Google Cloud Memorystore
   - Update rate limiting code
   - Test with multiple Cloud Run instances

2. **Add distributed locking for cron jobs** (Issue #2)
   - Implement PostgreSQL advisory locks
   - Test concurrent cron execution
   - Add monitoring for lock contention

3. **Add missing database indexes** (Issue #3)
   - Generate migration with new indexes
   - Test query performance
   - Deploy to staging, then production

4. **Fix webhook replay vulnerability** (Issue #4)
   - Tighten timestamp validation
   - Add TTL-based deduplication
   - Test with old webhook payloads

5. **Implement structured error handling** (Issue #5)
   - Create error type hierarchy
   - Remove sensitive data from error messages
   - Audit all error logging

### Phase 2: High Priority (Week 2-3)

6. **Optimize database connection pooling** (Issue #6)
7. **Strengthen OTP security** (Issue #7)
8. **Implement cron job state persistence** (Issue #8)
9. **Fix CSRF token reuse** (Issue #9)
10. **Implement key rotation** (Issue #10)

### Phase 3: Medium Priority (Week 4-6)

11-15. Address medium priority issues 16-20. Implement low priority improvements

### Phase 4: Monitoring & Observability (Ongoing)

- Set up Cloud Monitoring dashboards
- Configure alerting for critical metrics
- Implement distributed tracing
- Add performance monitoring

---

## Testing Recommendations

### Security Testing

1. **Penetration Testing:**
   - OTP brute force attempts
   - Webhook replay attacks
   - CSRF bypass attempts
   - SQL injection attempts (should all fail)

2. **Load Testing:**
   - 1000 concurrent users
   - 10,000 secrets processing
   - Database connection exhaustion
   - Rate limit effectiveness

3. **Chaos Engineering:**
   - Database failover
   - Email service outage
   - Cron job timeout scenarios
   - Network partition testing

### Automated Testing

```bash
# Add to CI/CD pipeline
npm run test:security  # Security-focused tests
npm run test:load      # Load testing
npm run test:e2e       # End-to-end tests
npm run test:chaos     # Chaos engineering tests
```

---

## Compliance Considerations

### GDPR Compliance ✅

- Data export: Implemented
- Data deletion: Implemented
- Audit logging: Implemented
- Privacy policy acceptance: Implemented

**Gaps:**

- No data breach notification system
- No data processing agreement templates
- No cookie consent management

### PCI-DSS (for payment data)

**Current Status:**

- ✅ No card data stored (using Stripe/BTCPay)
- ✅ Encrypted transmission
- ⚠️ No key rotation policy
- ⚠️ No quarterly security scans

---

## Conclusion

This Dead Man's Switch application has a **solid security foundation** but
requires **immediate attention** to critical scalability and security issues
before production deployment at scale.

**Priority Actions:**

1. Implement distributed rate limiting (Redis)
2. Add database indexes
3. Fix cron job race conditions
4. Strengthen webhook security
5. Improve error handling

**Timeline:**

- Critical fixes: 1 week
- High priority: 2-3 weeks
- Production-ready: 4-6 weeks

**Estimated Effort:**

- Critical fixes: 40 hours
- High priority: 60 hours
- Medium priority: 40 hours
- Total: 140 hours (~3.5 weeks of full-time work)

The application demonstrates strong security awareness and good architectural
decisions. With the recommended fixes, it will be well-positioned for secure,
scalable production deployment.

---

**Review Completed:** November 24, 2025\
**Next Review Recommended:** After Phase 1 completion (1 week)
