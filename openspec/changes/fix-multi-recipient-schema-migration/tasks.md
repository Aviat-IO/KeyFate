# Implementation Tasks: Fix Multi-Recipient Schema Migration

**Change ID:** `fix-multi-recipient-schema-migration`

## Phase 0: Additional Migrations (Priority: Critical)

### Task 0.1: Create Migration for Primary Recipients
- [ ] Create `drizzle/0006_set_primary_recipients.sql`
  - [ ] Update all secrets without primary recipient to set first recipient as primary
  - [ ] Use DISTINCT ON to get first recipient per secret
  - [ ] Ensure every secret has exactly one primary recipient

### Task 0.2: Create Migration for Email Notifications Enhancement
- [ ] Create `drizzle/0007_add_recipient_to_email_notifications.sql`
  - [ ] Add `recipient_id` column as optional foreign key to `secret_recipients`
  - [ ] Make `recipient_email` nullable (can use recipientId instead)
  - [ ] Create index on `recipient_id` for performance
  - [ ] Add ON DELETE SET NULL to preserve logs if recipient deleted

### Task 0.3: Update Schema TypeScript
- [ ] Update `src/lib/db/schema.ts`
  - [ ] Add `recipientId` field to `emailNotifications` table definition
  - [ ] Make `recipientEmail` nullable in type
  - [ ] Regenerate types with `pnpm db:generate`

### Task 0.4: Create Database Indexes Migration
- [ ] Create `drizzle/0008_add_critical_indexes.sql`
  - [ ] Add `idx_secrets_user_id` for dashboard queries
  - [ ] Add `idx_secret_recipients_secret_id` for joins
  - [ ] Add `idx_reminder_jobs_scheduled` for cron performance
  - [ ] Add `idx_checkin_history_secret_date` for history
  - [ ] Add `idx_secrets_user_status` composite index
  - [ ] Add `idx_email_notifications_secret_id` for audit
  - [ ] Add `idx_webhook_events_status` for processing
  - [ ] Add `idx_payment_history_user_id` for history

### Task 0.5: Create Data Integrity Constraints
- [ ] Create `drizzle/0009_add_data_constraints.sql`
  - [ ] Add CHECK constraint: recipients must have email OR phone
  - [ ] Add CHECK constraint: check_in_days > 0
  - [ ] Add CHECK constraint: sss_threshold <= sss_shares_total
  - [ ] Add UNIQUE constraint: one primary recipient per secret
  - [ ] Add CHECK constraint: reminder scheduled_for > created_at

### Task 0.6: Create Additional Optimization Indexes
- [ ] Create `drizzle/0010_add_optimization_indexes.sql`
  - [ ] Add `idx_email_failures_unresolved` for monitoring
  - [ ] Add `idx_check_in_tokens_secret_id` for lookups
  - [ ] Add `idx_check_in_tokens_expires` for cleanup
  - [ ] Add `idx_email_failures_type` for analytics
  - [ ] Add `idx_webhook_events_provider_type` for queries
  - [ ] Add partial indexes for performance

### Task 0.7: Update Schema TypeScript with Indexes
- [ ] Update `src/lib/db/schema.ts` to add index definitions
  - [ ] Use Drizzle's `index()` helper for each table
  - [ ] Add `.index('idx_name', columns)` to table definitions
  - [ ] Add unique indexes where needed
  - [ ] Document index purpose with comments
  - [ ] Regenerate migration if needed

## Phase 1: Type System Foundation (Priority: Critical)

### Task 1.1: Create Core Type Definitions
- [ ] Create `src/lib/types/secret-types.ts` with proper Drizzle-inferred types
  - [ ] Export `Secret` type using `typeof secrets.$inferSelect`
  - [ ] Export `SecretRecipient` type using `typeof secretRecipients.$inferSelect`
  - [ ] Create `SecretWithRecipients` interface extending Secret
  - [ ] Create `PrimaryRecipient` helper type
  - [ ] Add JSDoc comments for all exported types

### Task 1.2: Update Auth Type Usage
- [ ] Fix `src/app/(authenticated)/secrets/new/page.tsx`
  - [ ] Remove `as any` from `getServerSession` call
  - [ ] Use proper `GetServerSessionOptions` type from next-auth
  - [ ] Import `Session` type correctly
- [ ] Audit all other files using `getServerSession` for similar issues

### Task 1.3: Remove Legacy Type References
- [ ] Update `src/lib/db/schema.ts`
  - [ ] Add deprecation comment to `contactMethodEnum` (mark for future removal)
  - [ ] Document that `userContactMethods` is separate from `secretRecipients`
- [ ] Update `src/lib/types/webhook-types.ts`
  - [ ] Remove `recipientEmail` and `recipientName` fields
  - [ ] Add `recipients: SecretRecipient[]` field
  - [ ] Update JSDoc comments

## Phase 2: Database Operations (Priority: Critical)

