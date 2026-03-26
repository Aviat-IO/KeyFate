## 1. NIP-44 Encryption

- [x] 1.1 Implement conversation key derivation wrapper in `src/lib/nostr/encryption.ts`
- [x] 1.2 Implement NIP-44 v2 encrypt function
- [x] 1.3 Implement NIP-44 v2 decrypt function

## 2. Nostr Keypair Management

- [x] 2.1 Implement keypair generation (generateSecretKey + getPublicKey) in `src/lib/nostr/keypair.ts`
- [x] 2.2 Implement NIP-19 encoding/decoding (npub, nsec)
- [x] 2.3 Implement pubkey format validation (npub and hex)

## 3. Relay Configuration

- [x] 3.1 Define default relay list (10 relays) in `src/lib/nostr/relay-config.ts`
- [x] 3.2 Define minimum publish relay threshold (3)
- [x] 3.3 Implement single relay health check via WebSocket probe
- [x] 3.4 Implement bulk healthy relay discovery sorted by latency

## 4. Nostr Client

- [x] 4.1 Implement NostrClient wrapper around SimplePool in `src/lib/nostr/client.ts`
- [x] 4.2 Implement publish method with allSettled and minimum relay threshold warning
- [x] 4.3 Implement query and get methods for event retrieval
- [x] 4.4 Implement connection cleanup (close)

## 5. NIP-59 Gift Wrap

- [x] 5.1 Define custom rumor kind 21059 and SharePayload interface in `src/lib/nostr/gift-wrap.ts`
- [x] 5.2 Implement rumor creation (unsigned event with computed ID)
- [x] 5.3 Implement seal creation (kind 13, signed by real author, encrypted to recipient)
- [x] 5.4 Implement gift wrap creation (kind 1059, ephemeral key, p-tag for recipient)
- [x] 5.5 Implement full pipeline `wrapShareForRecipient` (rumor -> seal -> gift wrap)

## 6. Double Encryption

- [x] 6.1 Implement `doubleEncryptShare` orchestrator in `src/lib/crypto/double-encrypt.ts`
- [x] 6.2 Generate random 32-byte symmetric key K
- [x] 6.3 Encrypt share with K via ChaCha20-Poly1305
- [x] 6.4 Encrypt K via NIP-44 for Nostr recovery path
- [x] 6.5 Optionally encrypt K via PBKDF2+AES-256-GCM for passphrase recovery path
- [x] 6.6 Return plaintext K for Bitcoin OP_RETURN storage

## 7. Nostr Publisher Service

- [x] 7.1 Implement `publishSharesToNostr` in `src/lib/services/nostr-publisher.ts`
- [x] 7.2 Build recipient lookup map (filter by nostrPubkey presence)
- [x] 7.3 Per-recipient: double-encrypt, gift-wrap, publish to relays
- [x] 7.4 Return published event IDs, skipped recipients, and errors

## 8. Database Schema

- [x] 8.1 Add `nostr_pubkey` nullable text column to recipients table
- [x] 8.2 Generate migration via `drizzle-kit generate`

## 9. K Recovery from Nostr

- [x] 9.1 Implement `recoverKFromNostr` in `src/lib/crypto/recovery.ts`
- [x] 9.2 Decrypt NIP-44 payload to recover K hex, convert to 32-byte key

## 10. Recovery UI

- [x] 10.1 Implement NostrRecoveryStep component with nsec input, relay search, event selection, unwrapping
- [x] 10.2 Implement K recovery sub-flow (via passphrase or OP_RETURN) after unwrapping
- [x] 10.3 Integrate Nostr recovery into `/recover` page

## 11. Testing

- [x] 11.1 Unit tests for NIP-44 encryption/decryption
- [x] 11.2 Unit tests for gift wrap construction (rumor, seal, gift wrap layers)
- [x] 11.3 Unit tests for double-encrypt orchestrator
- [x] 11.4 Unit tests for nostr-publisher service (mocked relay/client)
- [x] 11.5 Unit tests for K recovery from Nostr path
- [x] 11.6 Unit tests for keypair generation and NIP-19 encoding
