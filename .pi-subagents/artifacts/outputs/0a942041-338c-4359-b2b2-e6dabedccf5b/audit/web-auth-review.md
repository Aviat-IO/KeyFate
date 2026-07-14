## Review

Scope: adversarial, read-only review of KeyFate HEAD `b7b7aef1a897c418e0402acd211fecf0206d8217`. `plan.md` was absent; `progress.md` was read. Generated/vendor content and `.worktrees` were excluded.

### Blocker — Any authenticated user receives a global application-key decryption oracle

**Severity:** High production-readiness blocker  
**Confidence:** High

**Attacker prerequisites:** A valid low-privilege KeyFate account plus another tenant's encrypted `server_share`, IV, and authentication tag. The latter could come from a read-only database/backup exposure, logging/telemetry exposure, or another ciphertext disclosure. This is explicitly a defense-in-depth/credential-custody blocker; the reviewed routes did not reveal a direct cross-tenant ciphertext IDOR.

**Source-to-impact trace:** Secrets are encrypted with one process-wide AES-256-GCM key selected only by key version (`frontend/src/lib/encryption.ts:41-79,93-117`). Stored server shares use that global encryption function (`frontend/src/routes/api/secrets/+server.ts:141-166`). `POST /api/decrypt` accepts attacker-supplied ciphertext, IV, and tag, checks only that *some* session exists, and decrypts with the same default global key (`frontend/src/routes/api/decrypt/+server.ts:12-28`; `frontend/src/lib/encryption.ts:121-138`). It does not bind ciphertext to a user, secret ID, or authenticated associated data. Therefore a read-only data compromise that should expose ciphertext only can be upgraded by any registered attacker into plaintext recovery of every captured server share.

**Protections checked:** AES-256-GCM, random 12-byte IVs, key length/entropy validation, authenticated-session requirement, owner filtering on normal secret routes, and re-authentication on the dedicated share reveal/export routes. Those controls do not constrain this generic decrypt endpoint. No tenant-specific key derivation, ownership lookup, ciphertext registry, AAD binding, CSRF check, recent-authentication check, or rate limit exists here.

**Required disposition:** Remove the generic production decrypt endpoint or constrain it to an owned secret record and bind encryption to immutable tenant/secret context (AAD or tenant-scoped keys). Treat the application encryption key as a high-value production credential and verify it cannot be reached through a user-controlled oracle.

### Medium — OTP verification lets an unauthenticated attacker lock a known account

**Confidence:** High

**Attacker prerequisites:** Knowledge of a victim's email address; no account, valid OTP, Turnstile token, or victim interaction is required.

**Source-to-impact trace:** The public `POST /api/auth/verify-otp` accepts an email and any syntactically valid eight-digit code and calls `validateOTPToken` without an endpoint/IP rate limit (`frontend/src/routes/api/auth/verify-otp/+server.ts:11-29`). A nonmatching code unconditionally calls `trackFailedAttempt` for the supplied email (`frontend/src/lib/auth/otp.ts:183-204`). Five failures set a one-hour lock; ten accumulated failures set a 24-hour lock; twenty accumulated failures permanently lock the email (`frontend/src/lib/auth/otp.ts:251-280` and subsequent update/insert logic). The validation-attempt limiter queries `verificationTokens.attemptCount` (`frontend/src/lib/auth/otp.ts:161-180`), but issued tokens start at zero (`frontend/src/lib/auth/otp.ts:90-97`) and the failed-attempt path never increments that field. Thus five requests immediately deny OTP authentication for an hour; an attacker can repeat after expiry and eventually create the permanent lockout.

**Protections checked:** Eight-digit format validation, row locking for a matching token, token expiry, per-token maximum constant, account lockout, OTP-request email limits, and optional Turnstile on *requesting* an OTP. None rate-limits the public verification endpoint by trusted client identity, and the unused `attemptCount` check does not activate. Password/Google login remains possible where configured, so impact is OTP-channel account availability rather than universal account takeover.

**Required disposition:** Atomically increment attempts on the active OTP, add trusted-IP plus account/email verification throttling, avoid attacker-triggerable permanent lockouts, and require an issued challenge identifier rather than accepting arbitrary email/code pairs.

### Medium — State-changing authenticated/admin routes omit the application's CSRF control

**Confidence:** High

**Attacker prerequisites:** A victim with an authenticated session visits an attacker-controlled origin that is same-site with KeyFate (for example, a compromised or dangling sibling subdomain). For the admin retry impact, the victim must be an admin. Normal cross-site POSTs are partly mitigated by expected SameSite cookie behavior; this finding does not assume that an unrelated third-party origin receives cookies.

