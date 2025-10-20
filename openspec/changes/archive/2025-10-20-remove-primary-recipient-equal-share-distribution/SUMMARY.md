# Summary: Equal Share Distribution for Multi-Recipient Secrets

## Quick Overview

This proposal eliminates the "primary recipient" concept and clarifies that all recipients receive the SAME cryptographic share, maintaining KeyFate's zero-knowledge security while preventing recipient collusion.

## Key Changes

### 1. **Remove Primary Recipient** ✅
- ❌ Delete `is_primary` column from database
- ❌ Remove "Primary" badges from UI
- ❌ Remove primary recipient validation logic
- ✅ Treat all recipients equally

### 2. **Equal Share Distribution** ✅
- All recipients receive share #1 (same share)
- Server retains share #0 (insufficient alone)
- Prevents recipients from bypassing KeyFate by collaborating
- Maintains zero-knowledge architecture

### 3. **SSS Configuration Improvements** ✅
- Reduce max total_shares from 10 → 5 (aligns with 5 recipient limit)
- Auto-expand accordion when recipients > 1
- Provide clear examples and recommendations
- Add info alert: "All recipients receive same share"

## Security Benefits

| Scenario | Before | After |
|----------|--------|-------|
| **Server alone** | 1 share (can't reconstruct) | ✅ Same - 1 share |
| **Recipient alone** | 1 share (can't reconstruct) | ✅ Same - 1 share |
| **2 recipients collude** | 2 different shares (might reconstruct if threshold=2) | ✅ Both have same share (can't reconstruct) |
| **Server + 1 recipient** | 2 shares (can reconstruct if threshold=2) | ✅ Same behavior |

**New Protection:** Recipients cannot bypass the dead man's switch by pooling their shares before trigger event.

## User Experience

### Creating Secret with 3 Recipients

**Before:**
```
Recipients:
  [✓] Alice (Primary)  
  [ ] Bob
  [ ] Carol

⚠️ You must select one primary recipient
```

**After:**
```
Recipients:
  Alice (added first)
  Bob
  Carol

ℹ️  All recipients will receive the same share
   when this secret triggers.

▼ Advanced: Secret Sharing Configuration
  Total Shares: 3
  Threshold: 2
  
  Example: Server + any 1 recipient can reconstruct
```

## Migration Impact

### Database
- **Migration:** Drop `is_primary` column
- **Indexes:** Remove primary-based indexes
- **Data:** No transformation needed
- **Rollback:** Simple column restore if needed

### Code
- **30+ files** reference `isPrimary`
- **10+ test files** need updates
- **Type system** catches all locations automatically
- **Estimated effort:** 4-6 hours for full implementation

## Implementation Phases

1. **Database** (30 min) - Migration script
2. **Types** (30 min) - Remove isPrimary from interfaces
3. **Validation** (45 min) - Update schemas, remove primary checks
4. **Queries** (45 min) - Update database queries
5. **API** (45 min) - Update endpoints
6. **UI** (1.5 hr) - Update forms, views, instructions
7. **Verification** (30 min) - Verify existing cron/email disclosure works
8. **Tests** (1 hr) - Update all test files
9. **Docs** (30 min) - Update help text

**Total:** ~5.5 hours

**Note:** Email disclosure and cron jobs already implemented in `/frontend/src/app/api/cron/process-reminders/route.ts` - iterates over all recipients and sends disclosure emails (lines 99-122). No additional work needed for disclosure logic.

## Share Distribution Flow

```
Secret Created with threshold=2, total_shares=3
     ↓
Client splits into 3 shares:
  Share 0 → Server (encrypted)  
  Share 1 → USER distributes to all recipients
  Share 2 → User backup (localStorage → offline storage)
     ↓
USER RESPONSIBILITY: Send Share 1 separately to:
  📧 Alice (via encrypted email)
  💬 Bob (via Signal)
  🔐 Carol (via password manager)
     ↓
Secret Triggers (user misses check-in)
     ↓
Cron automatically sends Share 0 to ALL recipients:
  ✉️  Alice: Share 0 + instructions
  ✉️  Bob: Share 0 + instructions
  ✉️  Carol: Share 0 + instructions
     ↓
Recipient Recovery (Automated):
  1. Alice receives email with Share 0
  2. Alice already has Share 1 (from user earlier)
  3. Alice combines: SSS.combine([Share 0, Share 1])
  4. ✅ Secret reconstructed - no manual verification needed
  
Collusion attack fails:
  Share 1 (Alice) + Share 1 (Bob) = ❌ Both same, can't reconstruct
  Need Share 0 from KeyFate (only released after trigger)
```

## Questions Addressed

### Q: Why same share for all recipients?
**A:** Prevents recipients from collaborating to bypass the trigger. If each had different shares, 2+ recipients could reconstruct the secret before KeyFate triggers it.

### Q: Does KeyFate send shares to recipients when the secret triggers?
**A:** **YES, but only Share 0 (server share).** KeyFate automatically sends Share 0 to all recipients when triggered. The USER is responsible for distributing Share 1 to each recipient beforehand via their own secure channels. This maintains partial zero-knowledge - Share 1 never touches KeyFate servers after initial creation.

### Q: What if I forget to distribute Share 1 to recipients?
**A:** Recipients will receive notification that the secret triggered, but won't be able to reconstruct it without Share 1. **This is critical user responsibility** and must be emphasized in the UI.

### Q: How do I choose the right threshold?
**A:** 
- **Threshold 2:** Server + any 1 recipient (most convenient)
- **Threshold 3:** Server + any 2 recipients (balanced)
- **Threshold = total_shares:** All shares required (maximum security)

### Q: What happens to existing secrets?
**A:** They continue working normally. The migration only removes the "primary" designation - all recipients remain associated with their secrets.

### Q: Can I still have backups?
**A:** Yes! Create more than 2 total shares (e.g., 4 shares, threshold 2) and store shares #2-3 as offline backups (paper, encrypted USB, password manager).

## Next Steps

1. **Review proposal** - Check for any concerns or clarifications needed
2. **Approve proposal** - Confirm this aligns with project vision
3. **Implementation** - Follow tasks.md checklist
4. **Testing** - Comprehensive test coverage
5. **Deployment** - Staged rollout (staging → production)
6. **Archive** - Move to archive/ after completion

## Design Decisions (Confirmed)

1. ✅ **No `recipient_share_index` column** - Keep simple: KeyFate gets share #0, user manages the rest
   
2. ✅ **Share instructions: Single card with CRITICAL user responsibility warnings**
   - User MUST distribute Share 1 themselves via secure channels
   - KeyFate automatically sends Share 0 when triggered
   - Share 1 never touches KeyFate servers (partial zero-knowledge)
   
3. ✅ **Threshold recommendations: Provide guidance, allow flexibility**
   - Show examples but don't enforce minimums
   - Trust users to choose based on their needs

4. ✅ **No data migration dependencies**
   - Can implement independently
   - No existing production data affected
