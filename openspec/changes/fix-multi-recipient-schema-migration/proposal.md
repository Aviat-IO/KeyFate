# Proposal: Fix Multi-Recipient Schema Migration

**Change ID:** `fix-multi-recipient-schema-migration`  
**Status:** Draft  
**Created:** 2025-10-10  
**Author:** AI Assistant

## Problem Statement

The multi-recipient feature was partially implemented in commits `4f245a3` and `5314ad7`, which:
1. Created the `secret_recipients` table with 1-to-many relationship
2. Removed single recipient columns from `secrets` table (`recipient_name`, `recipient_email`, `recipient_phone`, `contact_method`)
3. Updated the new secret creation form to use the new schema

However, **many existing files still reference the old single-recipient schema**, causing TypeScript compilation errors and preventing production builds:

```
Type error: Property 'contactMethod' does not exist on type Secret
Type error: Property 'recipientEmail' does not exist on type Secret
Type error: Property 'recipientName' does not exist on type Secret
```

This blocks deployment to staging/production and breaks the following functionality:
- Secret view pages
- Secret card display components
- Cron job reminder processing
- API endpoints that update secrets
- Email service integrations

## Impact Analysis

### Files Requiring Updates

**Critical (Blocking Build):**
1. `src/app/api/cron/process-reminders/route.ts` - Cannot send reminders without recipient data
2. `src/app/(authenticated)/secrets/[id]/view/page.tsx` - Cannot view secret details
3. `src/app/api/secrets/[id]/route.ts` - Cannot update existing secrets
4. `src/components/secret-card.tsx` - Dashboard displays broken
5. `src/lib/db/secret-mapper.ts` - Type conversions fail

**High Priority (Data Access Issues):**
6. `src/app/(authenticated)/secrets/[id]/share-instructions/page.tsx` - Cannot share secrets
7. `src/lib/services/email-service.ts` - Email logging references old schema
8. `src/lib/types/webhook-types.ts` - Webhook payloads incorrect

**Medium Priority (Feature Degradation):**
9. `src/app/profile/page.tsx` - User contact methods (separate from recipients)
10. `src/hooks/useContactMethods.ts` - Contact method management

### Database Schema Analysis

**Current Schema (Post-Migration):**

```typescript
// secrets table - NO LONGER HAS RECIPIENT FIELDS
export const secrets = pgTable("secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  checkInDays: integer("check_in_days").notNull(),
  status: secretStatusEnum("status").notNull(),
  serverShare: text("server_share"),
  iv: text("iv"),
  authTag: text("auth_tag"),
  sssSharesTotal: integer("sss_shares_total").notNull(),
  sssThreshold: integer("sss_threshold").notNull(),
  isTriggered: boolean("is_triggered").default(false),
  lastCheckIn: timestamp("last_check_in"),
  nextCheckIn: timestamp("next_check_in"),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// NEW: secret_recipients table
export const secretRecipients = pgTable("secret_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  secretId: uuid("secret_id").notNull().references(() => secrets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"), // nullable (can use phone instead)
  phone: text("phone"), // nullable (can use email instead)
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Type Definitions Needed:**

```typescript
// Drizzle inferred types
type Secret = typeof secrets.$inferSelect;
type SecretInsert = typeof secrets.$inferInsert;
type SecretRecipient = typeof secretRecipients.$inferSelect;
type SecretRecipientInsert = typeof secretRecipients.$inferInsert;

// Composite type for secrets with recipients
interface SecretWithRecipients extends Secret {
  recipients: SecretRecipient[];
}

