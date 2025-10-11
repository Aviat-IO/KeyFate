## Why

Pro users need a clear way to access support when issues arise. Displaying a dedicated support email provides a direct communication channel and differentiates the Pro experience from Free tier.

## What Changes

- Add support email (support@aviat.io) to Pro tier features list
- Display support email in PricingPage component for Pro tier
- Show support contact in "Welcome to Pro!" modal
- Update tier constants to include priority support as a feature

## Impact

- Affected specs: pro-tier-features (new)
- Affected code: 
  - `frontend/src/constants/tiers.ts` (add to Pro features)
  - `frontend/src/constants/pro-features.ts` (new file)
  - `frontend/src/components/subscription/PricingPage.tsx`
  - `frontend/src/components/subscription/WelcomeToProModal.tsx` (new)
