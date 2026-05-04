# Bitcoin timelock demo

Issue #6 preview: reproducible CSV timelock output for signet/testnet.

## Run

```bash
cd frontend
bun install --frozen-lockfile
bun run bitcoin:timelock-demo
```

Options:

```bash
bun run bitcoin:timelock-demo -- --network=signet --days=7 --amount-sats=10000
bun run bitcoin:timelock-demo -- --network=testnet --days=30 --owner-seed=demo-owner --recipient-seed=demo-recipient
```

Default output is deterministic JSON. It includes:

- owner and recipient compressed pubkeys
- CSV witness script hex
- P2WSH scriptPubKey hex
- signet/testnet `tb1...` funding address
- amount and relative lock duration in blocks

Default vector:

```text
network: signet
amountSats: 10000
ttlBlocks: 1008
p2wshAddress: tb1qgzmrzku92ztk2dz4enl3xgrggtynhs0gphsat4m4yfh3d8dl0waqzjqfkw
p2wshScriptPubKeyHex: 002040b6315b855097653455ccff13206842c93bc1e80de1d5d775226f169dbf7bba
witnessScriptHex: 6321031f3800ebe1883a58030fe80088fad6a889527c3e57c6e832cdfe842c846112c5ac6702f003b2752103a380a59d1c5050a69d1b2f94871582ddc59e63897a0ccc13b64043b352a90efbac68
```

Signet uses testnet address parameters, so signet and testnet addresses both use `tb1`.

## Script policy

The witness script is:

```text
OP_IF
  <owner_pubkey> OP_CHECKSIG
OP_ELSE
  <ttl_blocks> OP_CHECKSEQUENCEVERIFY OP_DROP
  <recipient_pubkey> OP_CHECKSIG
OP_ENDIF
```

- Owner path: spend any time with the owner key.
- Recipient path: spend only after the funding UTXO has aged by `ttl_blocks` confirmations.

## CSV vs CLTV

KeyFate uses CSV in this preview because it maps to a dead-man switch refresh model.

- CSV is relative. The timer starts when the UTXO confirms. Refreshing means spending into a new CSV UTXO, which resets the clock.
- CLTV is absolute. It unlocks at a fixed block height or timestamp. It is simpler for one-shot vesting, but bad for rolling check-ins because every refresh needs a new absolute target and pre-signed paths can expire operationally.
- CSV block counts are approximate wall-clock time. `144` blocks is roughly one day, not exactly one day.

## How this complements Nostr disclosure

Nostr stores and relays the encrypted disclosure payload. Bitcoin timelocks can add an independent, consensus-enforced timing condition for when a recipient spend path becomes valid.

A production design can use both:

1. Nostr relays hold encrypted recovery data and recipient metadata.
2. A Bitcoin CSV output enforces that recipient-controlled spending cannot happen until the owner misses the refresh window.
3. OP_RETURN or transaction metadata can point to encrypted Nostr material without putting plaintext secrets on-chain.

This does not make Nostr availability guaranteed. Recipients still need relay discovery, redundant relays, backups, and recovery instructions.

## Limitations and caveats

This is a preview scaffold, not production custody software.

- The default seeds are public test vectors. Never fund them with real value.
- The script generates a timelocked output/address, not a live wallet-funded PSBT or broadcast transaction.
- Mainnet use needs wallet integration, coin selection, fee estimation, RBF/CPFP policy, dust handling, and UTXO monitoring.
- Recipient spend construction needs end-to-end wallet tests against signet/testnet nodes before any production claim.
- CSV depends on confirmations and mempool policy; unconfirmed funding outputs do not start the reliable relative-lock countdown.
- Key backup and revocation/rotation UX are unsolved here.
- On-chain metadata is public forever; never place plaintext secrets or sensitive recipient details on-chain.
