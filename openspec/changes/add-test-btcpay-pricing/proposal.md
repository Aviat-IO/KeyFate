# Add Test BTCPay Pricing for Dev/Staging Environments

## Why

Currently, testing the BTCPay Server integration requires paying production-level amounts (0.0002 BTC ≈ $9 monthly or 0.002 BTC ≈ $90 yearly). This creates significant friction and cost during development, testing, and QA cycles in dev and staging environments. Developers and QA teams need a way to validate the complete payment flow with minimal cost—just a few satoshis (10-100 sats ≈ $0.005-$0.05).

## What Changes

- Add environment-aware pricing configuration to BTCPayProvider
- Create test pricing tiers for dev/staging environments (10-100 sats)
- Keep production pricing unchanged at current levels
- Add environment detection logic based on `NEXT_PUBLIC_ENV` variable
- Update BTCPayProvider.listPrices() to return environment-specific prices
- Add comprehensive tests for environment-based pricing selection

## Impact

- **Affected specs**: payment-processing (new capability spec)
- **Affected code**:
  - `frontend/src/lib/payment/providers/BTCPayProvider.ts` (modified)
  - `frontend/src/lib/env.ts` (may need new env variable)
  - Test files for BTCPayProvider
- **Benefits**:
  - Significantly reduced testing costs in dev/staging
  - Faster iteration cycles for payment flow testing
  - No impact on production pricing or behavior
- **Breaking changes**: None
- **Migration**: None required (additive change only)
