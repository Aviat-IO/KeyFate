## Why

The existing email-based secret delivery depends on centralized infrastructure (SendGrid, DNS) that can be censored, blocked, or fail. Bitcoin CSV timelocks provide a trustless, censorship-resistant delivery mechanism where a pre-signed transaction becomes spendable by the recipient after a relative timelock expires, with no server involvement required at disclosure time.

## What Changes

- Add Bitcoin CSV timelock script construction (OP_IF/OP_ELSE with OP_CHECKSEQUENCEVERIFY)
- Add client-side Bitcoin keypair generation and session storage
- Add timelock UTXO creation, broadcasting, and fee estimation via mempool.space/blockstream.info APIs
- Add UTXO refresh (check-in) mechanism that spends via owner path and recreates with fresh timelock
- Add pre-signed recipient transaction creation with OP_RETURN embedding (symmetric key K + Nostr event ID)
- Add server-side Bitcoin service layer for UTXO lifecycle management with database persistence
- Add `bitcoin_utxos` database table with status tracking (pending/confirmed/spent)
- Add cron job for confirming pending UTXOs via blockchain API polling
- Add Bitcoin recovery step in the client-side recovery UI

## Impact

- Affected specs: none (new capability)
- Affected code:
  - `src/lib/bitcoin/` (8 modules: script, transaction, broadcast, client-wallet, client-operations, refresh, fee-estimation)
  - `src/lib/services/bitcoin-service.ts`
  - `src/lib/cron/confirm-utxos.ts`
  - `src/routes/api/cron/confirm-utxos/+server.ts`
  - `src/lib/db/schema.ts` (bitcoin_utxos table)
  - `src/lib/components/recovery/BitcoinRecoveryStep.svelte`
  - `src/routes/recover/+page.svelte`
- Dependencies: `@scure/btc-signer`, `@noble/curves`, `@noble/hashes`, `@scure/base`
- Cross-cutting: Integrates with Nostr delivery (OP_RETURN contains Nostr event ID) and passphrase recovery (three-path K recovery)