**Source-to-impact trace:** The project has explicit origin-plus-one-time-token protection in `requireCSRFProtection` and uses it on core secret/payment POSTs. In contrast, subscription downgrade scheduling and cancellation authenticate and mutate immediately without origin/token checks (`frontend/src/routes/api/user/subscription/schedule-downgrade/+server.ts:6-16`; `frontend/src/routes/api/user/subscription/cancel-downgrade/+server.ts:6-16`). Contact-method replacement likewise parses attacker-supplied JSON and writes it after session authentication only (`frontend/src/routes/api/user/contact-methods/+server.ts:20-55`). Admin email retry performs a side-effecting send after `requireAdmin` only (`frontend/src/routes/api/admin/email-failures/[id]/retry/+server.ts:22-52`); batch retry and resolution follow the same pattern. A same-site sibling can submit a form for bodyless routes or a simple `text/plain` credentialed request containing JSON (SvelteKit's `request.json()` does not enforce content type), causing subscription/account-data changes or admin email sends under the victim session.

**Protections checked:** Session authentication, per-user service calls, admin role guard, SameSite-cookie expectations, browser CORS read blocking, and the existing CSRF helper. CORS does not prevent a simple request from being sent, and these routes neither validate `Origin` nor consume the CSRF token. No global unsafe-method enforcement exists in `hooks.server.ts`.

**Required disposition:** Apply the existing CSRF helper (or centralized Origin/Fetch-Metadata enforcement) to every cookie-authenticated unsafe method, including user/GDPR/subscription/admin mutations, and add an automated route inventory test.

### Medium — Checkout creation is a cross-site-triggerable GET with no throttling or idempotency

**Confidence:** High

**Attacker prerequisites:** An authenticated victim is navigated to an attacker-crafted URL. A top-level cross-site GET normally carries a SameSite=Lax session cookie; no same-site sibling is required.

**Source-to-impact trace:** `GET /api/create-checkout-session` treats query parameters as authorization to create a checkout (`frontend/src/routes/api/create-checkout-session/+server.ts:14-23`). After session validation it creates a fresh Stripe customer on every request before price lookup, then creates a Stripe Checkout Session and redirects (`frontend/src/routes/api/create-checkout-session/+server.ts:55-83,88-120`). `StripeProvider.createCustomer` always calls `stripe.customers.create` (`frontend/src/lib/payment/providers/StripeProvider.ts:40-49`). There is no CSRF/origin check, rate limit, idempotency key, or reuse of a persisted provider customer. Repeated navigations create unbounded provider-side customers/sessions attributed to the victim, producing third-party resource exhaustion, noisy billing operations, and forced navigation. The analogous BTCPay GET also creates invoices from query parameters (`frontend/src/routes/api/create-btcpay-checkout/+server.ts:14-42,81-126`).

**Protections checked:** Authentication, lookup-key allowlisting for Stripe prices, server-side amount selection when a BTCPay billing interval is present, webhook signatures, and POST-side CSRF checks. Those do not protect the state-changing GET paths. No charge is completed without user/provider payment confirmation, so this is not reported as direct financial theft.

**Required disposition:** Make creation POST-only, preserve intended post-login state server-side, enforce CSRF/origin checks, reuse one provider customer per user, and add per-user throttling/idempotency.

### Medium — Security rate limits are non-atomic, fail open, and accept the first forwarded IP

**Confidence:** High for concurrency/fail-open behavior; Medium for forwarded-IP exploitability because it depends on Railway's exact header normalization.

**Attacker prerequisites:** Ability to send parallel direct HTTP requests. Header-spoof bypass additionally requires the edge proxy to preserve/append a client-supplied `X-Forwarded-For` value rather than replacing it.

**Source-to-impact trace:** The DB limiter reads a counter, calculates `entry.count + 1`, then writes that absolute value in separate statements (`frontend/src/lib/rate-limit-db.ts:30-59`). Concurrent requests can all observe the same count and overwrite it with the same increment, allowing a burst far above the configured limit. All database errors return `success: true` (`frontend/src/lib/rate-limit-db.ts:75-83`), disabling abuse controls during contention/outage. IP identity is the first comma-separated `X-Forwarded-For` value with no trusted-proxy boundary (`frontend/src/lib/rate-limit.ts:36-41`), and registration relies on that value for its five/hour control (`frontend/src/routes/api/auth/register/+server.ts:17-21`). Although `createOTPToken` supports an IP limit, the request-OTP route calls it without an IP (`frontend/src/lib/auth/otp.ts:28-48`; `frontend/src/routes/api/auth/request-otp/+server.ts:57`), leaving only per-address limits and optional Turnstile (`frontend/src/routes/api/auth/request-otp/+server.ts:26-37,46-63`). This permits parallel-limit bypass and broad account/email resource abuse.

**Protections checked:** Persistent DB counters, unique primary key, expiry window, registration Origin check, per-email OTP limits, and optional Turnstile. The counter update has no transaction/row lock/atomic upsert, errors fail open, and Turnstile is optional based solely on whether an environment variable exists.

**Required disposition:** Use a single atomic conditional increment/upsert, choose an explicit fail-closed or degraded policy for auth abuse controls, derive client IP only from a verified platform header/trusted proxy chain, pass it to OTP issuance, and make production bot-protection configuration fail startup when required.

### Correct controls observed

- JWT sessions are rejected when the user disappears, the DB is unavailable, or `sessionVersion` changes (`frontend/src/auth.ts`, JWT callback); password reset increments `sessionVersion` transactionally.
- Core secret reads/writes generally combine resource ID with `session.user.id`; sampled nested recipient, Bitcoin, export, audit, and deletion routes also enforce ownership.
- Cron/diagnostic endpoints use constant-time bearer comparison or timestamped HMAC authorization (`frontend/src/lib/cron/utils.ts`).
- Stripe and BTCPay webhooks verify signatures and claim deduplication records before business side effects; the BTCPay replay tests passed in this run.

## Acceptance

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Performed the requested read-only security review at exact HEAD b7b7aef1; no project/source files were modified and scope was limited to the requested web/auth surfaces."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Each reported Medium-or-higher finding includes attacker prerequisites, source-to-impact trace, file:line references, checked protections, confidence, and required disposition."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git rev-parse HEAD && git status --short && git diff --stat && git diff --cached --stat",
      "result": "passed",
      "summary": "Confirmed exact HEAD b7b7aef1a897c418e0402acd211fecf0206d8217, no staged files, and only pre-existing untracked files/artifacts."
    },
    {
      "command": "rg/read-only route, auth, CSRF, rate-limit, DB ownership, cron, payment, and webhook inspection commands",
      "result": "passed",
      "summary": "Inventoried server handlers and traced authentication, ownership predicates, CSRF use, rate limits, webhook verification, cron authorization, and encryption flows."
    },
    {
      "command": "cd frontend && bun test src/lib/auth/__tests__/auth-config.test.ts src/lib/auth/__tests__/session-management.test.ts src/lib/auth/__tests__/admin-guard.test.ts src/routes/api/admin/email-failures/__tests__/auth.test.ts src/routes/api/webhooks/stripe/__tests__/server.test.ts src/routes/api/webhooks/btcpay/__tests__/server.test.ts",
      "result": "failed",
      "summary": "21 passed, 6 failed, 2 module-load errors. BTCPay replay tests and auth/admin guard tests passed; session/admin/Stripe suites hit Bun mock/module export errors (drizzle sql, schema exports), so the targeted validation gate is not clean."
    }
  ],
  "validationOutput": [
    "HEAD matched the requested b7b7aef1 commit.",
    "Targeted tests: 21 pass, 6 fail, 2 errors across 6 files; failures were recorded rather than treated as security proof.",
    "No direct cross-tenant IDOR was found in the sampled secret, recipient, Bitcoin, audit, GDPR export/deletion, subscription, admin, cron, or webhook ownership paths."
  ],
  "residualRisks": [
    "No dynamic attack was executed against a deployed Railway environment, Stripe, BTCPay, SendGrid, PostgreSQL, or Google OAuth.",
    "Proxy header normalization and actual Auth.js cookie attributes must be verified in the deployed environment.",
    "Targeted security tests are not fully runnable under the current Bun mock/module setup.",
    "plan.md was absent; progress.md states this was already known."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only review; no source diff. This required audit artifact is the only file written by the reviewer.",
  "reviewFindings": [
    "blocker: frontend/src/routes/api/decrypt/+server.ts:12-28 - authenticated global-key decryption oracle defeats ciphertext-at-rest isolation after read-only ciphertext exposure",
    "medium: frontend/src/lib/auth/otp.ts:183-280 - unauthenticated OTP guesses can lock known victim emails",
    "medium: frontend/src/routes/api/user/subscription/schedule-downgrade/+server.ts:6-16 - authenticated mutation routes inconsistently omit CSRF controls",
    "medium: frontend/src/routes/api/create-checkout-session/+server.ts:14-23 - state-changing GET creates unthrottled payment-provider resources",
    "medium: frontend/src/lib/rate-limit-db.ts:30-83 - non-atomic, fail-open security counters permit parallel bypass"
  ],
  "manualNotes": "Review gate should remain blocked until the High production-readiness blocker is removed or explicitly accepted and the targeted test harness is clean."
}
```
