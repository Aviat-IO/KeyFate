## 1. Bitcoin Script Construction

- [x] 1.1 Implement CSV timelock script (OP_IF owner / OP_ELSE CSV recipient) in `src/lib/bitcoin/script.ts`
- [x] 1.2 Implement P2WSH address generation from witness script
- [x] 1.3 Implement OP_RETURN script and payload construction (32-byte K + 32-byte Nostr event ID)
- [x] 1.4 Implement script decoder for verification and debugging
- [x] 1.5 Implement days-to-blocks and blocks-to-days conversion utilities

## 2. Transaction Construction

- [x] 2.1 Implement timelock UTXO creation transaction (P2WPKH input, P2WSH output) in `src/lib/bitcoin/transaction.ts`
- [x] 2.2 Implement pre-signed recipient transaction with OP_RETURN and CSV sequence
- [x] 2.3 Implement vbyte estimation for both transaction types
- [x] 2.4 Add dust threshold and minimum UTXO validation

## 3. Broadcasting and Status

- [x] 3.1 Implement transaction broadcasting with mempool.space primary and blockstream.info fallback in `src/lib/bitcoin/broadcast.ts`
- [x] 3.2 Implement UTXO status checking (confirmed/spent) via API polling
- [x] 3.3 Implement fee rate estimation from mempool.space with fallback defaults in `src/lib/bitcoin/fee-estimation.ts`

## 4. Client-Side Wallet

- [x] 4.1 Implement Bitcoin keypair generation (secp256k1) in `src/lib/bitcoin/client-wallet.ts`
- [x] 4.2 Implement sessionStorage persistence for keypairs (hex-encoded)
- [x] 4.3 Implement Bitcoin metadata storage (symmetricKeyK, nostrEventId, recipientAddress)
- [x] 4.4 Implement cleanup utilities for session data

## 5. Client-Side Operations

- [x] 5.1 Implement `enableBitcoinClient` orchestrator (create UTXO, broadcast, create pre-signed tx) in `src/lib/bitcoin/client-operations.ts`
- [x] 5.2 Implement `refreshBitcoinClient` orchestrator (spend via owner path, recreate UTXO, new pre-signed tx)

## 6. UTXO Refresh (Check-In)

- [x] 6.1 Implement refresh transaction construction (spend IF branch, create new P2WSH) in `src/lib/bitcoin/refresh.ts`
- [x] 6.2 Implement custom witness construction for owner-path spending
- [x] 6.3 Implement `estimateRefreshesRemaining` utility

## 7. Server-Side Service Layer

- [x] 7.1 Implement `enableBitcoin` service (UTXO creation, broadcast, DB persistence) in `src/lib/services/bitcoin-service.ts`
- [x] 7.2 Implement `refreshBitcoin` service (atomic UTXO rotation in database transaction)
- [x] 7.3 Implement `getBitcoinStatus` query with estimated days remaining and refreshes remaining
- [x] 7.4 Implement `getActiveUtxo` helper for check-in flow integration

## 8. Database Schema

- [x] 8.1 Add `bitcoin_utxos` table with status enum (pending/confirmed/spent), timelock script, pubkeys, pre-signed tx
- [x] 8.2 Add indexes on secretId and status columns
- [x] 8.3 Add unique constraint on (txId, outputIndex)
- [x] 8.4 Generate migration via `drizzle-kit generate`

## 9. Cron Job

- [x] 9.1 Implement `confirmPendingUtxos` cron logic with rate limiting (max 10 per run) in `src/lib/cron/confirm-utxos.ts`
- [x] 9.2 Add cron API route with authorization in `src/routes/api/cron/confirm-utxos/+server.ts`

## 10. Recovery UI

- [x] 10.1 Implement BitcoinRecoveryStep component (parse tx hex, extract OP_RETURN, fetch Nostr event, decrypt share)
- [x] 10.2 Integrate Bitcoin recovery into `/recover` page as one of three recovery methods

## 11. Testing

- [x] 11.1 Unit tests for CSV script construction and decoding
- [x] 11.2 Unit tests for transaction creation and signing
- [x] 11.3 Unit tests for fee estimation fallback behavior
- [x] 11.4 Unit tests for UTXO refresh and remaining estimation
- [x] 11.5 Unit tests for bitcoin-service database operations
- [x] 11.6 Unit tests for confirm-utxos cron logic
