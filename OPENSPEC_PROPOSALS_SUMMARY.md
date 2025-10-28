# OpenSpec Proposals Summary

## Overview

Two new OpenSpec change proposals have been created for security and monitoring
enhancements:

1. **add-owasp-zap-ci** - Automated security scanning with OWASP ZAP
2. **add-posthog-analytics** - Product analytics and monitoring with PostHog

Both proposals have been validated with `openspec validate --strict` ✅

---

## Proposal 1: OWASP ZAP Security Scanning

**Change ID:** `add-owasp-zap-ci`\
**Location:** `openspec/changes/add-owasp-zap-ci/`\
**Validation:** ✅ Valid

### What It Does

Adds automated security vulnerability scanning using OWASP ZAP to the CI/CD
pipeline via GitHub Actions.

### Key Features

- **Baseline Scan (PR):** Quick passive scan on every pull request (~5-10
  minutes)
- **Full Scan (Staging):** Comprehensive active scan on staging deployments
  (~30-60 minutes)
- **OWASP Top 10 Coverage:** Tests for SQL injection, XSS, CSRF, security
  misconfigurations, etc.
- **Automated Reporting:** HTML and JSON reports as GitHub Actions artifacts
- **PR Status Checks:** High-severity findings block PR merges
- **False Positive Handling:** Configurable rules via `.zap/rules.tsv`

### Implementation Scope

**New Files:**

- `.github/workflows/security-scan.yml` - GitHub Actions workflow
- `.zap/rules.tsv` - ZAP scan configuration

**New Capability:**

- `openspec/specs/security-testing/` (after archive)

**Timeline:** 1-2 days

### Requirements Summary

1. **Automated Security Scanning** - ZAP runs on PR and staging deployments
2. **ZAP Scan Configuration** - Customizable rules and false positive
   suppression
3. **Security Scan Reporting** - HTML and JSON reports with findings
4. **Scan Result Validation** - High-severity findings fail PR, medium/low are
   informational
5. **Scan Performance** - Baseline <10min, Full <60min

### Tasks Breakdown

- 6 major sections, 24 tasks total
- Covers: ZAP config, GitHub Actions, scan types, reporting, documentation,
  testing

### Expected Outcomes

**After Implementation:**

- ✅ Every PR gets security scanned before merge
- ✅ Staging deployments get comprehensive security audit
- ✅ High-severity vulnerabilities caught before production
- ✅ Security reports available for audit and compliance
- ✅ Zero high-severity findings expected (due to existing security hardening)

---

## Proposal 2: PostHog Analytics & Monitoring

**Change ID:** `add-posthog-analytics`\
**Location:** `openspec/changes/add-posthog-analytics/`\
**Validation:** ✅ Valid

### What It Does

Integrates PostHog for comprehensive product analytics, session replay, error
tracking, performance monitoring, and feature flags.

### Key Features

**Product Analytics:**

- Event tracking (sign-ins, secret creation, check-ins, payments)
- User behavior analysis
- Funnel and retention analysis
- Custom dashboards

**Session Replay:**

- Record user sessions (10% sample rate)
- 100% capture on errors
- Privacy controls (mask sensitive fields)

**Error Tracking:**

- Client-side error capture
- Server-side error tracking
- Stack traces with context
- Similar to Sentry but integrated with PostHog

**Performance Monitoring:**

- Core Web Vitals (LCP, FID, CLS)
- API response times
- Slow query detection
- Performance alerts

**Feature Flags:**

- Client-side and server-side evaluation
- Gradual rollouts
- A/B testing
- No code deployment required

### Implementation Scope

**New Files:**

- `frontend/src/lib/analytics/posthog.ts` - Client SDK wrapper
- `frontend/src/lib/analytics/posthog-server.ts` - Server SDK wrapper

**Modified Files:**

- `frontend/src/app/layout.tsx` - PostHog provider initialization
- `frontend/src/lib/logger.ts` - Integrate error tracking
- API routes - Server-side event tracking

**New Environment Variables:**

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

**New Capability:**

- `openspec/specs/analytics/` (after archive)

**Timeline:** 2-3 days

**Privacy Impact:** Requires Privacy Policy update for session replay and
analytics

### Requirements Summary

1. **PostHog SDK Integration** - Client and server initialization
2. **Event Tracking** - Track key user actions (auth, secrets, check-ins,
   payments)
3. **Error Tracking** - Capture errors with context, privacy-safe
4. **Performance Monitoring** - Core Web Vitals, API response times
5. **Session Replay** - Record sessions with privacy controls
6. **Feature Flags** - Client/server feature toggles
7. **Privacy & Data Protection** - PII sanitization, opt-out, GDPR compliance
8. **Analytics Dashboard** - Key metrics, alerts
9. **Logger Integration** - Unified error tracking

### Tasks Breakdown

- 11 major sections, 51 tasks total
- Covers: PostHog setup, client/server integration, event tracking, performance
  monitoring, session replay, feature flags, error tracking, privacy,
  dashboards, testing

### Expected Outcomes

**After Implementation:**

- ✅ Real-time visibility into user behavior and product usage
- ✅ Automatic error tracking with full context
- ✅ Performance monitoring (response times, Core Web Vitals)
- ✅ Session replay for debugging production issues
- ✅ Feature flags for gradual rollouts
- ✅ Privacy-preserving analytics (no PII)
- ✅ Dashboards and alerts for key metrics

---

## Comparison: PostHog vs Sentry

