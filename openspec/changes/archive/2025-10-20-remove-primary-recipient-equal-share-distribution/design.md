# Design Document: Equal Share Distribution for Multi-Recipient Secrets

## Context

KeyFate uses Shamir's Secret Sharing (SSS) to split secrets into shares, ensuring that the server alone cannot reconstruct user secrets. The current implementation has three issues:

1. **Primary recipient designation** creates artificial hierarchy among recipients
2. **Share distribution model** is unclear for multiple recipients
3. **SSS configuration guidance** doesn't account for multi-recipient scenarios

This design addresses all three by:
- Treating all recipients equally
- Clarifying that all recipients receive the SAME share
- Providing clear guidance for threshold configuration

## Goals

1. **Eliminate recipient hierarchy** - No "primary" designation
2. **Clarify share distribution** - All recipients get identical share (share #1)
3. **Maintain zero-knowledge** - Server retains only share #0 (insufficient alone)
4. **Prevent premature reconstruction** - Recipients can't collaborate to bypass KeyFate
5. **Simplify UX** - Clear guidance for threshold selection with multiple recipients
6. **Preserve security** - Threshold requirements still enforced

## Non-Goals

- Variable share distribution (giving different shares to different recipients)
- Weighted threshold (some recipients count more than others)
- Automatic threshold recommendations based on AI/heuristics
- Support for >5 recipients (Pro tier limit remains)

## Decisions

### Decision 1: All Recipients Receive Same Share

**Choice:** All recipients receive share #1 (the first user-managed share)

**Alternatives Considered:**
1. **Different shares per recipient** - Would allow recipients to collaborate and reconstruct secret before trigger, bypassing KeyFate entirely
2. **Random share assignment** - Adds complexity without security benefit
3. **User-selectable share distribution** - Confusing UX, most users wouldn't understand implications

**Rationale:** 
- Prevents recipient collaboration from bypassing the dead man's switch
- Simplifies mental model: "All recipients are equal"
- Maintains KeyFate's security guarantee: server + any N recipients (threshold-1) needed
- Aligns with use case: recipients are equally trusted, not competing parties

**Trade-offs:**
- ✅ Simpler to explain and understand
- ✅ Prevents collusion attacks
- ❌ Slightly less flexible than variable distribution
- ✅ Reduces implementation complexity

### Decision 2: Remove Primary Recipient Concept Entirely

**Choice:** Delete `is_primary` column and all associated logic

**Alternatives Considered:**
1. **Keep for internal use** - Use as default contact but hide from UI
2. **Rename to default_contact** - Less hierarchical terminology
3. **Replace with display_order** - Numeric ordering for UI display

**Rationale:**
- Primary designation was holdover from single-recipient design
- All recipients should be treated equally in code and UI
- Ordering can be handled by `createdAt` timestamp (first added = first displayed)
- Simplifies validation and reduces cognitive load

**Trade-offs:**
- ✅ Cleaner data model
- ✅ Clearer user intent
- ❌ Requires migration and code updates
- ✅ Eliminates "who should be primary?" confusion

**Migration Impact:**
```sql
-- Simple column drop, no data transformation needed
ALTER TABLE secret_recipients DROP COLUMN is_primary;
```

### Decision 3: Limit SSS Total Shares to 5

**Choice:** Reduce `sss_shares_total` max from 10 to 5

**Rationale:**
- Aligns with Pro tier limit of 5 recipients per secret
- Current max of 10 shares would mean user manages up to 9 shares (10 - 1 server share)
- With equal distribution model, having more shares than recipients is unnecessary
- Simplifies UX by removing edge cases

**Formula:**
```
total_shares = 1 (server) + 1 (recipients) + X (optional redundancy)
Max total_shares = 5 allows up to 4 shares of redundancy
```

**Examples:**
- 1 recipient: 3 total shares (1 server, 1 recipient, 1 backup) ✅
- 3 recipients: 4 total shares (1 server, 1 to all 3 recipients, 2 backup) ✅  
- 5 recipients: 5 total shares (1 server, 1 to all 5 recipients, 3 backup) ✅

**Trade-offs:**
- ✅ Simpler validation
- ✅ Aligns with recipient limits
- ❌ Reduces flexibility for advanced users (rare use case)
- ✅ Reduces confusion about share management

### Decision 4: Auto-Expand SSS Accordion for Multiple Recipients

**Choice:** When `recipients.length > 1`, automatically expand the "Secret Sharing Configuration" accordion

**Rationale:**
- Users adding multiple recipients should understand threshold implications
- Accordion starts collapsed (good for single recipient default)
- Multiple recipients is advanced use case warranting advanced options
- Prevents users from unknowingly creating insecure configurations

**Implementation:**
```tsx
const shouldExpandAccordion = watch("recipients").length > 1;

<Accordion 
  type="single" 
  collapsible 
  defaultValue={shouldExpandAccordion ? "sss-config" : undefined}
>
```

**Trade-offs:**
- ✅ Educates users about threshold choices
- ✅ Prevents accidental misconfigurations
- ❌ Slightly more verbose UI for multi-recipient secrets
- ✅ Minimal code change

### Decision 5: Provide Examples, Not Prescriptive Recommendations

**Choice:** Show illustrative examples of SSS configurations, allow user to choose

**Alternatives Considered:**
1. **Enforce minimum threshold** - e.g., `threshold >= ceil(recipients / 2) + 1`
2. **AI-powered recommendations** - Suggest based on user's secret type
3. **Wizard interface** - Step-by-step threshold selection

**Rationale:**
- Users have different risk tolerances and use cases
- Some users want maximum security (high threshold), others want availability (low threshold)
- Examples educate without constraining
- Keeps UI simple and respectful of user expertise

**Example Text:**
```
With 3 recipients, consider:
• Threshold 2: Server + any 1 recipient can reconstruct (convenient)
• Threshold 3: Server + any 2 recipients needed (balanced)  
• Threshold 4: All shares required (maximum security)
```

**Trade-offs:**
- ✅ Respects user autonomy
- ✅ Educational without prescriptive
- ❌ Users might still choose poorly
- ✅ Keeps complexity low

### Decision 6: User Distributes Shares, Not KeyFate

**Choice:** User is responsible for distributing share #1 to each recipient separately

**Rationale:**
- **Zero-knowledge principle:** Shares must never touch KeyFate servers after initial creation
- Share #0 is encrypted and stored server-side (insufficient alone to reconstruct)
- Share #1+ must remain with user to maintain security guarantee
- When secret triggers, cron sends NOTIFICATION to recipients, not the share itself

**User Experience:**
- Share instructions page displays prominent warning about user responsibility
- Critical messaging: "You MUST send this share to each recipient via your own secure channel"
- Suggested methods: encrypted email, Signal, password manager sharing, in-person
- Emphasize: If user fails to distribute, recipients cannot recover secret even after trigger

**Cron Job Behavior After Trigger:**
- Sends email disclosure to each recipient automatically
- Email contains: share #0 (server share), secret title, reconstruction instructions
- Email does NOT contain share #1 (user must have distributed this beforehand)
- Recipient combines share #0 (from KeyFate email) + share #1 (received from user earlier) = reconstructed secret
- No additional verification or contact needed - fully automated disclosure

**Trade-offs:**
- ✅ Maintains zero-knowledge architecture
- ✅ No share data ever touches KeyFate servers post-creation
- ❌ Relies on user to distribute correctly
- ✅ User has full control over distribution method and timing
- ❌ If user forgets to distribute, system cannot help recipients recover

## Architecture

### Share Distribution Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client-Side Secret Splitting                        │
│                                                         │
│  User enters secret → SSS.split() → N shares          │
│    Share 0: Sent to server (AES-256 encrypted)        │
│    Share 1: Stored in localStorage (2hr expiry)       │
│    Share 2-N: Stored in localStorage (2hr expiry)     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Server Storage                                       │
│                                                         │
│  secrets table:                                        │
│    - server_share (encrypted share #0)                 │
│    - recipient_share_index = 1                         │
│    - sss_shares_total                                  │
│    - sss_threshold                                     │
│                                                         │
│  secret_recipients table:                              │
│    - name, email, phone                                │
│    - NO isPrimary field                                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. User Share Management                                │
│                                                         │
│  /share-instructions page shows:                       │
│    "Share 1 (for all recipients): [hex string]"       │
│    "Share 2 (backup): [hex string]"                    │
│    "Share 3 (backup): [hex string]"                    │
│                                                         │
│  User saves shares offline (paper, password manager)   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Trigger Event (Cron Job)                            │
│                                                         │
│  check-secrets cron runs every hour:                   │
│    - Finds secrets with nextCheckIn < now              │
│    - For each recipient:                               │
│        - Sends email with share #0 (server share)      │
│        - Includes reconstruction instructions          │
│        - Reminds recipient about share #1 from user    │
│                                                         │
│  ⚠️  Share #1 was distributed by USER previously       │
│     (never touched KeyFate servers)                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Secret Reconstruction                                │
│                                                         │
│  Recipient receives email with share #0                │
│    → Already has share #1 (received from user earlier) │
│    → Recipient combines:                               │
│         Share #0 (from KeyFate email) +                │
│         Share #1 (received from user earlier) +        │
│         [optional backup shares if threshold > 2]      │
│    → SSS.combine() reconstructs secret                 │
│                                                         │
│  Recipient collaboration CANNOT bypass KeyFate:        │
│    - All recipients have same share #1 (from user)     │
│    - Need server share #0 (only released after trigger)│
│    - Server share only released after trigger event    │
│    - Fully automated - no manual verification needed   │
└─────────────────────────────────────────────────────────┘
```

### Database Schema Changes

**Before:**
```typescript
export const secretRecipients = pgTable("secret_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  secretId: uuid("secret_id").notNull().references(() => secrets.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").default(false).notNull(), // ❌ Remove
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**After:**
```typescript
export const secretRecipients = pgTable("secret_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  secretId: uuid("secret_id").notNull().references(() => secrets.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Optional: Add to secrets table for future flexibility
export const secrets = pgTable("secrets", {
  // ... existing fields
  recipientShareIndex: integer("recipient_share_index").default(1), // ✅ Add
});
```

### TypeScript Type Changes

**Before:**
```typescript
type SecretRecipient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean; // ❌ Remove
};

interface SecretWithPrimaryRecipient extends Secret {
  recipients: SecretRecipient[];
  primaryRecipient?: SecretRecipient; // ❌ Remove
}

function getPrimaryRecipient(recipients: SecretRecipient[]): SecretRecipient | undefined {
  return recipients.find(r => r.isPrimary) || recipients[0]; // ❌ Remove
}
```

**After:**
```typescript
type SecretRecipient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
};

interface SecretWithRecipients extends Secret {
  recipients: SecretRecipient[]; // Ordered by createdAt ASC
}

// Ordering handled by database query, not application logic
```

### Query Changes

**Before:**
```typescript
const secretWithRecipients = await db
  .select()
  .from(secrets)
  .leftJoin(secretRecipients, eq(secretRecipients.secretId, secrets.id))
  .where(eq(secrets.id, secretId))
  .orderBy(desc(secretRecipients.isPrimary), asc(secretRecipients.createdAt)); // ❌
```

**After:**
```typescript
const secretWithRecipients = await db
  .select()
  .from(secrets)
  .leftJoin(secretRecipients, eq(secretRecipients.secretId, secrets.id))
  .where(eq(secrets.id, secretId))
  .orderBy(asc(secretRecipients.createdAt)); // ✅ Simple chronological order
```

## Security Analysis

### Threat Model

**Threat 1: Server compromise**
- **Before:** Server has 1 encrypted share, attacker needs encryption key + threshold-1 shares
- **After:** UNCHANGED - Server still has only 1 share
- **Mitigation:** AES-256-GCM encryption, secure key management

**Threat 2: Recipient collusion (before trigger)**
- **Before (different shares):** If recipients get different shares, they could collaborate to reconstruct secret without waiting for trigger
- **After (same share):** Recipients cannot reconstruct secret even if they collaborate - all have identical share
- **Mitigation:** Equal share distribution prevents this attack vector entirely

**Threat 3: Single recipient compromise**
- **Before:** Primary recipient compromise has same impact as any recipient
- **After:** UNCHANGED - Any single recipient has 1 share (insufficient to reconstruct)
- **Mitigation:** Threshold enforcement (minimum 2)

**Threat 4: User loses their backup shares**
- **Before:** User manages shares 1-N, server has share 0
- **After:** UNCHANGED - Same share management model
- **Mitigation:** Clear instructions to store shares offline, multiple backup locations

### Security Improvements

1. **Eliminated collusion risk:** Recipients can't bypass KeyFate by pooling shares
2. **Simplified audit surface:** No complex primary recipient logic to audit
3. **Clearer threat model:** Easy to explain to security auditors

### Security Regressions

None identified. The equal share distribution model maintains all existing security properties while adding collusion resistance.

## UX Flow Changes

### New Secret Creation (Multi-Recipient)

**Step 1: Add Recipients**
```
┌───────────────────────────────────┐
│ Recipients                        │
├───────────────────────────────────┤
│ ┌─────────────────────────────┐   │
│ │ Recipient 1                 │   │
│ │ Name: Alice                 │   │
│ │ Email: alice@example.com    │   │
│ └─────────────────────────────┘   │
│                                   │
│ ┌─────────────────────────────┐   │
│ │ Recipient 2                 │   │
│ │ Name: Bob                   │   │
│ │ Email: bob@example.com      │   │
│ └─────────────────────────────┘   │
│                                   │
│ [+ Add Recipient (2/5)]           │
└───────────────────────────────────┘
```

**Step 2: SSS Configuration (Auto-Expanded)**
```
┌───────────────────────────────────────────────────┐
│ ℹ️  Advanced Settings                             │
│                                                   │
│ ▼ Secret Sharing Configuration                   │
│                                                   │
│   ⚠️  With multiple recipients, all will receive  │
│      the same cryptographic share when the        │
│      secret triggers.                             │
│                                                   │
│   Total Shares: [3] (min: 2, max: 5)             │
│   Threshold:    [2] (min: 2, max: 3)             │
│                                                   │
│   Configuration examples:                         │
│   • 3 shares, threshold 2: Any 1 recipient +      │
│     server share can reconstruct (convenient)     │
│   • 3 shares, threshold 3: All shares required    │
│     for maximum security                          │
│                                                   │
│   Your setup: Server share + 1 recipient share +  │
│   1 backup share. Threshold 2 means server + any  │
│   1 other share reconstructs the secret.          │
└───────────────────────────────────────────────────┘
```

**Step 3: Share Instructions**
```
┌────────────────────────────────────────────────────────┐
│ Manage Your Secret Shares                              │
├────────────────────────────────────────────────────────┤
│ 🚨 CRITICAL: YOU must distribute Share 1 to each       │
│    recipient via your own secure channel. This share   │
│    never touches KeyFate servers after creation.       │
│                                                        │
│ When your secret triggers, KeyFate will automatically  │
│ send Share 0 (server share) to all recipients.         │
│ They will need BOTH shares to reconstruct the secret.  │
│                                                        │
│ Share 1 (for ALL recipients: Alice, Bob, Carol):      │
│ ┌──────────────────────────────────────────────┐      │
│ │ 8f3a2c9e7b1d4f6a...                          │      │
│ │ [Copy] [Download]                            │      │
│ └──────────────────────────────────────────────┘      │
│                                                        │
│ ⚠️  Send this share SEPARATELY to:                    │
│    • Alice (alice@example.com) - via encrypted email  │
│    • Bob (bob@example.com) - via Signal               │
│    • Carol (carol@example.com) - via password manager │
│                                                        │
│ Share 2 (backup - store securely offline):            │
│ ┌──────────────────────────────────────────────┐      │
│ │ 2b7e4f1a9c3d5e8...                           │      │
│ │ [Copy] [Download]                            │      │
│ └──────────────────────────────────────────────┘      │
│                                                        │
│ [✓] I have distributed Share 1 to all recipients       │
│ [✓] I have stored backup shares securely               │
│ [Continue to Dashboard]                                │
└────────────────────────────────────────────────────────┘
```

## Migration Plan

### Phase 1: Preparation (Pre-Migration)
1. Complete `fix-multi-recipient-schema-migration` change
2. Ensure all code uses `recipients` array queries
3. Create database backup
4. Test migration on local/staging environments

### Phase 2: Database Migration
```sql
-- Migration: 0009_remove_primary_recipient.sql

-- 1. Drop is_primary column
ALTER TABLE secret_recipients DROP COLUMN IF EXISTS is_primary;

-- 2. (Optional) Add recipient_share_index to secrets table
ALTER TABLE secrets ADD COLUMN recipient_share_index INTEGER DEFAULT 1;

-- 3. Remove partial indexes using is_primary
DROP INDEX IF EXISTS idx_secret_recipients_primary;

-- No data migration needed - just structural changes
```

### Phase 3: Code Deployment
1. Deploy updated code with `isPrimary` references removed
2. Verify TypeScript compilation succeeds
3. Monitor error logs for 24 hours
4. Verify existing secrets display correctly

### Phase 4: Validation
1. Create test secret with 3 recipients
2. Verify SSS accordion auto-expands
3. Verify share instructions show equal distribution message
4. Verify all recipients display equally (no "Primary" badge)
5. Load test: Dashboard with 100+ multi-recipient secrets

## Rollback Plan

**If migration fails:**
```sql
-- Rollback: Restore is_primary column
ALTER TABLE secret_recipients ADD COLUMN is_primary BOOLEAN DEFAULT false NOT NULL;

-- Set first recipient of each secret as primary
UPDATE secret_recipients sr1
SET is_primary = true
WHERE id = (
  SELECT id FROM secret_recipients sr2
  WHERE sr2.secret_id = sr1.secret_id
  ORDER BY created_at ASC
  LIMIT 1
);
```

**Code rollback:** Revert to previous commit before `isPrimary` removal

## Performance Considerations

### Query Performance Impact

**Before:**
```sql
SELECT * FROM secret_recipients
WHERE secret_id = ? 
ORDER BY is_primary DESC, created_at ASC;
```
- Uses composite index on `(secret_id, is_primary, created_at)`

**After:**
```sql
SELECT * FROM secret_recipients
WHERE secret_id = ?
ORDER BY created_at ASC;
```
- Uses simpler index on `(secret_id, created_at)`
- **Performance:** NEUTRAL or SLIGHT IMPROVEMENT (simpler index, less sorting)

### Storage Impact

- Removes 1 boolean column (1 byte per recipient row)
- Adds optional 1 integer column (4 bytes per secret row)
- **Net impact:** Minimal (< 1KB for 1000 secrets with 5 recipients each)

## Open Questions

### Q1: Should we add `recipient_share_index` now or defer?

**Options:**
- **Add now:** Future-proofs for variable share distribution
- **Defer:** YAGNI principle - add when actually needed

**Recommendation:** Add now as optional field (defaults to 1), minimal cost

### Q2: Should share instructions show per-recipient or single share?

**Options:**
- **Single:** "Share 1 (for all recipients): [hex]"
- **Per-recipient:** "Share for Alice: [hex], Share for Bob: [hex]" (same hex)

**Recommendation:** Single share display to emphasize equal distribution

### Q3: Enforce minimum threshold?

**Options:**
- **Yes:** Prevent `threshold < 2` to ensure server + at least 1 recipient needed
- **No:** Allow `threshold = 2` for any number of recipients

**Recommendation:** Keep current validation (`threshold >= 2`), add guidance only
