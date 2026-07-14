# KeyFate vulnerability variant analysis

Commit: `b7b7aef1a897c418e0402acd211fecf0206d8217`

## Objective

Search for sibling instances of every confirmed root-cause pattern, not only the initially reported lines. Results were enriched against route authorization, data provenance, state transitions, and deployment assumptions.

## Variant matrix

| Seed pattern | Search surface | Confirmed variants | Disposition |
|---|---|---|---|
| Global cryptographic primitive exposed across tenant boundary | all `decryptMessage`/key-version call sites and public recovery routes | M1 generic authenticated decrypt; M7 unauthenticated DB-token server-share path | both retained Medium |
| Application transiently receives recovery factors | creation, Nostr publish, Bitcoin/store/export payloads | H1 server observes two 2-of-3 shares | retained High; no third independent threshold path found |
| Untrusted Nostr event accepted after decryption only | kind-1059/13/21059 parsing, relay query, UI selection | missing seal/rumor/trusted-author/recipient binding | retained M2; outer-event case narrowed by `SimplePool` verification |
| State mutation via GET | every GET handler with provider/DB writes | Stripe checkout/customer and BTCPay invoice creation | retained M4; ordinary read-only GETs rejected |
| Read-modify-write counter without atomic guard | rate-limit, attempts, jobs, disclosure state | DB rate limiter lost update/fail-open; export job claim race | M5 security finding; export variant promoted as release blocker |
| Durable processing state without lease/recovery | `triggered`, `processing`, `pending`, in-memory job locks | disclosure permanently stranded; export stranded/duplicated | Critical/High production blockers |
| Entitlement not bound to canonical paid item | Stripe/BTCPay checkout and webhook handlers | arbitrary Stripe active lookup key; BTCPay currency confusion and metadata adapter mismatch | M6 retained; BTCPay recorded as blocker/latent variant |
| Bearer secret in URL/plaintext DB | URLSearchParams, token schema, check-in/server-share routes | check-in token authorizes plaintext server-share retrieval | M7 retained; URL/history/log leakage is an additional exposure condition |
| Sensitive recovery data in browser storage | `localStorage`/`sessionStorage` calls | user shares, Nostr plaintext K, Bitcoin private keys and K | release blocker when combined with absent CSP/sink surface |
| Sanitizer immediately before raw HTML | every `{@html}` and `sanitize-html` use | blog Markdown sink on vulnerable 2.17.3 | dependency/sink confirmed; remote content source absent |
| Arbitrary-email security state mutation | OTP request/verify/reset/account lock paths | verification failure increments victim account state | M3 retained; request endpoint enumeration behavior not promoted separately |
| Tenant authorization based on stale JWT role | admin route group and auth callbacks | role is session/JWT-derived and may be stale until refresh | hardening observation only; no privilege-acquisition primitive established |
| Crypto tag/nonce length ambiguity | AES-GCM and ChaCha20-Poly1305 call sites | custom GCM tag-length signal | not promoted; stored tags are normal 16-byte values and no practical forgery path found |
| Filesystem path construction from request/session data | export generation/delete/download | CodeQL path-injection candidates | rejected for traversal; IDs and filenames are generated; lifecycle still broken |

## Detailed search results

### Cryptographic decryption paths

`decryptMessage` call sites were classified by caller authority and ciphertext provenance. Normal owner-bound routes and cron processing were distinguished from generic/purpose-less routes. Two cross-boundary patterns survived:

1. any authenticated session can supply an arbitrary tuple to `/api/decrypt`;
2. an exact plaintext check-in token can cause the public server-share route to decrypt and return a factor.

No unauthenticated endpoint accepting a completely arbitrary ciphertext tuple was found.

### Custody and threshold paths

All share variables were followed across browser, JSON requests, storage, Nostr publication, export, and recovery. The normal Nostr path is the unique confirmed server-threshold violation. Bitcoin key material remains browser-side, but custody is functionally unusable rather than server-threshold equivalent.

### Nostr validation variants

Checks considered outer ID/signature, recipient p-tag, seal ID/signature, empty seal tags, rumor kind/ID, rumor/seal author consistency, trusted publisher, and payload schema. The recovery function lacks these bindings. Normal relay behavior filters invalid outer signatures, so the strongest variant is a correctly signed attacker-authored outer event containing an attacker-authored seal/rumor.

### Stateful and concurrency variants

Conditional updates were distinguished from unguarded updates:

- disclosure has a real `active` conditional claim, preventing duplicate acquisition, but no post-crash lease recovery;
- export jobs have neither a conditional ownership claim nor stale-processing recovery;
- rate limits use absolute `count + 1` from a stale read and authorize on exceptions.

These are distinct failure effects from one shared root cause: process-local assumptions around durable multi-replica state.

### Billing variants

Stripe webhook signatures and event deduplication are valid controls, but signature does not validate business entitlement. The selected price is not allowlisted at checkout completion. BTCPay's official invoice webhook puts metadata at the top level; the adapter expects `raw.data`, while a fetched full invoice is used only to recover user ID. This breaks subscription creation as shipped. If metadata mapping is repaired without validating price/currency, attacker-controlled currency can reinterpret 9/90 as JPY or another cheap unit.

### Injection variants

- Drizzle query construction did not expose raw SQL injection in reviewed routes.
- Export filesystem alerts were not attacker-controlled path traversal.
- The blog sanitizer bypass is real, but current content provenance is trusted source code.
- No additional `{@html}` path with untrusted input survived review.

## New findings produced by variant analysis

- M7 was promoted from the URL-token/custom-query signal: a read-only DB token is sufficient to invoke application decryption without a session.
- M6 was promoted after following lookup key through checkout and independently ordered Stripe webhook handlers.
- BTCPay's adapter mismatch and latent currency confusion were added as a production blocker rather than a presently exploitable entitlement finding, because the shipped metadata path prevents entitlement first.

## False positives eliminated

- generic CSRF on JSON unsafe methods;
- XFF spoofability without platform evidence;
- export path traversal;
- current unauthenticated blog XSS;
- Nodemailer raw-message advisory reachability;
- devalue sparse-array DoS reachability;
- direct Axios advisory gadgets through fixed SendGrid calls;
- Nostr confidentiality break or recipient-key recovery;
- AES-GCM primitive break.

## Conclusion

The variant pass found sibling business-logic and state-machine failures but no additional independent Critical/High remote injection/RCE class. The dominant systemic themes are trust-domain custody, missing protocol binding, durable job ownership/recovery, and entitlement binding—not low-level memory or parser exploitation.
