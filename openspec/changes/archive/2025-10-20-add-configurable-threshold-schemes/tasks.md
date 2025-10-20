## 1. Database & Schema

- [x] 1.1 Verify schema supports variable threshold (already has `sss_shares_total` and `sss_threshold`)
- [x] 1.2 Add database migration if schema changes needed (not needed - schema already supports it)
- [x] 1.3 Update schema documentation to reflect max 7 shares

## 2. Backend Implementation

- [x] 2.1 Create threshold validation utility: `validateThresholdForTier(tier, threshold, totalShares)`
- [x] 2.2 Update secret creation API to validate threshold based on user tier
- [x] 2.3 Update secret update API to validate threshold changes
- [x] 2.4 Add tier enforcement: Free tier locked to 2-of-3, Pro tier 2-7 shares with any valid threshold

## 3. Frontend Implementation

- [x] 3.1 Create `ThresholdSelector` component for Pro users
- [x] 3.2 Add threshold configuration to secret creation form (Pro only)
- [x] 3.3 Display current threshold in secret details for Pro users
- [x] 3.4 Hide/disable threshold selector for Free users with upgrade prompt
- [x] 3.5 Update client-side Shamir implementation to handle variable shares (already supports it)

## 4. Constants & Features

- [x] 4.1 Add threshold schemes to PRO_FEATURES constant
- [x] 4.2 Update tiers.ts to clarify Free tier has fixed 2-of-3, Pro tier has configurable threshold
- [x] 4.3 Add threshold limits constants: `MAX_SHARES_FREE = 3`, `MAX_SHARES_PRO = 7`

## 5. Testing

- [x] 5.1 Test Free user cannot configure threshold (UI hidden, API rejects)
- [x] 5.2 Test Pro user can configure 2-of-3, 2-of-4, 3-of-5, 4-of-7, etc.
- [x] 5.3 Test validation rejects invalid thresholds (threshold > total, threshold < 2)
- [x] 5.4 Test client-side Shamir works with 3, 4, 5, 6, 7 shares (already supported)
- [x] 5.5 Test secret reconstruction with various threshold schemes (already supported)
- [x] 5.6 Test tier enforcement at API level

## 6. Documentation

- [x] 6.1 Update project.md Security Model section with variable threshold schemes
- [x] 6.2 Document Free tier restriction: 2-of-3 only
- [x] 6.3 Document Pro tier capability: 2-of-N up to 7 shares
