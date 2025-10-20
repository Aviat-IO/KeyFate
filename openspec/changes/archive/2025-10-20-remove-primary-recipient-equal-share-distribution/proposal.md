# Proposal: Remove Primary Recipient Designation and Implement Equal Share Distribution

**Change ID:** `remove-primary-recipient-equal-share-distribution`  
**Status:** Draft  
**Created:** 2025-01-10  
**Author:** AI Assistant

## Why

The current multi-recipient implementation treats recipients unequally by designating one as "primary," which contradicts the goal of allowing users to share secrets with multiple trusted parties equally. Additionally, the share distribution model needs clarification: all recipients should receive the SAME user-managed share (not different shares), which maintains KeyFate's zero-knowledge architecture while simplifying the security model and preventing premature secret reconstruction through recipient collaboration.

## What Changes

### 1. **Remove Primary Recipient Concept**
- **BREAKING:** Remove `is_primary` column from `secret_recipients` table
- **BREAKING:** Remove all UI indicators of "Primary" recipient status
- Remove `isPrimary` field from TypeScript interfaces and schemas
- Remove validation logic requiring "at least one primary recipient"
- Update recipient display to show all recipients equally (alphabetically or by creation date)

### 2. **Implement Equal Share Distribution**
- All recipients receive the SAME user-managed share (share #1)
- Server retains share #0 (encrypted, insufficient alone to reconstruct secret)
- **USER RESPONSIBILITY:** User must distribute share #1 to each recipient separately (share never touches KeyFate servers after creation)
- Share instructions page provides critical warnings about user's distribution responsibility
- When secret triggers, cron job automatically sends share #0 + instructions to all recipients

### 3. **SSS Configuration Validation**
- Reduce `sss_shares_total` maximum from 10 to 5 (aligns with 5 recipient limit)
- Add validation: `sss_shares_total >= 2` (minimum: 1 for server + 1 for recipients)
- Add UX guidance with examples in advanced accordion:
  - Example 1: 3 total shares, threshold 2 → "Server share + any 1 recipient can reconstruct"
  - Example 2: 5 total shares, threshold 3 → "Server share + any 2 recipients can reconstruct"
  - Example 3: 3 total shares, threshold 3 → "All shares required (maximum security)"

### 4. **Multi-Recipient UX Improvements**
- Automatically expand SSS advanced accordion when `recipients.length > 1`
- Show helper text: "With multiple recipients, consider your threshold carefully"
- Add info alert explaining: "All recipients will receive the same cryptographic share"
- Display recommended configurations based on recipient count

## Impact

### Database Changes
- **Migration Required:** Drop `is_primary` column from `secret_recipients`
- **Data Migration:** None (column removal only)
- **Affected Tables:** `secret_recipients`

### Code Changes
- **Schema:** `/frontend/src/lib/db/schema.ts` - Remove `isPrimary` field
- **Types:** `/frontend/src/lib/types/secret-types.ts` - Remove `isPrimary` from interfaces
- **Validation:** `/frontend/src/lib/schemas/secret.ts` - Remove primary recipient validation
- **Queries:** `/frontend/src/lib/db/queries/secrets.ts` - Remove primary ordering/filtering
- **Components:** 30+ files referencing `isPrimary` (see task agent report)
- **Tests:** 10+ test files with primary recipient logic
- **Note:** Email disclosure and cron jobs already implemented in `/frontend/src/app/api/cron/process-reminders/route.ts` (lines 99-122) - sends to all recipients via `getAllRecipients()` query. No changes needed to disclosure logic.

### API Changes
- **No Breaking API Changes:** API accepts/returns recipients array without `isPrimary`
- Backend validation updated to remove primary recipient requirements
- Share distribution logic clarified (all recipients get same share)
- **Note:** Existing cron jobs already handle share disclosure - no modifications needed

### User-Facing Changes
- Remove "Primary" badges from recipient lists
- Update recipient display to show all equally
- Add clarification in share instructions about equal share distribution
- Enhanced SSS configuration guidance for multi-recipient scenarios

### Security Implications
- **Positive:** Prevents premature secret reconstruction (all recipients have same share, can't collaborate without server share)
- **Positive:** Simplifies security model (no confusion about recipient hierarchy)
- **Neutral:** Server still holds only 1 share (maintains zero-knowledge guarantee)
- **User Education:** Need to clarify threshold implications with multiple recipients

## Dependencies

- **Blocks:** Future share distribution features
- **Blocked By:** None
- **Related:** `fix-multi-recipient-schema-migration` (should be completed first to ensure all recipient queries are updated)
- **Existing Infrastructure:** Email disclosure and cron jobs already implemented and functional

## Risks

### Low Risk
- Database migration is straightforward (column drop)
- Type system will catch all code locations needing updates
- Existing secrets continue working (recipients still associated correctly)

### Mitigation
- Comprehensive test coverage for recipient equality
- Clear user communication about share distribution model
- Database backup before migration

## Success Criteria

1. ✅ No `isPrimary` references in codebase (database, types, UI, tests)
2. ✅ All recipient displays show recipients equally
3. ✅ Share instructions emphasize USER RESPONSIBILITY for share distribution
4. ✅ Share instructions show single share card labeled "For ALL recipients"
5. ✅ Critical warning displayed: "You MUST distribute this share to each recipient separately"
6. ✅ SSS validation limits total shares to 5
7. ✅ SSS accordion auto-expands for multi-recipient secrets
8. ✅ Helper text provides clear threshold recommendations (non-enforced)
9. ✅ All tests pass with updated recipient model
10. ✅ Production build succeeds without TypeScript errors
11. ✅ Cron job sends share #0 + reconstruction instructions to all recipients
12. ✅ Zero-knowledge maintained: share #1 never touches KeyFate servers after initial creation

## Design Decisions (Confirmed)

1. ✅ **No `recipient_share_index` column needed** - Keep simple: KeyFate gets share #0, user manages the rest
   
2. ✅ **Share instructions: Single card with critical user responsibility messaging**
   - Display share #1 once with label "Share for ALL recipients"
   - **CRITICAL WARNING:** User must distribute this share themselves (cannot touch KeyFate servers)
   - Emphasize: "You MUST send this share separately to each recipient"
   - Include guidance on secure distribution methods

3. ✅ **Threshold recommendations: Provide guidance, allow user choice**
   - Show examples for different security/convenience trade-offs
   - No enforcement of minimum thresholds
   - Trust user to choose based on their risk tolerance

4. ✅ **Migration timing: No dependency on data migration order**
   - No existing production data to migrate
   - Can be implemented independently of other changes
