# Review Chamber — cryptographic custody

Status: CLOSED

## Round 1 — Attack Ideator

Hypotheses: authenticated global decrypt oracle; application transiently reaches Shamir threshold; plaintext DB token can invoke decryption; GCM tag-length ambiguity.

## Round 2 — Code Tracer

- `/api/decrypt` checks only session existence, accepts arbitrary ciphertext/IV/tag/version, and invokes global `decryptMessage`. REACHABLE.
- Browser posts share 0 to secret creation and a distinct user-managed share to server-side Nostr publication. Default threshold is 2. REACHABLE in normal Nostr-enabled setup.
- `check_in_tokens.token` is plaintext; public server-share route matches exact token, decrypts stored share, and returns plaintext without a session. REACHABLE for read-only DB attacker holding an unexpired row.
- Custom GCM query found implicit tag-length behavior, but application ciphertexts use normal full tags. PARTIAL/no exploit.

## Round 3 — Devil's Advocate

- Global oracle still requires a valid application-key ciphertext tuple; one share remains below threshold. Severity reduced to Medium.
- Threshold claim is not negated by TLS or immediate server encryption because application-process compromise observes both request bodies. Default Nostr path is shipped and normal. No blocking defense.
- DB token path requires read-only DB access and an active token, and still exposes only one factor. Medium.
- No practical truncated-tag forgery was shown; drop GCM signal.

## Round 4 — Chamber Synthesizer

- VALID HIGH: server reaches Shamir threshold (H1).
- VALID MEDIUM: global decrypt oracle (M1).
- VALID MEDIUM variant: DB token unlocks server share (M7).
- DROP: tag-length hardening signal.

Fresh cold verification independently confirmed H1 and challenged severity from Medium upward only after tracing both server-observed shares.
