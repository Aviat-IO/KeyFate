## Why

KeyFate's audited production path does not currently preserve its core custody and delivery guarantees under normal feature use, process crashes, replica overlap, or provider event ordering. Nostr and Bitcoin recovery are required for launch, yet both are functionally incomplete, and the current release pipeline cannot demonstrate that a tested revision is what Railway deploys.

## What Changes

- **BREAKING**: remove generic server plaintext-decryption APIs and stop returning plaintext server shares to authenticated owner/export flows.
- **BREAKING**: replace server-side plaintext Nostr share publication with a browser-created, owner-signed versioned recovery capsule; legacy recovery records require explicit owner re-enrollment.
- **BREAKING**: replace owner-generated recipient Bitcoin wallet custody with recipient-address delivery and recipient-encrypted pre-signed transactions; legacy session-only records require re-enrollment.
- Add durable, fenced PostgreSQL leases and stale-work recovery for disclosure and export workers.
- Replace replica-local export files with durable bounded artifacts and an owner-authorized atomic download route.
- Make database rate limiting atomic and fail closed; confine OTP failures to issued challenges instead of durable victim-account lockouts.
- Make checkout creation POST-only and bind Stripe/BTCPay entitlement to server-owned plans, amounts, currencies, and canonical provider data.
- Enforce CSP, update the already-flagged sanitizer, add explicit liveness/readiness probes, separate migrations from app startup, slim/pin the production image, and make CI/release gating auditable.
- Add migration, rollback, failure-injection, protocol round-trip, provider-contract, and staging acceptance gates without performing additional vulnerability discovery.

## Impact

- Affected specs: `data-protection`, `api-security`, `authentication`, `payment-integration`, `nostr-encrypted-delivery`, `bitcoin-timelock-delivery`, `infrastructure`, `monitoring`.
- Affected code: browser share/recovery flows, Nostr and Bitcoin modules, secret/recovery APIs, cron workers, GDPR export, payment routes/webhooks, auth/rate limiting, Drizzle schema/migrations, SvelteKit CSP/health, Docker, GitHub Actions, and Railway runbooks.
- Dependencies: target Railway architecture from `refactor-hosting-migration`; PostgreSQL remains the shared coordination/durable store.
- Out of scope: new product features, further security scanning, SMS delivery, new cloud providers, and automatic conversion of legacy recovery material whose private keys/authenticity cannot be recovered.