// Helper to get primary recipient
interface PrimaryRecipient {
  name: string;
  email: string | null;
  phone: string | null;
}
```

## Proposed Solution

### Phase 1: Type System Updates
1. Create proper TypeScript types for multi-recipient schema
2. Update database query functions to join `secret_recipients`
3. Remove legacy type references (`contactMethod`, old recipient fields)

### Phase 2: Database Operations
1. Create helper functions to query secrets with recipients
2. Update `getSecret()` to always include recipients
3. Update `updateSecret()` to handle recipient updates
4. Create `getPrimaryRecipient()` helper function

### Phase 3: UI Component Updates
1. Update `SecretCard` to display first/primary recipient
2. Update view pages to show all recipients in a list
3. Update share instructions page for multi-recipient sharing
4. Add recipient management UI for editing

### Phase 4: API & Cron Updates
1. Update reminder processing to iterate over all recipients
2. Update secret update API to handle recipient changes
3. Update email service to accept recipient objects
4. Update webhook types for multi-recipient payloads

### Phase 5: Cleanup
1. Remove dead code referencing old schema
2. Update tests to use new schema
3. Remove `contactMethod` enum (no longer used)
4. Update documentation

## Design Decisions

### 1. Query Strategy
**Decision:** Always fetch recipients with secrets using LEFT JOIN
**Rationale:** Prevents N+1 queries, simplifies type system, ensures data consistency

### 2. Primary Recipient Handling
**Decision:** Use `isPrimary` flag to designate one recipient as primary
**Rationale:** Backward compatibility for features expecting single recipient, clear UX

### 3. Contact Method Deprecation
**Decision:** Remove `contactMethod` enum entirely, infer from recipient data
**Rationale:** 
- Each recipient now has optional email/phone fields
- No need for enum when data structure determines contact method
- Simplifies validation (just check if email or phone is present)

### 4. Email Service Updates
**Decision:** Pass full `SecretRecipient` objects instead of strings
**Rationale:** Type-safe, allows future expansion (e.g., recipient preferences)

### 5. Backward Compatibility
**Decision:** No backward compatibility needed - clean break
**Rationale:** 
- Migration already happened
- Old data already migrated (via migrations 0004 & 0005)
- No production data with old schema

## Type Safety Improvements

### Current Problems
```typescript
// ❌ Using 'any' - no type safety
const session = (await getServerSession(authConfig as any)) as Session | null

// ❌ Non-existent properties
secret.recipientEmail // Property doesn't exist
secret.contactMethod // Property doesn't exist
```

### Proposed Solution
```typescript
// ✅ Proper typing with Drizzle inference
import type { Session } from "next-auth";
import { type GetServerSessionOptions } from "next-auth";

const session = await getServerSession(authConfig as GetServerSessionOptions);

// ✅ Use inferred types from schema
type Secret = typeof secrets.$inferSelect;
type SecretRecipient = typeof secretRecipients.$inferSelect;

// ✅ Join query with proper types
const secretWithRecipients = await db
  .select({
    ...secrets,
    recipients: sql<SecretRecipient[]>`
      COALESCE(
        json_agg(secret_recipients.*) FILTER (WHERE secret_recipients.id IS NOT NULL),
        '[]'
      )
    `
  })
  .from(secrets)
  .leftJoin(secretRecipients, eq(secretRecipients.secretId, secrets.id))
  .where(eq(secrets.id, secretId))
  .groupBy(secrets.id);
```

## Success Criteria

1. ✅ Production build completes without TypeScript errors
2. ✅ All secrets display with correct recipient information
3. ✅ Cron job can process reminders for all recipients
4. ✅ Secret cards show primary recipient name/contact
5. ✅ View page displays all recipients in a list
6. ✅ Share instructions page works for multi-recipient secrets
7. ✅ No usage of TypeScript `any` keyword
8. ✅ All Drizzle types properly inferred from schema
9. ✅ Email service accepts typed recipient objects
10. ✅ Tests pass with new schema

## Migration Strategy

**No data migration needed** - database migration already completed in:
- Migration `0004_chunky_trauma.sql` - Created `secret_recipients` table, removed old columns
- Migration `0005_big_adam_warlock.sql` - Made email nullable, added phone field

**Only code updates required** - This is a pure TypeScript refactoring to align code with current database schema.

## Risk Assessment

**Low Risk:**
- No database changes required
- All new secrets already use new schema
- Clear type errors guide exactly what needs fixing
- Can test locally before deploying

**Mitigation:**
- Incremental approach (fix critical files first)
- Type system catches all issues at compile time
- Comprehensive test coverage for each updated file

## Estimated Effort

- **Phase 1 (Types):** 30 minutes
- **Phase 2 (DB Ops):** 45 minutes  
- **Phase 3 (UI):** 1 hour
- **Phase 4 (API/Cron):** 1 hour
- **Phase 5 (Cleanup):** 30 minutes

**Total:** ~3.5 hours

## Dependencies

- Existing database migration must be applied (already done)
- No external dependencies
- No breaking API changes (internal refactoring only)

## Questions for Review

1. Should we add a migration to populate `isPrimary` for existing secrets that don't have it set?
2. Do we want to preserve any backward compatibility, or clean break acceptable?
3. Should recipient management UI be part of this change or separate follow-up?
4. Are there any other tables referencing the old recipient fields we haven't identified?
