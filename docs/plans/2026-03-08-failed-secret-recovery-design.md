# Failed Secret Recovery Actions

## Problem

When a secret reaches `failed` status (disclosure emails failed after 5
retries), there is no way to recover it. The user can only delete it. If the
failure was transient (e.g., SendGrid connection timeout), the secret should be
recoverable.

## Guard Condition

A failed secret is **recoverable** only when it has zero `disclosure_log`
entries with `status = 'sent'` for that secret. If any disclosure was
successfully sent, the content is already out and the secret cannot be
restarted.

## Actions

### Check In

Resets the dead man's switch timer as if the user just checked in.

- Sets `status` back to `active`
- Clears `retryCount`, `lastRetryAt`, `lastError`
- Sets `nextCheckIn = now + checkInDays`
- Schedules new reminder jobs
- Uses existing check-in API endpoint (UI currently hides the button for failed
  secrets; remove that guard)

### Send Now

Immediately triggers disclosure to all recipients, bypassing the cron cycle.

- New endpoint: `POST /api/secrets/[id]/send-now`
- Validates: secret is `failed`, user owns it, no sent disclosures exist
- Runs the same decryption + email disclosure logic as `processOverdueSecret`
- On success: secret transitions to `triggered`
- On failure: returns error, secret stays `failed` with updated `lastError`
- Requires confirmation dialog in the UI (destructive, irreversible)

## UI Changes (Secret View Page)

### Recoverable failed secrets (no sent disclosures)

Show two buttons:

- **Check In** (primary) — standard check-in behavior
- **Send Now** (destructive) — with confirmation dialog: "This will immediately
  send your secret to all recipients. This cannot be undone."

### Non-recoverable failed secrets (disclosures already sent)

Show muted text: "This secret has already been disclosed to recipients."

## Data Flow

### Check In

```
UI -> POST /api/secrets/[id]/check-in
   -> Validate: owner, CSRF
   -> Update secret: status=active, reset retry fields, set nextCheckIn
   -> Insert checkin_history row
   -> Schedule reminders
   -> Return success
```

### Send Now

```
UI -> Confirmation dialog -> POST /api/secrets/[id]/send-now
   -> Validate: owner, CSRF, status=failed, no sent disclosures
   -> Set status=triggered, processingStartedAt=now
   -> Decrypt server share
   -> Send disclosure emails to all recipients
   -> Update disclosure_log entries
   -> On success: keep triggered, set triggeredAt
   -> On failure: revert to failed, update lastError
   -> Return result
```

## Server-Side Changes

1. **Check-in endpoint** — add explicit handling for `failed` status (currently
   works but UI prevents it)
2. **New send-now endpoint** — extract disclosure logic from
   `processOverdueSecret` into a reusable function
3. **View page server** — add `hasBeenDisclosed` boolean to page data (query
   `disclosure_log` for sent entries)

## Files to Modify

- `src/routes/(authenticated)/secrets/[id]/view/+page.svelte` — add recovery
  action buttons
- `src/routes/(authenticated)/secrets/[id]/view/+page.server.ts` — add
  `hasBeenDisclosed` to page data
- `src/routes/api/secrets/[id]/check-in/+server.ts` — allow `failed` status
- `src/routes/api/secrets/[id]/send-now/+server.ts` — new endpoint
- `src/lib/cron/process-reminders.ts` — extract disclosure logic into reusable
  function
