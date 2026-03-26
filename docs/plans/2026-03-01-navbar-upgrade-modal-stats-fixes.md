# NavBar Auth, Upgrade Modal, and Stats Update Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Fix three bugs: NavBar not showing session on some pages, missing
upgrade gate on dashboard secret creation, and stale stats after pause/unpause.

**Architecture:** Three independent fixes touching NavBar (self-sufficient
session reading), dashboard (upgrade modal gate), and toggle-pause (casing fix +
checkin history insert).

**Tech Stack:** SvelteKit 5, Svelte 5 runes, Drizzle ORM, existing UpgradeModal
component

---

### Task 1: Make NavBar read session from $page.data internally

**Files:**

- Modify: `frontend/src/lib/components/NavBar.svelte`
- Modify: `frontend/src/routes/+page.svelte` (remove session
  pass-through)
- Modify: `frontend/src/routes/local-instructions/+page.svelte` (remove
  session pass-through)
- Modify: `frontend/src/routes/faq/+page.svelte` (remove session
  pass-through)
- Modify: `frontend/src/routes/decrypt/+page.svelte` (remove session
  pass-through)
- Modify: `frontend/src/routes/blog/+layout.svelte` (remove session
  pass-through)
- Modify: `frontend/src/routes/(authenticated)/+layout.svelte` (remove
  session pass-through)

**Step 1:** In NavBar.svelte, replace the session prop with internal
`$page.data.session` reading:

- Remove `let { session = null }: { session?: any } = $props();`
- Add `let session = $derived($page.data.session);` (the `page` import already
  exists)

**Step 2:** Remove `{session}` / `session={data.session}` from all 7 parent
files that pass it.

**Step 3:** Run `bun run build` and `bun test` to verify.

**Step 4:** Commit.

---

### Task 2: Gate secret creation on dashboard with upgrade modal

**Files:**

- Modify: `frontend/src/routes/(authenticated)/dashboard/+page.server.ts`
- Modify: `frontend/src/routes/(authenticated)/dashboard/+page.svelte`

**Step 1:** In `+page.server.ts`, add `getUserTierInfo` call and return
`canCreate`:

```typescript
import { getUserTierInfo } from "$lib/subscription";
// ... inside load:
const tierInfo = await getUserTierInfo(session.user.id);
const canCreate = tierInfo?.limits?.secrets?.canCreate ?? true;
return { session, secrets: secrets ?? [], canCreate };
```

**Step 2:** In `+page.svelte`, conditionally show UpgradeModal instead of
navigating:

- Import UpgradeModal
- Add `let showUpgradeModal = $state(false);`
- Add `let canCreate = $derived(data.canCreate);`
- For both "Create New Secret" buttons: if `canCreate`, keep
  `href="/secrets/new"`. If not, use `onclick` to open modal.
- Add UpgradeModal with feature="more secrets", currentLimit="1 secret",
  proLimit="Up to 10 secrets".

**Step 3:** Run `bun run build` and `bun test` to verify.

**Step 4:** Commit.

---

### Task 3: Fix stats not updating after pause/unpause

**Files:**

- Modify: `frontend/src/lib/components/TogglePauseButton.svelte`
- Modify: `frontend/src/lib/components/CheckInButton.svelte`
- Modify: `frontend/src/routes/api/secrets/[id]/toggle-pause/+server.ts`

**Step 1 (casing fix):** In TogglePauseButton.svelte, convert API response
before passing to callback:

```typescript
import { mapApiSecretToDrizzleShape } from "$lib/db/secret-mapper";
// In handleTogglePause, after parsing response:
onToggleSuccess(mapApiSecretToDrizzleShape(data.secret));
```

**Step 2 (casing fix):** In CheckInButton.svelte, apply same conversion:

```typescript
import { mapApiSecretToDrizzleShape } from "$lib/db/secret-mapper";
// In handleCheckIn:
onCheckInSuccess?.(mapApiSecretToDrizzleShape(res.secret));
```

**Step 3 (checkin history):** In toggle-pause/+server.ts, insert checkinHistory
when unpausing:

```typescript
import { checkinHistory } from "$lib/db/schema";
import { getDatabase } from "$lib/db/drizzle";
// After secretsService.update succeeds, if newStatus === 'active':
const database = await getDatabase();
await database.insert(checkinHistory).values({
  secretId: id,
  userId: session.user.id,
  checkedInAt: updatePayload.lastCheckIn,
  nextCheckIn: updatePayload.nextCheckIn,
});
```

**Step 4:** Run `bun run build` and `bun test` to verify.

**Step 5:** Commit.
