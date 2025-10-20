## Why

Pro users managing highly sensitive secrets need flexibility to configure Shamir's Secret Sharing threshold schemes beyond the standard 2-of-3. Increasing total shares to 7 and allowing any valid threshold provides stronger security and redundancy options.

## What Changes

- **BREAKING:** Remove threshold configuration from Free tier (locked to 2-of-3)
- Increase max `sss_shares_total` from 3 to 7 for Pro users
- Allow Pro users to configure any threshold where 2 ≤ threshold ≤ total_shares ≤ 7
- Update database schema to support up to 7 shares
- Add UI for threshold configuration (Pro only)
- Add server-side validation to enforce tier-based threshold limits
- Update client-side Shamir's Secret Sharing implementation to support variable shares

## Impact

- Affected specs: shamir-threshold-configuration (new), tier-enforcement (modified)
- Affected code:
  - Database: `frontend/src/lib/db/schema.ts` (already supports variable threshold via `sss_shares_total` and `sss_threshold`)
  - Secret creation API: add tier validation for threshold > 3
  - Secret UI: add threshold selector for Pro users
  - Client-side crypto: update Shamir implementation to handle up to 7 shares
  - `frontend/src/constants/pro-features.ts` (add threshold feature)
  - Tier validation utilities
