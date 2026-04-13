# Security App Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Remove the six application-level security issues identified in the
audit while preserving current product behavior.

**Architecture:** Implement five domain-grouped remediation streams in an
isolated worktree. Each stream must start with a failing regression test, use
the minimum code change to pass it, and avoid unrelated cleanup. Because the
repository baseline is already red, use targeted test commands per stream until
the end.

**Tech Stack:** SvelteKit 5, Auth.js (`@auth/sveltekit`), Bun, Vitest, Drizzle
ORM, PostgreSQL.

---

### Task 1: Admin Auth Hardening

**Files:**

- Modify: `frontend/src/routes/api/admin/email-failures/+server.ts`
- Modify: `frontend/src/routes/api/admin/email-failures/[id]/+server.ts`
- Modify: `frontend/src/routes/api/admin/email-failures/[id]/retry/+server.ts`
- Modify: `frontend/src/routes/api/admin/email-failures/batch-retry/+server.ts`
- Reuse: `frontend/src/lib/auth/admin-guard.ts`
- Test: `frontend/src/routes/api/admin/email-failures/**/*.test.ts` or new
  focused route tests

**Step 1: Write the failing test**

Add a route-level test proving a request with no authenticated admin session is
rejected even if `ADMIN_TOKEN` is unset or the caller sends
`Bearer admin-secret`.

**Step 2: Run test to verify it fails**

Run: targeted Vitest command for the new admin route test file. Expected: FAIL
because the current routes still accept bearer-token auth paths.

**Step 3: Write minimal implementation**

Replace per-route token checks with the session-based admin guard already used
by `api/admin/metrics`. Remove the hardcoded fallback entirely.

**Step 4: Run test to verify it passes**

Run: the same targeted Vitest command. Expected: PASS.

### Task 2: Real Session Revocation

**Files:**

- Modify: `frontend/src/auth.ts`
- Modify: `frontend/src/lib/auth/session-management.ts`
- Test: `frontend/src/lib/auth/__tests__/auth-config.test.ts` or new focused
  auth session tests

**Step 1: Write the failing test**

Add a test proving a JWT issued before `users.updatedAt` is rejected during
callback processing, and a test proving fresh tokens remain valid.

**Step 2: Run test to verify it fails**

Run: targeted Vitest command for the auth test file. Expected: FAIL because the
current JWT callback ignores revocation/update timestamps.

**Step 3: Write minimal implementation**

In the JWT callback, load the current user timestamp when needed and reject or
invalidate tokens older than the account update time used for revocation.

**Step 4: Run test to verify it passes**

Run: the same targeted Vitest command. Expected: PASS.

### Task 3: Redirect Validation

**Files:**

- Modify: `frontend/src/routes/sign-in/+page.svelte`
- Modify: `frontend/src/routes/sign-up/+page.svelte`
- Modify: `frontend/src/routes/auth/login/+page.svelte`
- Modify: `frontend/src/lib/components/EmailVerification.svelte`
- Optionally create: `frontend/src/lib/auth/redirects.ts`
- Test: new focused tests near the redirect helper or affected pages/components

**Step 1: Write the failing test**

Add tests proving external URLs in `callbackUrl` or `next` are rejected or
normalized to an internal safe fallback, while internal relative paths still
work.

**Step 2: Run test to verify it fails**

Run: targeted Vitest command for the redirect test file. Expected: FAIL because
the current code forwards unvalidated redirect targets.

**Step 3: Write minimal implementation**

Introduce one shared validator that only allows relative internal paths or
same-origin URLs and apply it at each redirect entry point.

**Step 4: Run test to verify it passes**

Run: the same targeted Vitest command. Expected: PASS.

### Task 4: Atomic Webhook Idempotency

**Files:**

- Modify: `frontend/src/lib/webhooks/deduplication.ts`
- Modify: `frontend/src/routes/api/webhooks/stripe/+server.ts`
- Modify: `frontend/src/routes/api/webhooks/btcpay/+server.ts`
- Test: existing webhook tests or new focused deduplication tests

**Step 1: Write the failing test**

Add a test proving duplicate deliveries cannot both proceed past the idempotency
gate. Prefer a test at the deduplication layer if route-level concurrency is too
heavy.

**Step 2: Run test to verify it fails**

Run: targeted Vitest command for the deduplication or webhook test file.
Expected: FAIL because the current flow checks before recording.

**Step 3: Write minimal implementation**

Make event claiming atomic under the unique provider/event ID key, and only run
business logic after a successful claim.

**Step 4: Run test to verify it passes**

Run: the same targeted Vitest command. Expected: PASS.

### Task 5: Hash High-Value Tokens At Rest

**Files:**

- Modify: `frontend/src/lib/auth/password-reset.ts`
- Modify: `frontend/src/lib/auth/email-verification.ts`
- Modify: `frontend/src/routes/api/auth/verify-email/+server.ts`
- Modify: `frontend/src/routes/api/auth/verify-email-callback/+server.ts`
- Modify: `frontend/src/auth.ts`
- Test: new focused token storage/validation tests

**Step 1: Write the failing test**

Add tests proving generated reset and verification tokens are stored hashed,
while submitted raw tokens still validate correctly.

**Step 2: Run test to verify it fails**

Run: targeted Vitest command for the token validation test file. Expected: FAIL
because tokens are currently stored and queried in plaintext.

**Step 3: Write minimal implementation**

Add one shared hash function for these tokens, store only the hash, and update
validation paths to hash incoming token values before lookup.

**Step 4: Run test to verify it passes**

Run: the same targeted Vitest command. Expected: PASS.

### Task 6: Remove Token Leakage From Check-In Logging

**Files:**

- Modify: `frontend/src/routes/api/check-in/+server.ts`
- Test: new focused check-in logging test or existing endpoint test file

**Step 1: Write the failing test**

Add a test proving request logging does not include the raw `token` query
parameter or full token-bearing URL.

**Step 2: Run test to verify it fails**

Run: targeted Vitest command for the check-in logging test file. Expected: FAIL
because the current log entry includes `event.url.toString()`.

**Step 3: Write minimal implementation**

Log only route metadata and a redacted token fingerprint if needed. Do not log
full token values or tokenized URLs.

**Step 4: Run test to verify it passes**

Run: the same targeted Vitest command. Expected: PASS.

### Task 7: Final Verification

**Files:**

- Verify only

**Step 1: Run the full test suite**

Run: `cd frontend && bun test` Expected: either all green, or a precise list of
remaining pre-existing failures unrelated to the security streams.

**Step 2: Run the type check**

Run: `cd frontend && bun run check` Expected: either green, or the exact
remaining unrelated failures called out explicitly.

**Step 3: Run the production build**

Run: `cd frontend && bun run build` Expected: success, or exact build failures
reported with evidence.

**Step 4: Summarize residual risk**

Document which findings were fixed, which verification commands passed, and any
remaining non-security baseline failures that still exist in the branch.