### Task 2.1: Create Database Helper Functions
- [ ] Create `src/lib/db/queries/secrets.ts` with typed queries
  - [ ] `getSecretWithRecipients(secretId: string, userId: string): Promise<SecretWithRecipients | null>`
    - Use LEFT JOIN to fetch recipients
    - Use `sql<SecretRecipient[]>` with `json_agg` for proper typing
    - Filter by both secretId and userId
  - [ ] `getPrimaryRecipient(secretId: string): Promise<SecretRecipient | null>`
    - Query for `isPrimary = true`
    - Fallback to first recipient if no primary set
  - [ ] `getAllRecipients(secretId: string): Promise<SecretRecipient[]>`
    - Simple query to fetch all recipients for a secret
  - [ ] `updateSecretRecipients(secretId: string, recipients: SecretRecipientInsert[]): Promise<void>`
    - Transaction to delete old recipients and insert new ones
    - Ensure at least one recipient marked as primary

### Task 2.2: Update Existing Database Operations
- [ ] Update `src/lib/db/operations.ts` (or equivalent)
  - [ ] Modify `getSecret()` to use `getSecretWithRecipients()`
  - [ ] Update return type to `SecretWithRecipients`
  - [ ] Remove any fallback logic for old schema fields

### Task 2.3: Remove Secret Mapper Legacy Code
- [ ] Update `src/lib/db/secret-mapper.ts`
  - [ ] Remove `mapDrizzleSecretToApiShape` function (if it references old fields)
  - [ ] Remove `mapApiSecretToDrizzleShape` function (if it references old fields)
  - [ ] Create new `mapSecretWithRecipientsToApiShape` if needed
  - [ ] Ensure all mappings use proper types (no `any`)

## Phase 3: UI Component Updates (Priority: High)

### Task 3.1: Update Secret Card Component
- [ ] Fix `src/components/secret-card.tsx`
  - [ ] Update prop type to expect `SecretWithRecipients`
  - [ ] Display primary recipient using `getPrimaryRecipient()` helper
  - [ ] Show recipient count badge (e.g., "+2 more") if multiple recipients
  - [ ] Remove `recipientEmail`, `recipientPhone`, `recipientName` references
  - [ ] Add hover tooltip showing all recipients

### Task 3.2: Update Secret View Page
- [ ] Fix `src/app/(authenticated)/secrets/[id]/view/page.tsx`
  - [ ] Use `getSecretWithRecipients()` to fetch data
  - [ ] Replace contact info section with recipients list
  - [ ] Display all recipients in a table/list
  - [ ] Highlight primary recipient
  - [ ] Show email/phone for each recipient
  - [ ] Remove `getContactInfo()` function entirely

### Task 3.3: Update Share Instructions Page
- [ ] Fix `src/app/(authenticated)/secrets/[id]/share-instructions/page.tsx`
  - [ ] Update state management to use `recipients` array
  - [ ] Update mailto link generation to use primary recipient
  - [ ] Update UI text to refer to "primary recipient" instead of "the recipient"
  - [ ] Show list of all recipients who will receive shares
  - [ ] Update share naming to include recipient names

## Phase 4: API & Cron Job Updates (Priority: Critical)

