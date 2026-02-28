## 1. Nostr Integration (Refine from add-service-continuity)

- [x] 1.1 Add `nostr-tools` dependency (`bun add nostr-tools`)
- [x] 1.2 Create `src/lib/nostr/client.ts` - relay pool management, event
      publishing, event querying
- [x] 1.3 Create `src/lib/nostr/keypair.ts` - Nostr keypair generation for users
      (optional, can use existing keys)
- [x] 1.4 Create `src/lib/nostr/encryption.ts` - NIP-44 encryption/decryption
      wrapper
- [x] 1.5 Create `src/lib/nostr/gift-wrap.ts` - NIP-59 Gift Wrap event
      construction
- [x] 1.6 Create `src/lib/nostr/relay-config.ts` - recommended relay list and
      health checking
- [x] 1.7 Add `nostr_pubkey` column to `secret_recipients` table in Drizzle
      schema
- [x] 1.8 Generate Drizzle migration for schema change
      (`bunx drizzle-kit generate --name="add_nostr_pubkey"`)
- [x] 1.9 Create API endpoint for recipient Nostr pubkey management
- [x] 1.10 Write tests for Nostr client, encryption, and gift wrap modules

## 2. Double Encryption Layer

- [x] 2.1 Add `@noble/ciphers` dependency (ChaCha20-Poly1305)
- [x] 2.2 Create `src/lib/crypto/symmetric.ts` - generate random key K,
      encrypt/decrypt with ChaCha20-Poly1305
- [x] 2.3 Create `src/lib/crypto/double-encrypt.ts` - orchestrate double
      encryption:
  - Encrypt share with K (ChaCha20)
  - Encrypt K with NIP-44 (Nostr pubkey)
  - Optionally encrypt K with passphrase (PBKDF2 + AES-256-GCM)
- [x] 2.4 Create `src/lib/crypto/recovery.ts` - three-path K recovery:
  - From Bitcoin OP_RETURN
  - From NIP-44 decryption
  - From passphrase
- [x] 2.5 Write tests for all crypto modules (symmetric, double-encrypt,
      recovery)

## 3. Bitcoin CSV Timelock

- [x] 3.1 Add `@scure/btc-signer` and `@scure/base` dependencies (noble/scure
      ecosystem, Bun-native)
- [x] 3.2 Verify Bun runtime compatibility (works with @scure/btc-signer)
- [x] 3.3 Create `src/lib/bitcoin/script.ts` - CSV timelock script construction:
  - Owner path (spend anytime)
  - Recipient path (spend after timeout)
- [x] 3.4 Create `src/lib/bitcoin/transaction.ts` - UTXO creation, pre-signed
      recipient tx with OP_RETURN
- [x] 3.5 Create `src/lib/bitcoin/refresh.ts` - check-in refresh: spend UTXO via
      owner path, recreate with new script
- [x] 3.6 Create `src/lib/bitcoin/broadcast.ts` - transaction broadcasting via
      public APIs (mempool.space, blockstream.info)
- [x] 3.7 Create `src/lib/bitcoin/fee-estimation.ts` - fee rate estimation from
      public APIs
- [x] 3.8 Create `bitcoin_utxos` table in Drizzle schema (tracks active
      timelocked UTXOs per secret)
- [x] 3.9 Generate Drizzle migration
      (`bunx drizzle-kit generate --name="add_bitcoin_utxos"`)
- [x] 3.10 Write tests for script construction, transaction building, refresh
      logic

## 4. Secret Creation Flow (Bitcoin + Nostr)

- [x] 4.1 Modify secret creation API to optionally trigger Nostr share
      publishing
- [x] 4.2 Create API endpoint: `POST /api/secrets/[id]/enable-bitcoin` - creates
      timelocked UTXO
- [x] 4.3 Create API endpoint: `POST /api/secrets/[id]/refresh-bitcoin` -
      refresh UTXO (check-in)
- [x] 4.4 Create API endpoint: `GET /api/secrets/[id]/bitcoin-status` - UTXO
      status, time remaining
- [x] 4.5 Modify check-in flow to optionally refresh Bitcoin UTXO alongside
      server check-in
- [x] 4.6 Store pre-signed recipient transaction (encrypted, in DB or delivered
      to recipient)
- [x] 4.7 Write integration tests for the full Bitcoin-enabled secret lifecycle

## 5. Recipient Recovery UI

- [x] 5.1 Create `src/routes/recover/+page.svelte` - standalone recovery page
- [x] 5.2 Implement "Recover via Nostr" flow:
  - Input recipient nsec (or use browser extension)
  - Query relays for Gift Wrapped events tagged to recipient
  - Decrypt with NIP-44 to get encrypted share
  - Prompt for K (from Bitcoin OP_RETURN or passphrase)
  - Decrypt share with K
  - Combine with other shares via Shamir reconstruction
- [x] 5.3 Implement "Recover via Bitcoin" flow:
  - Input or scan pre-signed transaction
  - Display OP_RETURN data (K + Nostr event pointer)
  - Auto-fetch encrypted share from Nostr using pointer
  - Decrypt and reconstruct
- [x] 5.4 Make recovery page work offline (embed all crypto libraries)
- [x] 5.5 Write tests for recovery flows

## 6. UI Components

- [x] 6.1 Create `BitcoinSetup.svelte` - wallet connection or key generation UI
- [x] 6.2 Create `BitcoinStatus.svelte` - displays UTXO status, time remaining,
      refresh button
- [x] 6.3 Create `NostrPubkeyInput.svelte` - input for recipient's Nostr pubkey
      (npub)
- [x] 6.4 Create `RecoveryMethodSelector.svelte` - choose recovery path (Nostr,
      Bitcoin, passphrase)
- [x] 6.5 Add Bitcoin/Nostr settings to secret creation form (opt-in for Pro
      users)
- [x] 6.6 Add Bitcoin status indicator to secret detail/view page

## 7. Documentation and Testing

- [x] 7.1 Update recovery kit export to include Bitcoin transaction data and
      Nostr event pointers
- [x] 7.2 Create recipient recovery guide (how to use Bitcoin + Nostr fallback)
- [x] 7.3 Write end-to-end test: create secret with Bitcoin -> simulate timeout
      -> recipient recovers
- [x] 7.4 Write end-to-end test: create secret -> check-in refreshes UTXO ->
      verify old tx invalid
- [x] 7.5 Test quantum-safe recovery path: recover using only passphrase +
      OP_RETURN K (no NIP-44)
- [x] 7.6 Document fee estimates and cost model for users
