# Failed Secret Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Allow users to check in or immediately disclose failed secrets that
haven't been sent to recipients yet.

**Architecture:** Add `hasBeenDisclosed` flag to page data, a new `send-now` API
endpoint, and update the check-in endpoint to handle failed status. Modify the
view page to show recovery actions for recoverable failed secrets.

**Tech Stack:** SvelteKit 5, Drizzle ORM, existing email service

---

### Task 1: Add `hasBeenDisclosed` to page server data

**Files:**

- Modify: `src/routes/(authenticated)/secrets/[id]/view/+page.server.ts`

Query `disclosure_log` for any rows with `status = 'sent'` for this secret. Add
`hasBeenDisclosed: boolean` to the returned page data.

### Task 2: Update check-in API to handle failed secrets

**Files:**

- Modify: `src/routes/api/secrets/[id]/check-in/+server.ts`

When a failed secret is checked in, reset `status` to `active`, clear
`retryCount`, `lastRetryAt`, `lastError`, and set `nextCheckIn`. The current
endpoint already does check-in logic but doesn't reset failure fields.

### Task 3: Create send-now API endpoint

**Files:**

- Create: `src/routes/api/secrets/[id]/send-now/+server.ts`

New endpoint that validates the secret is `failed` with no sent disclosures,
then runs the disclosure flow inline (decrypt, send emails, update status).

### Task 4: Update view page UI with recovery actions

**Files:**

- Modify: `src/routes/(authenticated)/secrets/[id]/view/+page.svelte`

For failed secrets: show Check In and Send Now buttons when `!hasBeenDisclosed`.
Show "already disclosed" message when `hasBeenDisclosed`. Add `handleSendNow`
function with confirmation dialog.

### Task 5: Build, test, and commit

Run `bun run build` and `bun test` to verify everything works.
