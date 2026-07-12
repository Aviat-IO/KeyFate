# PoC — server-received shares reach threshold

PoC-Status: theoretical

The local proof uses the shipped `shamirs-secret-sharing` package:

```ts
const shares = split(Buffer.from(secret), { shares: 3, threshold: 2 });
combine([shares[0], shares[1]]);
```

It returned `recoveredMatches: true`; see `evidence/shamir-reconstruction.log`.

Source tracing shows that these exact roles cross the server boundary during one Nostr-enabled setup:

1. `shares[0]` is posted as `serverShare` to `/api/secrets`.
2. `userManagedShares[0]` (normally `shares[1]`) is posted to `/publish-nostr`.
3. The server encrypts/publishes the second share only after receiving it.

No production secret was accessed or reconstructed.
