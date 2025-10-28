# Security Tools Guide - OWASP ZAP & Sentry APM

## 🔍 OWASP ZAP (Zed Attack Proxy)

### What is OWASP ZAP?

OWASP ZAP is a **free, open-source web application security scanner** maintained
by the Open Web Application Security Project (OWASP). It's one of the most
popular security testing tools used to find vulnerabilities in web applications.

**Key Features:**

- **Automated scanning** for common vulnerabilities
- **Manual testing tools** for security researchers
- **API testing** capabilities
- **CI/CD integration** for continuous security testing
- **100% free and open source**

### What Does ZAP Test For?

OWASP ZAP tests for vulnerabilities in the **OWASP Top 10**:

1. **Injection flaws** (SQL, NoSQL, OS command, LDAP)
2. **Broken authentication** (weak passwords, session management)
3. **Sensitive data exposure** (unencrypted data, weak crypto)
4. **XML External Entities (XXE)**
5. **Broken access control** (unauthorized access)
6. **Security misconfiguration** (default credentials, verbose errors)
7. **Cross-Site Scripting (XSS)**
8. **Insecure deserialization**
9. **Using components with known vulnerabilities**
10. **Insufficient logging & monitoring**

### How to Use ZAP with Your Application

#### Option 1: Docker (Recommended for CI/CD)

```bash
# Pull the latest ZAP Docker image
docker pull zaproxy/zap-stable

# Run baseline scan (quick, passive scan)
docker run -t zaproxy/zap-stable zap-baseline.py \
  -t https://your-staging-url.com \
  -r zap-baseline-report.html

# Run full scan (active, more thorough)
docker run -t zaproxy/zap-stable zap-full-scan.py \
  -t https://your-staging-url.com \
  -r zap-full-report.html
```

#### Option 2: Desktop Application

1. **Download:** https://www.zaproxy.org/download/
2. **Install:** Available for Windows, Mac, Linux
3. **Configure:**
   - Set proxy to localhost:8080
   - Configure browser to use ZAP as proxy
4. **Scan:**
   - Manual Explore: Browse your app while ZAP records
   - Automated Scan: Enter target URL and start scan
5. **Review Results:**
   - High/Medium/Low severity findings
   - False positive marking
   - Export reports (HTML, XML, JSON)

### Recommended Scan Strategy

**Phase 1: Baseline Scan (15 minutes)**

```bash
# Quick passive scan, no attacks
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-baseline.py \
  -t https://staging.yourdomain.com \
  -r baseline-report.html
```

**Phase 2: API Scan (30 minutes)**

```bash
# Test your API endpoints
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-api-scan.py \
  -t https://staging.yourdomain.com/api \
  -f openapi \
  -r api-report.html
```

**Phase 3: Full Scan (2-4 hours)**

```bash
# Comprehensive active scan
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-full-scan.py \
  -t https://staging.yourdomain.com \
  -r full-report.html
```

### Authentication in ZAP

For testing authenticated endpoints:

1. **Script-based authentication:**

```python
# zap-auth-script.py
def authenticate(helper, paramsValues, credentials):
    # Request OTP
    otp_response = helper.sendAndReceive(
        "https://staging.yourdomain.com/api/auth/request-otp",
        "POST",
        '{"email":"test@example.com"}'
    )

    # Get OTP from email (manual step or test endpoint)
    otp_code = "12345678"

    # Authenticate
    auth_response = helper.sendAndReceive(
        "https://staging.yourdomain.com/api/auth/verify-otp",
        "POST",
        f'{{"email":"test@example.com","otpCode":"{otp_code}"}}'
    )

    return auth_response
```

2. **Session-based scanning:**

```bash
# Export authenticated session from browser
# Import into ZAP for authenticated scanning
```

### Expected Findings for Your Application

Based on the security hardening we've done, ZAP should find:

✅ **PASS (No findings expected):**

- CSRF protection in place
- SQL injection protection (parameterized queries)
- XSS protection (React auto-escaping)
- Secure session management
- HTTPS enforced
- Security headers configured

⚠️ **Possible Warnings:**

- Missing Content Security Policy (CSP) headers
- Cookie flags (if not set to Secure, HttpOnly, SameSite)
- CORS configuration (if too permissive)

### Integration with CI/CD

Add to your GitHub Actions workflow:

```yaml
name: Security Scan
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 2 * * 1" # Weekly Monday 2am

jobs:
  zap_scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: "https://staging.yourdomain.com"
          rules_file_name: ".zap/rules.tsv"
          cmd_options: "-a"

      - name: Upload ZAP Report
        uses: actions/upload-artifact@v3
        with:
          name: zap-report
          path: zap-report.html
```

---

