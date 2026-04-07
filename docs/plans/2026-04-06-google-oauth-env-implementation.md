# Google OAuth Env Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Make Google OAuth work in Railway staging and production using the
existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` variables.

**Architecture:** Explicitly pass the Google client ID and secret into the
Auth.js Google provider config instead of relying on Auth.js env auto-detection.
Add a focused regression test around the auth config and verify the live
providers endpoint after deployment.

**Tech Stack:** SvelteKit, Auth.js, Bun, Vitest, Railway

---

### Task 1: Wire Google OAuth env vars explicitly

**Files:**

- Modify: `frontend/src/auth.ts`
- Test: `frontend/src/lib/auth/__tests__/auth-config.test.ts`

**Step 1: Write the failing test**

Create a test that imports `src/auth.ts` with `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` set and asserts that the mocked Google provider receives
those values.

**Step 2: Run test to verify it fails**

Run: `cd frontend && bun test src/lib/auth/__tests__/auth-config.test.ts`

Expected: FAIL because `Google(...)` is not yet receiving `clientId` and
`clientSecret` from `GOOGLE_CLIENT_*`.

**Step 3: Write minimal implementation**

Pass `process.env.GOOGLE_CLIENT_ID` and `process.env.GOOGLE_CLIENT_SECRET` into
`Google(...)` in `src/auth.ts`.

**Step 4: Run test to verify it passes**

Run: `cd frontend && bun test src/lib/auth/__tests__/auth-config.test.ts`

Expected: PASS

### Task 2: Verify runtime behavior

**Files:**

- Modify: none

**Step 1: Verify providers endpoint locally or after deploy**

Check: `/api/auth/providers`

Expected: `google: true`

**Step 2: Deploy and verify both environments**

Run Railway deployment commands and confirm:

- `https://staging.keyfate.com/api/auth/providers`
- `https://keyfate.com/api/auth/providers`

Expected: both return `google: true`
