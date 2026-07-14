## Review

Cold verification target: `b7b7aef1a897c418e0402acd211fecf0206d8217` (`main`). `plan.md` was absent; `progress.md` describes unrelated issue #6 work and did not affect these verdicts. No project/source files were modified.

### Summary

- **3 TRUE POSITIVES:** A, C, D (D's forwarded-IP subclaim remains deployment-dependent).
- **1 FALSE POSITIVE:** B as an exploitable CSRF claim. The endpoints do omit the project's custom CSRF helper, but browser/platform controls prevent the claimed cross-site authenticated mutations under the evidenced threat model.

### A — TRUE POSITIVE, MEDIUM: unauthenticated OTP-verification requests can deny OTP login for an arbitrary email

- **Blocker / data flow:** `POST /api/auth/verify-otp` accepts only an email and attacker-chosen eight-digit code, with no session, client-IP limit, or endpoint-level throttle (`frontend/src/routes/api/auth/verify-otp/+server.ts:11-29`). `validateOTPToken` looks up the lockout by that supplied email before any user lookup (`frontend/src/lib/auth/otp.ts:120-154`). A nonexistent code reaches `trackFailedAttempt` (`frontend/src/lib/auth/otp.ts:183-204`), which creates a lockout row even when no account or OTP token exists (`frontend/src/lib/auth/otp.ts:251-307`).
- **State transition proof:** attempts 1–4 create/increment the row; attempt 5 sets a one-hour lock (`frontend/src/lib/auth/otp.ts:281-287`). Because active lockouts return before incrementing (`frontend/src/lib/auth/otp.ts:147-153`), escalation is slower than the original wording suggests: attempts 6–10 require waiting for each one-hour lock, attempt 10 starts 24-hour locks, and attempts 11–20 require roughly ten additional days. Attempt 20 makes the OTP lock permanent (`frontend/src/lib/auth/otp.ts:267-273`). A correct OTP cannot reset a permanent lock because the function returns before token validation; successful validation otherwise deletes the row at lines 238–241.
- **Why the apparent validation throttle does not help:** it sums `verificationTokens.attemptCount` (`frontend/src/lib/auth/otp.ts:161-180`), but the invalid-code path only updates `accountLockouts`; it never increments a verification token. A repository search found `attemptCount` initialized to zero and read here, but no failed-validation increment.
- **Practical impact:** five direct HTTP requests immediately deny the victim's OTP authentication for one hour. A persistent attacker can eventually make OTP authentication require support intervention. Password and Google sign-in are unaffected, so this is not a full-account lockout; that limitation keeps severity at MEDIUM.
- **Framework/environment:** this is an unauthenticated direct-request attack, so Auth.js cookies, SameSite, CORS, and CSRF do not block it. Input validation only forces a syntactically valid email and eight digits.
- **Pseudocode PoC:** `repeat 5: POST /api/auth/verify-otp JSON {email:victim, code:"00000000"}`; then the victim submits a valid OTP and receives the temporary-lock response. Negative preconditions: the chosen code must not equal an active OTP; permanent escalation requires waiting out each lock interval.
- **Gate result:** reachability, attacker control, state transition, impact, and environment gates pass. No live destructive PoC was run because it would write lockout state.

### B — FALSE POSITIVE, MEDIUM claim rejected: custom-CSRF omissions are not practically cross-site exploitable with the evidenced browser controls

- **Correct observation:** cookie-authenticated mutations do omit `requireCSRFProtection`, including contact-method update (`frontend/src/routes/api/user/contact-methods/+server.ts:20-55`), subscription downgrade scheduling (`frontend/src/routes/api/user/subscription/schedule-downgrade/+server.ts:6-16`) and cancellation, and admin retry/resolve routes (for example `frontend/src/routes/api/admin/email-failures/batch-retry/+server.ts:32-48`). Authentication/authorization is still required (`requireSession` or `requireAdmin`).
- **Primary protection 1 — SameSite:** Auth.js's default session cookie is explicitly `HttpOnly; SameSite=Lax; Path=/` and secure on HTTPS (`frontend/node_modules/@auth/core/src/lib/utils/cookie.ts:63-70`). A request initiated by a genuinely cross-site attacker origin therefore does not carry the session cookie for fetch/XHR, iframe/subresource, or cross-site POST form requests. Lax top-level GET behavior does not help because these mutations expose POST/PATCH.
- **Primary protection 2 — SvelteKit origin checking:** the project does not override `kit.csrf`, so SvelteKit's default `checkOrigin: true` and empty trusted-origin list apply (`frontend/svelte.config.js:5-13`; `frontend/node_modules/@sveltejs/kit/src/core/config/options.js:118-125`). In production, SvelteKit rejects cross-origin POST/PUT/PATCH/DELETE requests for all browser-form-safe content types (`frontend/node_modules/@sveltejs/kit/src/runtime/server/respond.js:76-102`), including URL-encoded, multipart, and `text/plain` (`frontend/node_modules/@sveltejs/kit/src/utils/http.js:72-81`). This also closes a same-site-but-cross-origin sibling-subdomain `no-cors`/`text/plain` attempt.
- **Primary protection 3 — CORS/preflight:** the handlers parse JSON, and no application CORS allow-origin configuration was found. A cross-origin `application/json` request is preflighted and cannot be sent by ordinary attacker JavaScript without server opt-in. A simple form/no-cors fallback is covered by SvelteKit's origin check and generally cannot supply the expected JSON shape.
- **Devil's advocate / realistic-origin check:** an attacker-controlled sibling under `keyfate.com` would be same-site for cookie purposes, but no such attacker-controlled origin or subdomain-takeover condition is evidenced. Even then, form-safe requests are rejected by SvelteKit and JSON requests fail CORS. An existing same-origin XSS would bypass these controls, but that is not CSRF and no XSS premise was supplied.
- **Pseudocode negative PoCs:** (1) evil-site form POST → no Lax session and SvelteKit 403; (2) evil-site `fetch(..., {credentials:"include", headers:{Content-Type:"application/json"}})` → preflight fails and cross-site cookie is withheld; (3) sibling-site `no-cors` text/plain POST → SvelteKit origin mismatch 403.
- **Gate failure:** practical authenticated reachability fails. The missing custom helper is inconsistent defense-in-depth and should be normalized, but it does not establish the claimed exploitable CSRF at MEDIUM severity.

### C — TRUE POSITIVE, MEDIUM: authenticated top-level cross-site navigation triggers payment-provider object creation through state-changing GETs

- **Blocker / source-to-sink:** Stripe GET accepts attacker-controlled `lookup_key` and any nonempty `redirect_after_auth`, then calls the shared creation path without the CSRF check used by POST (`frontend/src/routes/api/create-checkout-session/+server.ts:14-40`). After session auth, it creates a new Stripe customer before validating the price (`frontend/src/routes/api/create-checkout-session/+server.ts:55-83`) and creates a checkout session for a valid lookup key (`frontend/src/routes/api/create-checkout-session/+server.ts:88-112`). The provider calls `stripe.customers.create` and `stripe.checkout.sessions.create` without idempotency (`frontend/src/lib/payment/providers/StripeProvider.ts:40-49,140-211`).
- **BTCPay path:** its GET accepts amount/currency/mode/interval and only requires a truthy redirect flag (`frontend/src/routes/api/create-btcpay-checkout/+server.ts:14-30`), authenticates in the shared path, then creates a checkout session (`frontend/src/routes/api/create-btcpay-checkout/+server.ts:80-126`). The provider turns that into an authenticated POST to BTCPay's invoice API (`frontend/src/lib/payment/providers/BTCPayProvider.ts:175-190,400-426`).
- **Why browser protections do not stop it:** SameSite=Lax deliberately includes the Auth.js session cookie on a user-activated top-level cross-site GET navigation. SvelteKit's origin CSRF check applies only to non-GET mutations, and CORS is irrelevant to navigation. An attacker can use a convincing link or `window.location` assignment; invisible subresource triggering would not carry the Lax cookie, which is the negative precondition.
- **Impact and limits:** each successful navigation creates external Stripe customer/session records or a BTCPay invoice and redirects the victim into the provider checkout. It does **not** charge the victim or create a paid subscription without further provider-side user action. The bounded external-resource abuse, audit/payment-data pollution, and forced navigation support MEDIUM rather than HIGH severity.
- **Pseudocode PoC:** send an authenticated victim a link to `/api/create-checkout-session?lookup_key=<public-valid-key>&redirect_after_auth=true`, or `/api/create-btcpay-checkout?amount=0.0002&currency=BTC&mode=payment&redirect_after_auth=true`; victim click → Lax cookie → provider object creation → 303 to provider.
- **Gate result:** authenticated reachability, side-effect sinks, practical top-level trigger, impact, and environment gates pass. No live provider call was made to avoid creating billable/external artifacts.

### D — TRUE POSITIVE, MEDIUM: DB rate limiting is race-bypassable and fail-open; production XFF spoofability is not proven

- **Blocker / concurrency proof:** `checkRateLimitDB` performs `SELECT`, computes `entry.count + 1`, then writes an absolute value in a separate query (`frontend/src/lib/rate-limit-db.ts:30-59`). With `N` concurrent requests reading count `c < limit`, all compute/write `c+1` and all return success based on `c+1`; the durable counter advances once while up to `N` requests pass. On a new key, concurrent inserts race on the primary key; losing inserts enter the catch and are explicitly allowed (`frontend/src/lib/rate-limit-db.ts:62-83`). Thus repeated concurrent batches can materially exceed any configured limit.
- **Fail-open proof:** every DB/import/query error returns `success: true`, full remaining quota, and reset zero (`frontend/src/lib/rate-limit-db.ts:75-83`). An ordinary remote attacker cannot necessarily cause a general DB outage, but initial-row uniqueness races are attacker-triggerable and use this path.
- **Affected paths:** the DB limiter guards unauthenticated registration (`frontend/src/routes/api/auth/register/+server.ts:17-21`) and public check-in attempts (`frontend/src/routes/api/check-in/+server.ts:81-96`), plus authenticated secret creation (`frontend/src/routes/api/secrets/+server.ts:57-69`). `createOTPToken` has an optional DB-backed IP check, but the sole request-OTP caller does not pass an IP, so that is not counted as an affected live path. Other controls reduce individual impacts (registration validation/origin checks, high-entropy check-in tokens, tier limits), so severity remains MEDIUM.
- **Forwarded-IP subclaim:** `getClientIdentifier` trusts the leftmost `x-forwarded-for`, then `x-real-ip`, with no trusted-proxy parsing (`frontend/src/lib/rate-limit.ts:36-41`). This is unsafe if Railway appends rather than replaces a client-supplied XFF, because an attacker can rotate the first value. The repository contains no proxy normalization and the application does not use SvelteKit's trusted `getClientAddress`. However, the checked source cannot establish Railway's live header-rewrite behavior, so **production spoofability is UNPROVEN/deployment-dependent**, not independently confirmed.
- **Pseudocode PoC:** synchronize `N` requests behind a barrier against one fresh limiter key; all observe no row, one inserts, and insert losers fail open. For an existing count `c`, synchronize `N` requests so each reads `c`; all write `c+1` and report the same successful result. Negative condition: serialized requests count correctly; XFF rotation only works if the deployment proxy preserves attacker-supplied leftmost values.
- **Gate result:** the atomicity and fail-open portions pass reachability, concurrency, PoC-logic, and impact gates. The XFF exploitability gate remains unresolved without a credentialed production header-echo/proxy test.

### Cross-finding review

A does not rely on D: verify-OTP never calls the DB/IP limiter. D can amplify OTP **request** abuse but does not materially change A's lockout timing. B's protections do not save C because C deliberately uses GET, for which top-level Lax-cookie navigation is permitted.

### Validation notes

- Static traces were performed against the checked-out dependency source for SvelteKit 2.58/Auth.js 1.11 behavior, not assumed framework behavior.
- `bun test src/routes/api/check-in/__tests__/server.test.ts` passed (1 test, 5 assertions).
- Combined targeted invocation including `src/routes/api/admin/email-failures/__tests__/auth.test.ts` produced one passing check-in test but the admin suite failed before tests with existing `SyntaxError: Export named 'emailFailures' not found in .../src/lib/db/schema.ts`. This is unrelated to the review and no source was changed.
- No dedicated OTP, checkout, or DB-rate-limit tests exist under the searched `src/**/*.test.ts` paths.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Cold review stayed at HEAD b7b7aef1, traced only findings A-D, and modified no project/source files."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Each verdict includes source-to-sink line evidence, framework/Auth.js protections, practical and negative PoCs, impact limits, and gate reasoning."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/299cf632-9b0a-4aa8-b753-611c0bc425e1/audit-cold/web-fp.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git status --short && git rev-parse HEAD && git branch --show-current",
      "result": "passed",
      "summary": "Confirmed HEAD b7b7aef1 on main and captured the pre-existing untracked worktree state."
    },
    {
      "command": "cd frontend && rg/nl/read traces across OTP, CSRF, checkout, Auth.js cookie, SvelteKit runtime, payment providers, and rate limiter",
      "result": "passed",
      "summary": "Verified complete paths and exact dependency protections from checked-out source."
    },
    {
      "command": "cd frontend && bun test src/routes/api/check-in/__tests__/server.test.ts",
      "result": "passed",
      "summary": "1 test passed with 5 assertions."
    },
    {
      "command": "cd frontend && bun test src/routes/api/admin/email-failures/__tests__/auth.test.ts src/routes/api/check-in/__tests__/server.test.ts",
      "result": "failed",
      "summary": "Check-in test passed; admin suite failed during module loading because schema.ts does not export emailFailures."
    },
    {
      "command": "git diff --cached --name-only",
      "result": "passed",
      "summary": "No staged files."
    }
  ],
  "validationOutput": [
    "Verdicts: A TRUE MEDIUM; B FALSE (MEDIUM claim rejected); C TRUE MEDIUM; D TRUE MEDIUM with XFF production spoofability unproven.",
    "Auth.js session cookie is explicitly SameSite=Lax; SvelteKit default production origin checking covers all browser-form-safe mutation content types.",
    "No live lockout, Stripe, BTCPay, or production proxy tests were performed to avoid destructive/external side effects."
  ],
  "residualRisks": [
    "Railway's live treatment of client-supplied X-Forwarded-For was not credentialedly tested, so that subclaim remains deployment-dependent.",
    "No executable DB-concurrency PoC was run against a disposable PostgreSQL instance; the lost-update and insert-race results follow directly from the separated SQL operations.",
    "The pre-existing admin email-failure test module-load error prevented that suite from validating authorization behavior."
  ],
  "noStagedFiles": true,
  "diffSummary": "Added only the requested audit artifact; project/source and tests remain unchanged.",
  "reviewFindings": [
    "blocker: frontend/src/routes/api/auth/verify-otp/+server.ts:16 - unauthenticated attacker-selected emails reach persistent OTP lockout accounting.",
    "note: frontend/src/routes/api/user/contact-methods/+server.ts:20 - custom CSRF helper is omitted, but the claimed practical cross-site exploit is blocked by SameSite, SvelteKit origin checks, and CORS.",
    "blocker: frontend/src/routes/api/create-checkout-session/+server.ts:14 - state-changing payment-provider creation is exposed through authenticated GET navigation.",
    "blocker: frontend/src/lib/rate-limit-db.ts:30 - select/absolute-update races and explicit fail-open handling permit rate-limit bypass."
  ],
  "manualNotes": "plan.md was absent. progress.md concerned unrelated issue #6 work. Review gate evidence is contained in this artifact."
}
```
