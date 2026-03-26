## Context

KeyFate's core dead man's switch relies on server-side email delivery, which is vulnerable to censorship, service outages, and provider de-platforming. Bitcoin's OP_CHECKSEQUENCEVERIFY (CSV) opcode enables relative timelocks that map naturally to "time since last check-in", providing a fully trustless disclosure mechanism.

The Bitcoin layer is one of three independent paths for recovering the symmetric key K used to decrypt double-encrypted Shamir shares. It operates alongside NIP-44 Nostr decryption and passphrase-based PBKDF2 recovery.

## Goals / Non-Goals

- Goals:
  - Trustless, censorship-resistant secret delivery via Bitcoin P2WSH
  - Client-side key generation (keys never leave the browser)
  - Refresh (check-in) via owner-path spend + UTXO recreation
  - Pre-signed recipient transaction that becomes valid after CSV timeout
  - OP_RETURN embedding of symmetric key K and Nostr event ID (64 bytes total)
  - Cron-based UTXO confirmation tracking
  - Recovery UI for extracting K from pre-signed transaction hex

- Non-Goals:
  - Multi-signature schemes (single owner + single recipient per UTXO)
  - Taproot or P2TR scripts (uses P2WSH for broader wallet compatibility)
  - Automatic UTXO top-up or fee management
  - Hardware wallet integration
  - Lightning Network support

## Decisions

- **P2WSH over P2TR**: P2WSH has broader ecosystem support and simpler witness construction. Taproot could reduce fees but adds implementation complexity.
- **CSV over CLTV**: CSV (relative timelock) resets naturally when the UTXO is spent and recreated, mapping directly to check-in intervals. CLTV (absolute timelock) would require recalculating block heights.
- **Client-side signing only**: Private keys are generated via `crypto.getRandomValues` and stored in `sessionStorage`. They never touch the server. This preserves the zero-knowledge architecture.
- **mempool.space primary, blockstream.info fallback**: Both are public, free APIs with reasonable rate limits. Fallback ensures availability.
- **Hardcoded fee estimation defaults**: When mempool.space is unavailable, conservative defaults (5/20/50 sat/vbyte) prevent transaction failures.
- **@scure/btc-signer**: Audited, minimal Bitcoin library from the same team as @noble/curves. No dependency on bitcoinjs-lib.

## Risks / Trade-offs

- **UTXO depletion**: Each refresh costs a mining fee, reducing the UTXO amount. `estimateRefreshesRemaining` provides visibility but users must fund adequately. Mitigation: UI displays remaining refreshes.
- **Fee volatility**: Pre-signed recipient transactions use estimated fees that may be too low when the timelock expires. Mitigation: users can choose fee priority at creation time.
- **CSV max ~388 days**: 16-bit CSV encoding limits to 65535 blocks (~455 days). Mitigation: `daysToBlocks` throws if exceeded; documented limit.
- **No network stored per UTXO**: The `bitcoin_utxos` table lacks a network column. The cron job defaults to mainnet. Mitigation: `BITCOIN_NETWORK` env var for now; schema migration needed for multi-network.
- **Pre-signed tx becomes stale**: If fee rates increase significantly between creation and timelock expiry, the pre-signed tx may not propagate. Mitigation: document risk; future CPFP support.

## Migration Plan

1. Schema migration adds `bitcoin_utxos` table (generated via `drizzle-kit generate`)
2. Feature is opt-in per secret; no changes to existing email-only secrets
3. No data migration required
4. Rollback: drop `bitcoin_utxos` table; remove cron job registration

## Open Questions

- Should the `bitcoin_utxos` table store the network (mainnet/testnet) per row?
- Should there be a minimum UTXO amount enforced at the API level beyond the 10,000 sat script-level minimum?
- How should the pre-signed recipient transaction be delivered to the recipient (email attachment, recovery kit download, or both)?