| Feature                | PostHog           | Sentry            |
| ---------------------- | ----------------- | ----------------- |
| Error Tracking         | ✅ Yes            | ✅ Yes (primary)  |
| Performance Monitoring | ✅ Yes            | ✅ Yes            |
| Product Analytics      | ✅ Yes (primary)  | ❌ No             |
| Session Replay         | ✅ Yes            | ✅ Yes            |
| Feature Flags          | ✅ Yes            | ❌ No             |
| User Funnels           | ✅ Yes            | ❌ No             |
| A/B Testing            | ✅ Yes            | ❌ No             |
| Pricing                | Free tier + usage | Free tier + usage |
| Open Source            | ✅ Self-hostable  | ✅ Self-hostable  |
| Integration Complexity | Medium            | Medium            |

**Key Difference:** PostHog is a **product analytics platform** with error
tracking, while Sentry is an **error tracking platform** with performance
monitoring.

**Recommendation:** PostHog provides more comprehensive product insights
including analytics, funnels, and feature flags, making it a better choice for
understanding user behavior and product-market fit.

---

## Comparison: OWASP ZAP vs Manual Security Testing

| Aspect                | OWASP ZAP (Automated) | Manual Testing    |
| --------------------- | --------------------- | ----------------- |
| Speed                 | 5-60 minutes          | Days/weeks        |
| Coverage              | OWASP Top 10          | Variable          |
| Consistency           | 100% consistent       | Depends on tester |
| Cost                  | Free                  | Expensive         |
| False Positives       | Some                  | Rare              |
| Deep Logic Testing    | Limited               | Excellent         |
| CI/CD Integration     | ✅ Yes                | ❌ No             |
| Continuous Monitoring | ✅ Yes                | ❌ No             |

**Key Insight:** OWASP ZAP provides **continuous automated security validation**
that complements (not replaces) periodic manual security audits.

---

## Next Steps

### To Review Proposals

```bash
# View OWASP ZAP proposal
cd /Users/alancolver/dev/dead-mans-switch
npx openspec show add-owasp-zap-ci

# View PostHog proposal
npx openspec show add-posthog-analytics

# View spec deltas
npx openspec diff add-owasp-zap-ci
npx openspec diff add-posthog-analytics
```

### To Implement (After Approval)

**OWASP ZAP:**

1. Follow `openspec/changes/add-owasp-zap-ci/tasks.md`
2. Create `.github/workflows/security-scan.yml`
3. Configure `.zap/rules.tsv`
4. Test on sample PR
5. Mark tasks complete with `- [x]`

**PostHog:**

1. Follow `openspec/changes/add-posthog-analytics/tasks.md`
2. Create PostHog account and project
3. Install `posthog-js` and `posthog-node`
4. Implement analytics utilities
5. Add event tracking
6. Update Privacy Policy
7. Mark tasks complete with `- [x]`

### To Archive (After Deployment)

```bash
# After OWASP ZAP is deployed
npx openspec archive add-owasp-zap-ci

# After PostHog is deployed
npx openspec archive add-posthog-analytics
```

---

## Files Created

### OWASP ZAP Proposal

```
openspec/changes/add-owasp-zap-ci/
├── proposal.md           # Why, what, impact
├── tasks.md              # 24 implementation tasks
└── specs/
    └── security-testing/
        └── spec.md       # 5 requirements, 13 scenarios
```

### PostHog Proposal

```
openspec/changes/add-posthog-analytics/
├── proposal.md           # Why, what, impact
├── tasks.md              # 51 implementation tasks
└── specs/
    └── analytics/
        └── spec.md       # 9 requirements, 21 scenarios
```

### This Summary

```
OPENSPEC_PROPOSALS_SUMMARY.md  # This file
```

---

## Validation Results

```bash
$ npx openspec validate add-owasp-zap-ci --strict
✅ Change 'add-owasp-zap-ci' is valid

$ npx openspec validate add-posthog-analytics --strict
✅ Change 'add-posthog-analytics' is valid
```

Both proposals pass strict validation with:

- ✅ Valid proposal.md structure
- ✅ Complete tasks.md checklist
- ✅ Properly formatted spec deltas
- ✅ All requirements have scenarios
- ✅ Correct requirement headers (#### Scenario:)
- ✅ ADDED operations for new capabilities

---

## Estimated Implementation Time

**OWASP ZAP:** 1-2 days

- Simple GitHub Actions workflow
- Minimal configuration
- Straightforward testing

**PostHog:** 2-3 days

- SDK integration (client + server)
- Event tracking implementation
- Privacy controls configuration
- Dashboard setup
- Testing and validation

**Total:** 3-5 days for both (can be done in parallel)

---

## Benefits Summary

### OWASP ZAP Benefits

1. **Continuous Security Validation** - Every PR gets scanned
2. **Early Detection** - Catch vulnerabilities before production
3. **Compliance** - Automated security audit trail
4. **Cost-Effective** - Free, open-source tool
5. **CI/CD Native** - Integrates seamlessly with GitHub Actions

### PostHog Benefits

1. **Complete Visibility** - Understand user behavior and product usage
2. **Faster Debugging** - Session replay shows exactly what users experienced
3. **Data-Driven Decisions** - Analytics inform product roadmap
4. **Feature Control** - Feature flags enable gradual rollouts
5. **Unified Monitoring** - Error tracking + analytics + performance in one tool
6. **Privacy-First** - Open source, self-hostable, GDPR-compliant

---

**Status:** Both proposals ready for review and approval ✅