## 📊 Sentry APM (Application Performance Monitoring)

### What is Sentry?

**Sentry** is a **real-time error tracking and performance monitoring platform**
that helps developers identify, triage, and resolve issues in production.

**Key Features:**

- **Error tracking** with full stack traces
- **Performance monitoring** (APM)
- **Release tracking** (which version introduced bugs)
- **User context** (who experienced the error)
- **Issue aggregation** (group similar errors)
- **Alerting & notifications** (Slack, email, PagerDuty)

### Why Use Sentry for Your Application?

1. **Catch Errors Before Users Report Them**
   - Real-time alerts when errors occur
   - Full context: user, browser, request data
   - Stack traces with source maps

2. **Performance Monitoring**
   - Track slow API endpoints
   - Database query performance
   - Frontend rendering times
   - Trace transactions across services

3. **Security Monitoring**
   - Failed authentication attempts
   - CSRF validation failures
   - Rate limit violations
   - Unusual access patterns

4. **Production Debugging**
   - See exactly what happened before error
   - Breadcrumbs of user actions
   - Environment & release info

### How to Set Up Sentry

#### Step 1: Create Sentry Account

```bash
# Option 1: Sentry.io (SaaS)
# Visit: https://sentry.io/signup/
# Free tier: 5,000 events/month

# Option 2: Self-hosted Sentry
git clone https://github.com/getsentry/self-hosted.git
cd self-hosted
./install.sh
```

#### Step 2: Install Sentry SDK

```bash
cd frontend
pnpm add @sentry/nextjs
```

#### Step 3: Configure Sentry

```bash
# Run Sentry wizard
npx @sentry/wizard@latest -i nextjs
```

This creates:

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Updates `next.config.ts`

#### Step 4: Update Configuration

**sentry.client.config.ts:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay (see user actions)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // 100% when error occurs

  // Environment
  environment: process.env.NODE_ENV,

  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive data from event
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    if (event.request?.headers) {
      delete event.request.headers["Authorization"];
      delete event.request.headers["Cookie"];
    }
    return event;
  },

  // Ignore known errors
  ignoreErrors: ["Network request failed", "cancelled", /^Non-Error/],
});
```

**sentry.server.config.ts:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: 0.1,

  environment: process.env.NODE_ENV,

  // Server-side filtering
  beforeSend(event) {
    // Don't send PII
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    // Sanitize sensitive data
    if (event.request?.data) {
      const data = JSON.stringify(event.request.data);
      if (data.includes("password") || data.includes("token")) {
        event.request.data = "[REDACTED]";
      }
    }

    return event;
  },
});
```

#### Step 5: Add Environment Variables

```bash
# .env.local
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# For source maps (optional)
SENTRY_AUTH_TOKEN=xxxxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

#### Step 6: Update Your Logger

Your existing logger already has Sentry integration! Just need to enable it:

```typescript
// frontend/src/lib/logger.ts (already implemented)
import * as Sentry from "@sentry/nextjs";

export const logger = {
  error: (message: string, error?: Error, context?: Record<string, any>) => {
    const sanitized = sanitize({ message, context, error });
    console.error(sanitized);

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error || new Error(message), {
        extra: sanitized.context,
      });
    }
  },
  // ... other methods
};
```

### Sentry Dashboard Features

**1. Issues:**

- All errors grouped by type
- Frequency and trend charts
- Affected user count
- First seen / Last seen timestamps

**2. Performance:**

- Transaction overview
- Slow endpoints (> 500ms)
- Database query performance
- External API calls

**3. Releases:**

- Track which version introduced bugs
- Compare release performance
- Deploy tracking

**4. Alerts:**

```yaml
# Alert when:
- Error count > 10 in 5 minutes
- New error type detected
- Performance degradation (p95 > 1s)
- High rate of failed auth attempts
```

### Security Monitoring with Sentry

Track security events:

```typescript
// Log security events to Sentry
export function logSecurityEvent(
  type: "csrf_failure" | "auth_failure" | "rate_limit" | "reauth_required",
  context: Record<string, any>,
) {
  Sentry.captureMessage(`Security Event: ${type}`, {
    level: "warning",
    tags: {
      security: true,
      event_type: type,
    },
    extra: sanitize(context),
  });
}

