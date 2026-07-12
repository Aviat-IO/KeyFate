# Review Chamber — Nostr and Bitcoin recovery

Status: CLOSED

## Round 1 — Attack Ideator

Hypotheses: invalid/attacker-authored NIP-59 events accepted; Nostr production envelope incompatible with UI; Bitcoin recipient key custody strands recovery; OP_RETURN parser ambiguity.

## Round 2 — Code Tracer

- `unwrapGiftWrap` checks outer kind 1059 and seal kind 13, then parses rumor content. It omits outer/recipient, seal signature/ID/tags, rumor kind/ID/author, trusted publisher, and schema binding. REACHABLE.
- Publisher stores JSON `{encryptedShare, nonce, encryptedKNostr}` in payload.share. UI treats entire string as ciphertext hex, requires separate nonce, and never calls implemented Nostr K recovery. Legitimate round trip fails. REACHABLE functional blocker.
- Bitcoin setup always returns at all-zero placeholder. If removed, both owner/recipient keys live only in owner's session storage and recipient destination key is never transferred. REACHABLE functional/custody blocker.
- OP_RETURN parser has structural checks; no separate medium exploit survived.

## Round 3 — Devil's Advocate

- `nostr-tools` `SimplePool` normally verifies outer event signatures, so invalid outer events are filtered in the UI. This does not authenticate the seal or expected publisher; attacker-signed events remain viable. Medium.
- ChaCha20-Poly1305 rejects garbage produced when JSON is parsed as hex, preventing silent wrong plaintext but confirming legitimate recovery failure.
- Pre-signed Bitcoin transaction spends the timelock input without recipient key, but its output itself is controlled by the undistributed key, so custody remains broken.

## Round 4 — Chamber Synthesizer

- VALID MEDIUM: NIP-59/application authenticity and binding gap (M2).
- HIGH release blocker: Nostr publisher/recovery contract mismatch.
- HIGH release blocker: Bitcoin disabled and unsafe custody.
- DROP: standalone OP_RETURN exploit.

Local invalid-seal PoC and fresh cold protocol review supported the dispositions.
