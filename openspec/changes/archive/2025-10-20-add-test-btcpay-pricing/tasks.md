# Implementation Tasks

## 1. Test Setup (TDD)

- [x] 1.1 Create test file `frontend/src/lib/payment/providers/__tests__/BTCPayProvider.environment-pricing.test.ts`
- [x] 1.2 Write test: BTCPayProvider returns test pricing in dev environment
- [x] 1.3 Write test: BTCPayProvider returns test pricing in staging environment
- [x] 1.4 Write test: BTCPayProvider returns production pricing in production environment
- [x] 1.5 Write test: BTCPayProvider returns production pricing when NEXT_PUBLIC_ENV is undefined
- [x] 1.6 Write test: Test pricing monthly is 10 sats (0.00000010 BTC)
- [x] 1.7 Write test: Test pricing yearly is 100 sats (0.00000100 BTC)
- [x] 1.8 Verify all tests fail (RED phase)

## 2. Implementation

- [x] 2.1 Add environment detection helper to BTCPayProvider
- [x] 2.2 Create test pricing constants (MONTHLY: 0.00000010 BTC, YEARLY: 0.00000100 BTC)
- [x] 2.3 Create production pricing constants (MONTHLY: 0.0002 BTC, YEARLY: 0.002 BTC)
- [x] 2.4 Update listPrices() method to check environment and return appropriate prices
- [x] 2.5 Add JSDoc comments documenting environment-based pricing behavior
- [x] 2.6 Verify all tests pass (GREEN phase)

## 3. Refactor

- [x] 3.1 Extract pricing logic into separate method getPricingForEnvironment()
- [x] 3.2 Ensure code follows project conventions (no comments unless needed, TypeScript strict mode)
- [x] 3.3 Run `pnpm typecheck` to verify type safety
- [x] 3.4 Run `pnpm lint` to ensure code quality
- [x] 3.5 Verify all tests still pass after refactoring

## 4. Integration Testing

- [x] 4.1 Test BTCPay checkout flow in dev environment with test pricing
- [x] 4.2 Verify invoice creation uses correct test amounts
- [x] 4.3 Verify environment variable switching works correctly
- [x] 4.4 Test edge cases (missing env var, invalid env var values)

## 5. Documentation

- [x] 5.1 Update `.env.local.example` with NEXT_PUBLIC_ENV example values
- [x] 5.2 Update btcpay-integration.md with environment-based pricing section
- [x] 5.3 Add comment in BTCPayProvider explaining test vs production pricing

## 6. Validation

- [x] 6.1 Run all payment-related tests: `pnpm test BTCPayProvider`
- [x] 6.2 Verify no regressions in existing payment tests
- [x] 6.3 Manual test: Create BTCPay invoice in dev with test pricing
- [x] 6.4 Manual test: Verify production env still uses production pricing