// Usage in API routes
if (!csrfCheck.valid) {
  logSecurityEvent("csrf_failure", {
    endpoint: request.url,
    origin: request.headers.get("origin"),
  });
  return createCSRFErrorResponse();
}
```

### Sentry for Your Security Features

**Track these security events:**

1. **CSRF Failures:**

```typescript
Sentry.captureMessage("CSRF validation failed", {
  level: "warning",
  tags: { security: "csrf" },
  extra: { origin, host, endpoint },
});
```

2. **Re-Authentication Events:**

```typescript
Sentry.captureMessage("Re-authentication required", {
  level: "info",
  tags: { security: "reauth" },
  extra: { userId, resource: "server_share" },
});
```

3. **Rate Limit Violations:**

```typescript
Sentry.captureMessage("Rate limit exceeded", {
  level: "warning",
  tags: { security: "rate_limit" },
  extra: { endpoint, userId, ip },
});
```

4. **Failed Authentication:**

```typescript
Sentry.captureMessage("Authentication failure", {
  level: "warning",
  tags: { security: "auth" },
  extra: { method: "otp", email: sanitize(email) },
});
```

### Sentry Performance Monitoring

Track slow operations:

```typescript
// Automatic transaction tracking
import * as Sentry from "@sentry/nextjs"

export async function POST(request: NextRequest) {
  const transaction = Sentry.startTransaction({
    op: "api.secrets.create",
    name: "Create Secret",
  })

  try {
    // CSRF check
    const csrfSpan = transaction.startChild({ op: "csrf.validate" })
    const csrfCheck = await requireCSRFProtection(request)
    csrfSpan.finish()

    // Database operation
    const dbSpan = transaction.startChild({ op: "db.insert" })
    const secret = await db.insert(secrets).values(...)
    dbSpan.finish()

    transaction.setStatus("ok")
    return NextResponse.json({ success: true })
  } catch (error) {
    transaction.setStatus("error")
    Sentry.captureException(error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  } finally {
    transaction.finish()
  }
}
```

### Cost & Pricing

**Sentry SaaS Pricing:**

- **Developer (Free):** 5,000 events/month, 1 project
- **Team ($26/mo):** 50,000 events/month, unlimited projects
- **Business ($80/mo):** 100,000 events/month + enterprise features

**Self-hosted Sentry:**

- Free, unlimited events
- Requires server infrastructure
- Docker-based deployment

### Integration with Your Security Hardening

Sentry complements your security work:

1. **Detect attack attempts:**
   - Spike in CSRF failures → Possible attack
   - Many rate limit hits → DDoS or scraping
   - Failed re-auth → Unauthorized access attempt

2. **Monitor security feature effectiveness:**
   - Are rate limits too aggressive?
   - Are CSRF protections working?
   - How often is re-authentication triggered?

3. **Debug production issues:**
   - Why did this secret creation fail?
   - What caused the webhook replay?
   - User reported error - what happened?

---

## 🚀 Quick Start Guide

### For OWASP ZAP:

```bash
# 1. Pull Docker image
docker pull zaproxy/zap-stable

# 2. Run baseline scan against staging
docker run -v $(pwd):/zap/wrk/:rw \
  -t zaproxy/zap-stable zap-baseline.py \
  -t https://staging.yourdomain.com \
  -r zap-report.html

# 3. Review findings
open zap-report.html
```

### For Sentry:

```bash
# 1. Create account at https://sentry.io/signup/

# 2. Install Sentry
cd frontend
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs

# 3. Add DSN to .env.local
echo "SENTRY_DSN=your-dsn-here" >> .env.local

# 4. Deploy and monitor
# Errors will appear in Sentry dashboard
```

---

## 📋 Recommended Timeline

**Week 1: OWASP ZAP**

- Day 1-2: Run baseline scan, address high-severity findings
- Day 3-4: Run full scan, address medium-severity findings
- Day 5: Document findings, create remediation plan

**Week 2: Sentry APM**

- Day 1: Set up Sentry account and project
- Day 2: Install and configure Sentry SDK
- Day 3: Add security event tracking
- Day 4-5: Configure alerts and dashboards

**Ongoing:**

- Weekly ZAP scans in CI/CD
- Daily Sentry monitoring
- Monthly security review meetings

---

## 🎯 Success Metrics

**OWASP ZAP:**

- ✅ Zero high-severity findings
- ✅ < 5 medium-severity findings
- ✅ All findings documented with risk assessment

**Sentry APM:**

- ✅ Error rate < 1%
- ✅ Mean response time < 200ms
- ✅ Alert response time < 5 minutes
- ✅ 100% of critical errors tracked

---

## 📚 Additional Resources

**OWASP ZAP:**

- Official Docs: https://www.zaproxy.org/docs/
- Video Tutorials: https://www.zaproxy.org/videos/
- Community Forum: https://groups.google.com/group/zaproxy-users

**Sentry:**

- Official Docs: https://docs.sentry.io/
- Next.js Guide: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Performance Guide: https://docs.sentry.io/product/performance/

**OWASP Top 10:**

- https://owasp.org/www-project-top-ten/
