# Remediate Security Vulnerabilities

## Why

KeyFate handles highly sensitive user data including encrypted secrets,
authentication sessions, and payment information. Running outdated dependencies
with known security vulnerabilities exposes the platform to potential exploits
including improper authorization, SSRF attacks, and information disclosure
through cache misuse. The Snyk security audit identified 1 critical, 2 high, and
4 medium severity vulnerabilities in production dependencies (Next.js and
nodemailer). Remediating these vulnerabilities immediately is essential to
maintain security posture and user trust, particularly given the zero-knowledge
architecture that depends on secure infrastructure to protect encrypted shares.

## Problem

Snyk security audit identified 8 unique vulnerabilities across the project
dependencies:

### Critical Severity (1)

- **Improper Authorization** in `next@15.0.3` (SNYK-JS-NEXT-9508709)
- **Predictable Value Range from Previous Values** in `form-data@2.5.1`
  (SNYK-JS-FORMDATA-10841150) - transitive dependency in Terraform cache

### High Severity (2)

- **Server-side Request Forgery (SSRF)** in `next@15.0.3`
  (SNYK-JS-NEXT-12299318)
- **Allocation of Resources Without Limits or Throttling** in
  `golang.org/x/oauth2/jws` (SNYK-GOLANG-GOLANGORGXOAUTH2JWS-8749594) -
  transitive dependency in Terraform cache

### Medium Severity (4)

- **Use of Cache Containing Sensitive Information** in `next@15.0.3`
  (SNYK-JS-NEXT-12301496)
- **Race Condition** in `next@15.0.3` (SNYK-JS-NEXT-10176058)
- **Allocation of Resources Without Limits or Throttling** in `next@15.0.3`
  (SNYK-JS-NEXT-8602067)
- **Interpretation Conflict** in `nodemailer@7.0.6`
  (SNYK-JS-NODEMAILER-13378253)
- **Missing Release of Resource after Effective Lifetime** in `inflight@1.0.6`
  (SNYK-JS-INFLIGHT-6095116) - no patch available

### Low Severity (2)

- **Missing Source Correlation of Multiple Independent Data** in `next@15.0.3`
  (SNYK-JS-NEXT-12265451)
- **Missing Origin Validation in WebSockets** in `next@15.0.3`
  (SNYK-JS-NEXT-10259370)
- **Regular Expression Denial of Service (ReDoS)** in `brace-expansion@1.1.11`
  (SNYK-JS-BRACEEXPANSION-9789073) - transitive dependency in Terraform cache

## Proposed Solution

### Immediate Action (Application Dependencies)

1. **Upgrade Next.js:** `next@15.0.3` → `next@15.4.2` (fixes 7 vulnerabilities)
2. **Upgrade Nodemailer:** `nodemailer@7.0.6` → `nodemailer@7.0.7` (fixes 1
   vulnerability)

### Deferred Action (Infrastructure Cache)

The following vulnerabilities exist only in Terraform `.terragrunt-cache`
directories and are not part of the production application:

- `form-data@2.5.1` (in Google Cloud modules)
- `golang.org/x/oauth2/jws` (in Google Cloud modules)
- `brace-expansion@1.1.11` (in Google Cloud modules)
- `inflight@1.0.6` (in Google Cloud modules - no patch available)

**Recommendation:** Clean Terragrunt cache directories periodically and monitor
for upstream fixes in Google Cloud Terraform modules.

## Impact

### Security Benefits

- Eliminates 1 critical and 2 high severity vulnerabilities in production
  application
- Mitigates 4 medium severity vulnerabilities related to caching, race
  conditions, and resource allocation
- Addresses 2 low severity issues related to WebSocket validation and data
  correlation

### Risk Assessment

- **Low Risk:** Patch version upgrades (Next.js 15.0.3 → 15.4.2, nodemailer
  7.0.6 → 7.0.7)
- **Breaking Changes:** None expected for minor/patch upgrades
- **Testing Required:** Full application test suite, particularly:
  - Authentication flows (Next.js upgrade)
  - Email sending functionality (nodemailer upgrade)
  - Server actions and API routes (Next.js upgrade)

## Scope

### In Scope

- Upgrade `next` package in `frontend/package.json`
- Upgrade `nodemailer` package in `frontend/package.json`
- Update lock files (`pnpm-lock.yaml`)
- Run test suite to validate changes
- Document vulnerabilities in infrastructure cache

### Out of Scope

- Terraform module vulnerabilities (infrastructure cache dependencies)
- Rewriting code to work around `inflight@1.0.6` (no patch available, transitive
  dependency)
- Upgrading to Next.js 16.x or other major version changes

## Dependencies

- Requires `pnpm` package manager
- Requires full test suite to pass
- May require updates to `eslint-config-next` to match Next.js version

## Related Changes

None - this is a standalone security remediation.

## Timeline

- **Preparation:** 15 minutes (review changes, backup)
- **Implementation:** 30 minutes (upgrade packages, update lock files)
- **Testing:** 45 minutes (run full test suite, manual verification)
- **Total:** ~1.5 hours
