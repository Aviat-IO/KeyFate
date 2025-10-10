# Review Question Answers

## Q1: Should we add a migration to populate `isPrimary` for existing secrets that don't have it set?

**Answer:** Yes, let's do this.

**Action:** Create migration `0006_set_primary_recipients.sql`:
```sql
-- Set the first recipient of each secret as primary if none is set
UPDATE secret_recipients sr1
SET is_primary = true
WHERE id IN (
  SELECT DISTINCT ON (secret_id) id
  FROM secret_recipients sr2
  WHERE NOT EXISTS (
    SELECT 1 FROM secret_recipients sr3
    WHERE sr3.secret_id = sr2.secret_id
    AND sr3.is_primary = true
  )
  ORDER BY secret_id, created_at
);
```

This ensures every secret has exactly one primary recipient.

---

## Q2: Do we want to preserve any backward compatibility, or clean break acceptable?

**Answer:** Clean break is fine.

**Rationale:** 
- Database migration already happened (migrations 0004 & 0005)
- Old schema fields no longer exist in database
- Any code using old fields is already broken
- No production data with old schema to preserve

**Action:** Remove all legacy code without compatibility layers.

---

## Q3: Should recipient management UI be part of this change or separate follow-up?

**Answer:** Yes, let's implement the recipient management UI as part of this change.

**Scope:**
1. **View Recipients:** Display all recipients in secret view page
2. **Edit Recipients:** Allow adding/removing/editing recipients
3. **Set Primary:** Allow designating which recipient is primary
4. **Validation:** Ensure at least one recipient, validate email/phone

**New Components Needed:**
- `RecipientsList` - Display all recipients
- `RecipientEditor` - Form for editing recipients
- `RecipientCard` - Individual recipient display
- `AddRecipientButton` - Add new recipient

**New Pages/Routes:**
- Update `/secrets/[id]/edit` to include recipient management
- Add recipient section to `/secrets/[id]/view`

---

## Q4: Are there any other tables referencing the old recipient fields we haven't identified?

**Search Results:**

### Frontend Code Files (10 files):
✅ Already identified in proposal:
1. `src/app/(authenticated)/secrets/[id]/share-instructions/page.tsx`
2. `src/app/api/cron/process-reminders/route.ts`
3. `src/app/api/secrets/[id]/route.ts`
4. `src/app/profile/page.tsx`
5. `src/components/secret-card.tsx`
6. `src/hooks/useContactMethods.ts`
7. `src/lib/db/schema.ts`
8. `src/lib/db/secret-mapper.ts`
9. `src/lib/services/email-service.ts`
10. `src/lib/types/webhook-types.ts`

### Database Tables Analysis:

✅ **`secrets` table** - Old fields already dropped by migration 0004
- `recipient_name` - DROPPED
- `recipient_email` - DROPPED  
- `recipient_phone` - DROPPED
- `contact_method` - DROPPED

✅ **`secret_recipients` table** - NEW table, correctly structured
- Properly references `secrets.id`
- Has `email`, `phone`, `name`, `isPrimary` fields
- No issues found

✅ **`user_contact_methods` table** - SEPARATE PURPOSE
- This is for user's own contact preferences, NOT for secret recipients
- Fields: `user_id`, `email`, `phone`, `preferred_method`
- Uses `contact_method` enum (email/phone/both)
- **No changes needed** - this is a different feature

✅ **`email_notifications` table** - LOGGING ONLY
- Has `recipient_email` field for audit trail
- Should be enhanced to also store `recipient_id` for better tracking
- Current schema:
  ```typescript
  {
    id: uuid,
    recipientEmail: text, // Current: just email string
    secretId: uuid,
    subject: text,
    body: text,
    sentAt: timestamp,
    failedAt: timestamp,
    error: text,
    createdAt: timestamp
  }
  ```
- **Action:** Add optional `recipientId` foreign key

### Additional Migration Needed:

**Migration 0007: Add recipient tracking to email_notifications**

```sql
-- Add recipientId to email_notifications for better tracking
ALTER TABLE email_notifications 
ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES secret_recipients(id) ON DELETE SET NULL;

-- Make recipientEmail nullable since we now have recipientId
ALTER TABLE email_notifications 
ALTER COLUMN recipient_email DROP NOT NULL;

-- Create index for querying by recipient
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient_id 
ON email_notifications(recipient_id);
```

### Infrastructure/Scripts:
✅ `scripts/validate-infrastructure.js` - Only references `user_contact_methods` (correct)
✅ No other backend services reference old fields

### Summary:
**Total tables referencing recipient fields:** 4
1. ✅ `secrets` - Already migrated (fields dropped)
2. ✅ `secret_recipients` - New table, correct schema
3. ⚠️ `email_notifications` - Should add `recipientId` foreign key
4. ✅ `user_contact_methods` - Separate feature, no changes needed

**Conclusion:** 
- No hidden dependencies found
- Only enhancement needed: Add `recipientId` to `email_notifications`
- All other references are in the 10 files already identified
