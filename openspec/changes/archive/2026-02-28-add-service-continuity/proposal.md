## Why

KeyFate's dead man's switch depends on centralized infrastructure (PostgreSQL, Cloud Run, cron jobs). If KeyFate shuts down, users' secrets become orphaned with no path to disclosure. This violates the core promise of a dead man's switch.

## What Changes

- **Export System**: Users can download recovery kits with all shares and standalone recovery tools
- **Decentralized Storage**: Encrypted shares stored on Nostr relays, IPFS, and/or Arweave
- **Automatic Triggers**: Disclosure mechanisms that work without KeyFate infrastructure
- **Bitcoin Timelocks**: Optional blockchain-based disclosure for crypto-native users

**BREAKING**: None - all changes are additive

## Impact

- Affected specs: `secrets` (new export and decentralized storage capabilities)
- Affected code:
  - `frontend/src/app/(authenticated)/secrets/[id]/export/` (new)
  - `frontend/src/lib/export-recovery-kit.ts` (new)
  - `frontend/src/lib/nostr/` (new)
  - `frontend/src/lib/decentralized-storage/` (new)
