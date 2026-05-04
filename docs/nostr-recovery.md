# Nostr disclosure recovery flow

KeyFate uses Nostr as a censorship-resistant disclosure channel. The server can go away after disclosure is broadcast; recipients only need their Nostr private key and public relays.

## Data flow

1. At disclosure time, KeyFate creates one Shamir share per recipient.
2. Each share is encrypted with a fresh 32-byte symmetric key `K` using ChaCha20-Poly1305.
3. `K` is encrypted to the recipient's Nostr pubkey with NIP-44.
4. The encrypted share, nonce, encrypted `K`, secret id, share index, threshold, and total share count are placed in a KeyFate rumor event (`kind 21059`).
5. The rumor is sealed as a NIP-59 seal (`kind 13`) by the KeyFate disclosure key.
6. The seal is wrapped as a NIP-59 gift wrap (`kind 1059`) with a one-time ephemeral pubkey and a `p` tag for the recipient.
7. The gift wrap is broadcast to multiple configured relays. The publish API returns per-relay success/failure status.

This follows NIP-17/NIP-59 private-message structure: rumor -> seal -> gift wrap. KeyFate uses the private wrapper pattern for share delivery, not chat UX.

## Recipient recovery

1. Recipient enters their `nsec` locally on `/recover`.
2. The browser derives the recipient pubkey and queries relays for `kind:1059` events tagged with `#p=<recipient pubkey>`.
3. Selected gift wraps are unwrapped locally:
   - decrypt outer gift wrap with recipient secret key + ephemeral wrapper pubkey
   - decrypt inner seal with recipient secret key + disclosure sender pubkey
4. The browser decrypts `encryptedKNostr` with NIP-44 to recover `K`.
5. The browser decrypts the encrypted share with `K` and the embedded nonce.
6. Once enough shares are recovered, the normal Shamir reconstruction flow can reconstruct the secret.

## Fallbacks

The recovery UI still supports fallback K recovery by passphrase bundle or Bitcoin OP_RETURN when available. Current Nostr disclosure payloads include the nonce and NIP-44 encrypted `K`, so the direct Nostr path does not require manual nonce entry.
