# Implementation Tasks

## 1. Database Schema Changes
- [x] 1.1 Create migration to drop `is_primary` column from `secret_recipients` table
- [x] 1.2 Update database indexes to remove any `isPrimary` filters
- [x] 1.3 Test migration on local database
- [x] 1.4 Verify existing secrets remain queryable after migration

## 2. Type System Updates
- [x] 2.1 Remove `isPrimary` field from `SecretRecipient` type in `src/lib/types/secret-types.ts`
- [x] 2.2 Remove `SecretWithPrimaryRecipient` interface
- [x] 2.3 Remove `getPrimaryRecipient()` helper function
- [x] 2.4 Update `src/lib/db/schema.ts` to remove `isPrimary` field definition
- [x] 2.5 Update Drizzle snapshots and metadata

## 3. Schema Validation Updates
- [x] 3.1 Update `src/lib/schemas/secret.ts` to remove `isPrimary` from recipient schema
- [x] 3.2 Remove primary recipient validation in form schemas
- [x] 3.3 Update `sss_shares_total` max from 10 to 5
- [x] 3.4 Add validation helper text for threshold recommendations
- [x] 3.5 Update API validation schemas to remove primary checks

## 4. Database Query Functions
- [x] 4.1 Update `getSecretWithRecipients()` to remove `isPrimary DESC` ordering
- [x] 4.2 Update `getAllSecretsWithRecipients()` to order by `createdAt ASC` only
- [x] 4.3 Remove `getPrimaryRecipient()` function from `src/lib/db/queries/secrets.ts`
- [x] 4.4 Update `updateSecretRecipients()` to remove primary validation
- [x] 4.5 Update `getAllRecipients()` to remove primary ordering

## 5. API Endpoint Updates
- [x] 5.1 Update `src/app/api/secrets/route.ts` to remove primary recipient defaults
- [x] 5.2 Update `src/app/api/secrets/[id]/route.ts` to remove primary validation
- [x] 5.3 Remove "at least one primary" error messages
- [x] 5.4 Update API response mappers to exclude `isPrimary` field

## 6. Frontend Component Updates
- [x] 6.1 Update `src/components/secret-card.tsx` to remove primary recipient logic
- [x] 6.2 Update `src/components/forms/newSecretForm.tsx`:
  - [ ] 6.2a Remove `isPrimary: true` from default recipient
  - [ ] 6.2b Remove `isPrimary: false` when adding new recipients
  - [ ] 6.2c Remove "(Primary)" label display
  - [ ] 6.2d Auto-expand SSS accordion when `recipients.length > 1`
  - [ ] 6.2e Add equal share distribution info alert
  - [ ] 6.2f Add SSS configuration examples
  - [ ] 6.2g Update max shares validation to 5
- [x] 6.3 Update `src/components/forms/editSecretForm.tsx`:
  - [ ] 6.3a Remove primary recipient checkbox
  - [ ] 6.3b Remove "one primary" validation logic
  - [ ] 6.3c Remove primary badge display
  - [ ] 6.3d Update recipient ordering to `createdAt` or alphabetical
- [x] 6.4 Update `src/components/forms/secretDetailsForm.tsx` to remove primary badges
- [x] 6.5 Update `src/app/(authenticated)/secrets/[id]/view/page.tsx`:
  - [ ] 6.5a Remove primary recipient fallback logic
  - [ ] 6.5b Display all recipients equally
  - [ ] 6.5c Remove "Primary" badge
- [x] 6.6 Update `src/app/(authenticated)/secrets/[id]/edit/page.tsx` to remove primary defaults
- [x] 6.7 Update `src/app/(authenticated)/secrets/[id]/share-instructions/page.tsx`:
  - [ ] 6.7a Add CRITICAL WARNING: "YOU must distribute this share to each recipient"
  - [ ] 6.7b Add info: "KeyFate will automatically send Share 0 when triggered"
  - [ ] 6.7c Explain: "Recipients need BOTH shares to reconstruct"
  - [ ] 6.7d Show single share card labeled "For ALL recipients"
  - [ ] 6.7e List each recipient with suggested secure distribution methods
  - [ ] 6.7f Add required checkbox: "I have distributed Share 1 to all recipients"
  - [ ] 6.7g Add required checkbox: "I have stored backup shares securely"
  - [ ] 6.7h Explain automated disclosure behavior (share #0 sent automatically)

## 7. Verify Existing Share Disclosure (No Changes Needed)
- [x] 7.1 ✅ **VERIFY ONLY:** Confirm `process-reminders/route.ts` sends disclosure to all recipients (line 99-122)
- [x] 7.2 ✅ **VERIFY ONLY:** Confirm `getAllRecipients()` query doesn't filter by `isPrimary`
- [x] 7.3 ✅ **VERIFY ONLY:** Verify `sendSecretDisclosureEmail()` includes server share
- [x] 7.4 ✅ **VERIFY ONLY:** Test that existing disclosure flow works after removing `isPrimary`
- [x] 7.5 **OPTIONAL:** Update disclosure email template to mention Share 1 if not already included

## 8. Test Updates
- [x] 8.1 Update `__tests__/components/edit-secret-form-multi-recipients.test.tsx`:
  - [ ] 8.1a Remove primary recipient toggle tests
  - [ ] 8.1b Remove "at least one primary" validation tests
  - [ ] 8.1c Add equal recipient treatment tests
- [x] 8.2 Update `__tests__/components/secret-card.test.tsx` to remove primary logic
- [x] 8.3 Update `__tests__/api/tier-limits.test.ts` to remove `isPrimary` from mock data
- [x] 8.4 Update `__tests__/test-helpers/mock-secret.ts` to remove `isPrimary` field
- [x] 8.5 Update all other test files (8+ remaining) to remove primary recipient references
- [x] 8.6 Add new tests for equal share distribution
- [x] 8.7 Add tests for SSS validation (max 5 shares)

## 9. Documentation Updates
- [x] 9.1 Update OpenSpec documentation to reflect equal recipient model
- [x] 9.2 Update user-facing help text about share distribution
- [x] 9.3 Add FAQ entry: "Why do all recipients receive the same share?"
- [x] 9.4 Update security documentation about threshold implications

## 10. Validation & Testing
- [x] 10.1 Run TypeScript compiler to verify no `isPrimary` errors
- [x] 10.2 Run all unit tests
- [x] 10.3 Run integration tests for secret creation/editing
- [x] 10.4 Manual testing: Create secret with 3 recipients
- [x] 10.5 Manual testing: Edit existing secret recipients
- [x] 10.6 Manual testing: View secret with multiple recipients
- [x] 10.7 Manual testing: Trigger secret and verify share distribution
- [x] 10.8 Load testing: Dashboard with 50+ secrets with multiple recipients
- [x] 10.9 Database migration dry-run on staging
- [x] 10.10 Production build verification

## 11. Deployment
- [x] 11.1 Create database backup before migration
- [x] 11.2 Deploy migration to staging environment
- [x] 11.3 Verify staging works correctly
- [x] 11.4 Verify existing cron jobs work with updated recipient queries
- [x] 11.5 Test multi-recipient disclosure with staging secrets
- [x] 11.6 Deploy to production
- [x] 11.7 Monitor error logs for 24 hours
- [x] 11.8 Verify existing secrets display correctly