### Task 4.1: Fix Cron Reminder Processing
- [ ] Update `src/app/api/cron/process-reminders/route.ts`
  - [ ] Fetch secrets with `getSecretWithRecipients()`
  - [ ] Loop through all recipients for each secret
  - [ ] Send reminder email to each recipient
  - [ ] Update email logging to include recipient id
  - [ ] Handle errors per-recipient (don't fail entire secret if one email fails)
  - [ ] Update disclosure email to send to all recipients

### Task 4.2: Fix Secret Update API
- [ ] Update `src/app/api/secrets/[id]/route.ts`
  - [ ] Change input validation to accept `recipients: RecipientInput[]`
  - [ ] Remove `recipient_name`, `recipient_email`, `recipient_phone`, `contact_method` from schema
  - [ ] Use `updateSecretRecipients()` for recipient changes
  - [ ] Validate at least one recipient has email or phone
  - [ ] Ensure exactly one recipient is marked as primary

### Task 4.3: Update Email Service
- [ ] Fix `src/lib/services/email-service.ts`
  - [ ] Update `sendSecretDisclosureEmail()` signature
    - Change `contactEmail: string, contactName: string` 
    - To `recipient: SecretRecipient`
  - [ ] Update `sendReminderEmail()` signature similarly
  - [ ] Update `logEmailSuccess()` to accept `recipientId: string`
  - [ ] Update all email logging to reference recipient records

## Phase 5: Profile & User Contact Methods (Priority: Medium)

### Task 5.1: Clarify Contact Methods vs Recipients
- [ ] Update `src/app/profile/page.tsx`
  - [ ] Add comment explaining `userContactMethods` is separate from `secretRecipients`
  - [ ] `userContactMethods` = user's own contact preferences
  - [ ] `secretRecipients` = people who receive the secret
  - [ ] Keep existing functionality as-is (this is working correctly)

### Task 5.2: Update Contact Methods Hook (If Needed)
- [ ] Review `src/hooks/useContactMethods.ts`
  - [ ] Verify this is only for user's own contact methods
  - [ ] If so, no changes needed (different table from recipients)
  - [ ] Add JSDoc comment clarifying purpose

## Phase 6: Recipient Management UI (Priority: High)

### Task 6.1: Create Recipient Components
- [ ] Create `src/components/recipients/RecipientCard.tsx`
  - [ ] Display single recipient with name, email, phone
  - [ ] Show "Primary" badge if isPrimary
  - [ ] Show edit/delete buttons
  - [ ] Use proper `SecretRecipient` type
  
- [ ] Create `src/components/recipients/RecipientsList.tsx`
  - [ ] Accept `recipients: SecretRecipient[]` prop
  - [ ] Map over recipients showing RecipientCard for each
  - [ ] Show empty state if no recipients
  - [ ] Sort to show primary first

- [ ] Create `src/components/recipients/RecipientEditor.tsx`
  - [ ] Form with fields: name, email, phone, isPrimary checkbox
  - [ ] Validation: require name, require email OR phone
  - [ ] Use Zod schema for validation
  - [ ] Submit handler returns `RecipientInput` type
  
- [ ] Create `src/components/recipients/AddRecipientButton.tsx`
  - [ ] Opens modal/dialog with RecipientEditor
  - [ ] Handles add recipient flow
  - [ ] Validates tier limits (free=1, pro=5)

### Task 6.2: Update Secret View Page
- [ ] Update `src/app/(authenticated)/secrets/[id]/view/page.tsx`
  - [ ] Add "Recipients" section showing RecipientsList
  - [ ] Replace old contact info display
  - [ ] Show recipient count badge

### Task 6.3: Create/Update Secret Edit Page  
- [ ] Update `src/app/(authenticated)/secrets/[id]/edit/page.tsx`
  - [ ] Add RecipientsList component (read-only or editable)
  - [ ] Add AddRecipientButton
  - [ ] Add remove recipient functionality
  - [ ] Add "Set as Primary" button for each recipient
  - [ ] Validate: at least one recipient before save
  - [ ] Validate: exactly one primary recipient

### Task 6.4: Update Edit Secret API
- [ ] Update API route to accept recipient updates
  - [ ] Add `recipients` field to request body schema
  - [ ] Call `updateSecretRecipients()` when recipients changed
  - [ ] Validate recipient constraints (tier limits, primary, contact info)

## Phase 7: Cleanup & Validation (Priority: Low)

### Task 6.1: Remove Dead Code
- [ ] Search for remaining references to old schema
  - [ ] `rg "recipientEmail|recipientName|recipientPhone" src/`
  - [ ] Remove or update any remaining instances
- [ ] Consider deprecating `contactMethodEnum`
  - [ ] Add deprecation comment if still used by `userContactMethods`
  - [ ] Plan removal if no longer needed

### Task 6.2: Update Tests
- [ ] Update all test files referencing old schema
  - [ ] `__tests__/**/*.test.ts`
  - [ ] Use new `SecretWithRecipients` type in test data
  - [ ] Mock `getSecretWithRecipients()` in tests
  - [ ] Update assertions to check `recipients` array

### Task 6.3: Validate Build
- [ ] Run `pnpm build` and verify no TypeScript errors
- [ ] Run `pnpm typecheck` and verify no errors
- [ ] Run `pnpm test` and verify all tests pass
- [ ] Test locally with `make dev`

### Task 6.4: Documentation
- [ ] Update `README.md` if it references old schema
- [ ] Add migration notes to `MIGRATION_GUIDE.md` (if exists)
- [ ] Update API documentation for endpoint changes
- [ ] Add JSDoc comments to all new functions

## Testing Checklist

- [ ] Can create new secret with multiple recipients
- [ ] Secret card displays primary recipient correctly
- [ ] View page shows all recipients
- [ ] Editing secret preserves recipients
- [ ] Cron job sends reminders to all recipients
- [ ] Email logging includes recipient information
- [ ] Share instructions work with multiple recipients
- [ ] Dashboard loads without errors
- [ ] No console errors related to recipient data
- [ ] TypeScript compilation succeeds with no `any` keywords

## Rollout Strategy

1. **Pre-deployment:**
   - [ ] Run full test suite
   - [ ] Manual QA of all affected pages
   - [ ] Verify no TypeScript errors

2. **Deployment:**
   - [ ] Deploy to staging first
   - [ ] Smoke test all recipient-related features
   - [ ] Monitor error logs for 24 hours
   - [ ] Deploy to production

3. **Post-deployment:**
   - [ ] Monitor error rates
   - [ ] Check email delivery for reminders
   - [ ] Verify analytics show no drop in feature usage

## Success Criteria

- [x] All tasks completed
- [ ] Build passes without TypeScript errors
- [ ] No usage of `any` keyword in updated code
- [ ] All tests passing
- [ ] Manual QA completed
- [ ] Staging deployment successful
- [ ] Production deployment successful
