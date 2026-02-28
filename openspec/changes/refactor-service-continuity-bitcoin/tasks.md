## 1. Nostr Integration (Refine from add-service-continuity)

- [ ] 1.1 Add `nostr-tools` dependency (`bun add nostr-tools`)
- [ ] 1.2 Create `src/lib/nostr/client.ts` - relay pool management, event
      publishing, event querying
- [ ] 1.3 Create `src/lib/nostr/keypair.ts` - Nostr keypair generation for users
      (optional, can use existing keys)
- [ ] 1.4 Create `src/lib/nostr/encryption.ts` - NIP-44 encryption/decryption
      wrapper
- [ ] 1.5 Create `src/lib/nostr/gift-wrap.ts` - NIP-59 Gift Wrap event
      construction
- [ ] 1.6 Create `src/lib/nostr/relay-config.ts` - recommended relay list and
      health checking
- [ ] 1.7 Add `nostr_pubkey` column to `secret_recipients` table in Drizzle
      schema
- [ ] 1.8 Generate Drizzle migration for schema change
      (`bunx drizzle-kit generate --name="add_nostr_pubkey"`)
- [ ] 1.9 Create API endpoint for recipient Nostr pubkey management
- [ ] 1.10 Write tests for Nostr client, encryption, and gift wrap modules

## 2. Double Encryption Layer

- [ ] 2.1 Add `@noble/ciphers` dependency (ChaCha20-Poly1305)
- [ ] 2.2 Create `src/lib/crypto/symmetric.ts` - generate random key K,
      encrypt/decrypt with ChaCha20-Poly1305
- [ ] 2.3 Create `src/lib/crypto/double-encrypt.ts` - orchestrate double
      encryption:
  - Encrypt share with K (ChaCha20)
  - Encrypt K with NIP-44 (Nostr pubkey)
  - Optionally encrypt K with passphrase (PBKDF2 + AES-256-GCM)
- [ ] 2.4 Create `src/lib/crypto/recovery.ts` - three-path K recovery:
  - From Bitcoin OP_RETURN
  - From NIP-44 decryption
  - From passphrase
- [ ] 2.5 Write tests for all crypto modules (symmetric, double-encrypt,
      recovery)

## 3. Bitcoin CSV Timelock

- [ ] 3.1 Add `bitcoinjs-lib` and `ecpair` dependencies (or `@noble/secp256k1` +
      manual script)
- [ ] 3.2 Verify `bitcoinjs-lib` compatibility with Bun runtime
- [ ] 3.3 Create `src/lib/bitcoin/script.ts` - CSV timelock script construction:
  - Owner path (spend anytime)
  - Recipient path (spend after timeout)
- [ ] 3.4 Create `src/lib/bitcoin/transaction.ts` - UTXO creation, pre-signed
      recipient tx with OP_RETURN
- [ ] 3.5 Create `src/lib/bitcoin/refresh.ts` - check-in refresh: spend UTXO via
      owner path, recreate with new script
- [ ] 3.6 Create `src/lib/bitcoin/broadcast.ts` - transaction broadcasting via
      public APIs (mempool.space, blockstream.info)
- [ ] 3.7 Create `src/lib/bitcoin/fee-estimation.ts` - fee rate estimation from
      public APIs
- [ ] 3.8 Create `bitcoin_utxos` table in Drizzle schema (tracks active
      timelocked UTXOs per secret)
- [ ] 3.9 Generate Drizzle migration
      (`bunx drizzle-kit generate --name="add_bitcoin_utxos"`)
- [ ] 3.10 Write tests for script construction, transaction building, refresh
      logic

## 4. Secret Creation Flow (Bitcoin + Nostr)

- [ ] 4.1 Modify secret creation API to optionally trigger Nostr share
      publishing
- [ ] 4.2 Create API endpoint: `POST /api/secrets/[id]/enable-bitcoin` - creates
      timelocked UTXO
- [ ] 4.3 Create API endpoint: `POST /api/secrets/[id]/refresh-bitcoin` -
      refresh UTXO (check-in)
- [ ] 4.4 Create API endpoint: `GET /api/secrets/[id]/bitcoin-status` - UTXO
      status, time remaining
- [ ] 4.5 Modify check-in flow to optionally refresh Bitcoin UTXO alongside
      server check-in
- [ ] 4.6 Store pre-signed recipient transaction (encrypted, in DB or delivered
      to recipient)
- [ ] 4.7 Write integration tests for the full Bitcoin-enabled secret lifecycle

## 5. Recipient Recovery UI

- [ ] 5.1 Create `src/routes/recover/+page.svelte` - standalone recovery page
- [ ] 5.2 Implement "Recover via Nostr" flow:
  - Input recipient nsec (or use browser extension)
  - Query relays for Gift Wrapped events tagged to recipient
  - Decrypt with NIP-44 to get encrypted share
  - Prompt for K (from Bitcoin OP_RETURN or passphrase)
  - Decrypt share with K
  - Combine with other shares via Shamir reconstruction
- [ ] 5.3 Implement "Recover via Bitcoin" flow:
  - Input or scan pre-signed transaction
  - Display OP_RETURN data (K + Nostr event pointer)
  - Auto-fetch encrypted share from Nostr using pointer
  - Decrypt and reconstruct
- [ ] 5.4 Make recovery page work offline (embed all crypto libraries)
- [ ] 5.5 Write tests for recovery flows

## 6. UI Components

- [ ] 6.1 Create `BitcoinSetup.svelte` - wallet connection or key generation UI
- [ ] 6.2 Create `BitcoinStatus.svelte` - displays UTXO status, time remaining,
      refresh button
- [ ] 6.3 Create `NostrPubkeyInput.svelte` - input for recipient's Nostr pubkey
      (npub)
- [ ] 6.4 Create `RecoveryMethodSelector.svelte` - choose recovery path (Nostr,
      Bitcoin, passphrase)
- [ ] 6.5 Add Bitcoin/Nostr settings to secret creation form (opt-in for Pro
      users)
- [ ] 6.6 Add Bitcoin status indicator to secret detail/view page

## 7. Documentation and Testing

- [ ] 7.1 Update recovery kit export to include Bitcoin transaction data and
      Nostr event pointers
- [ ] 7.2 Create recipient recovery guide (how to use Bitcoin + Nostr fallback)
- [ ] 7.3 Write end-to-end test: create secret with Bitcoin -> simulate timeout
      -> recipient recovers
- [ ] 7.4 Write end-to-end test: create secret -> check-in refreshes UTXO ->
      verify old tx invalid
- [ ] 7.5 Test quantum-safe recovery path: recover using only passphrase +
      OP_RETURN K (no NIP-44)
- [ ] 7.6 Document fee estimates and cost model for users
