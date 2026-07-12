# KeyFate local penetration-test and PoC report

Target commit: `b7b7aef1a897c418e0402acd211fecf0206d8217`  
Test mode: local, non-destructive, credentialless  
Production systems tested: none

## Rules of engagement

- Canonical tracked source only.
- No production account, database, key, provider, relay, or Bitcoin transaction.
- No persistence or application-source changes.
- Synthetic markers only.
- Provider-dependent tests remained blocked/theoretical.

## Test matrix

| Test | Environment | Result | Impact established |
|---|---|---|---|
| Shamir 2-of-3 reconstruction | local shipped library | PASS | two roles observed by the server are mathematically sufficient |
| Generic `/api/decrypt` route | local route harness + real AES implementation | PASS | unrelated authenticated identity received chosen plaintext |
| NIP-59 invalid seal | local production recovery library | PASS | invalid-signature seal yielded attacker-controlled share |
| `sanitize-html` XMP bypass | local installed dependency + exact allowlist | PASS | script/event-handler output survives sanitization |
| OTP account lockout | source/state trace only | NOT EXECUTED | public invalid attempts reach persistent victim lock state |
| Checkout GET side effects | source/provider trace only | NOT EXECUTED | cross-site top-level navigation reaches provider creation |
| Rate-limit lost update | source/concurrency trace only | NOT EXECUTED | parallel reads can collapse N increments into one |
| Stripe lookup-key bypass | live test catalog required | BLOCKED | code accepts any active recurring lookup key; production catalog unknown |
| DB token → server share | disposable DB/app required | NOT EXECUTED | public route directly decrypts for exact plaintext token |
| BTCPay payment flow | disposable BTCPay required | BLOCKED | adapter/payload contract and currency validation defects confirmed statically |

## Executed PoCs

### PT-01 — Shamir threshold proof

The installed `shamirs-secret-sharing` package generated three shares at threshold two. Combining indexes 0 and 1 recovered the synthetic marker exactly.

Evidence: [`../H1-server-reaches-shamir-threshold/evidence/shamir-reconstruction.log`](../H1-server-reaches-shamir-threshold/evidence/shamir-reconstruction.log).

The executable proof demonstrates the math; source tracing establishes that the server sees those two roles during a normal Nostr-enabled creation. No real user secret was processed.

### PT-02 — application-key decryption oracle

A local Bun harness imported the actual route handler and encryption module, supplied an authenticated session for an identity unrelated to the synthetic ciphertext, and submitted ciphertext/IV/tag. The handler returned HTTP 200 and the original marker.

Evidence: [`../M1-global-decryption-oracle/evidence/decrypt-oracle-poc.log`](../M1-global-decryption-oracle/evidence/decrypt-oracle-poc.log).

Security controls checked:

- session requirement exists;
- no secret ownership lookup exists;
- no purpose/context binding exists;
- key selection is global by version.

### PT-03 — NIP-59 authenticity failure

The local flow created decryptable test material but corrupted the seal ID/signature. The production unwrap function returned the injected share instead of rejecting the event.

Evidence: [`../M2-nip59-unverified-recovery-events/evidence/nip59-poc.log`](../M2-nip59-unverified-recovery-events/evidence/nip59-poc.log).

The normal relay client is credited with outer-event verification. The test targets missing seal/rumor/application-author binding, which outer verification does not provide.

### PT-04 — sanitizer bypass

Using the exact allowlist from the blog page and installed `sanitize-html@2.17.3`, XMP-wrapped script and image-event payloads emerged as active HTML.

Evidence: [`sanitize-html-advisory/evidence/sanitize-html-poc.log`](sanitize-html-advisory/evidence/sanitize-html-poc.log).

Current content is source-controlled, so remote exploitability was not claimed.

## Theoretical/blocked tests

Detailed safe reproduction instructions and prerequisites are stored beside each finding:

- [`M3 OTP lockout`](../M3-otp-lockout-dos/poc.md)
- [`M4 checkout GET`](../M4-state-changing-checkout-get/poc.md)
- [`M5 rate-limit race`](../M5-rate-limit-race/poc.md)
- [`M6 Stripe price`](../M6-stripe-price-allowlist-bypass/poc.md)
- [`M7 DB token`](../M7-db-token-unlocks-server-share/poc.md)

## Negative results / defenses credited

- No SQL injection survived Drizzle/source-to-sink review.
- No attacker-controlled export path traversal survived enrichment.
- Generic custom-CSRF claims for JSON unsafe methods were rejected due SvelteKit origin checks/cookie behavior.
- No live HEAD secret was confirmed.
- No command injection, SSRF, or direct unauthenticated application-key decryption path was established.
- Normal Nostr relay client outer-event verification narrows the invalid-outer-signature case.
- Shamir threshold limits the direct impact of a single decrypted server share.

## Conclusion

The local tests reproduced the highest-value cryptographic and browser-sink claims without touching production. Provider, concurrent-database, and deployment-failure tests remain mandatory staging gates because the audited repository already shows unsafe control flow and no external environment was available.
