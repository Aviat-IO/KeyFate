/**
 * Bitcoin CSV timelock script construction.
 *
 * Uses OP_CHECKSEQUENCEVERIFY (CSV) for relative timelocks.
 * CSV is relative to UTXO creation time, mapping naturally to
 * "time since last check-in". Refreshing spends the UTXO and
 * recreates it, resetting the clock.
 *
 * Script structure:
 *   OP_IF
 *       <owner_pubkey> OP_CHECKSIG
 *   OP_ELSE
 *       <ttl_blocks> OP_CHECKSEQUENCEVERIFY OP_DROP
 *       <recipient_pubkey> OP_CHECKSIG
 *   OP_ENDIF
 */

import * as btc from "@scure/btc-signer"
import { hex } from "@scure/base"

/** Maximum CSV value using 16-bit encoding (~388 days at 144 blocks/day) */
export const MAX_CSV_BLOCKS = 65535

/** Minimum UTXO amount in satoshis */
export const MIN_UTXO_SATS = 10_000

/** Average blocks per day on Bitcoin */
const BLOCKS_PER_DAY = 144

/**
 * Convert days to approximate block count.
 * 1 day ≈ 144 blocks (6 blocks/hour × 24 hours).
 */
export function daysToBlocks(days: number): number {
  if (days <= 0) throw new Error("Days must be positive")
  const blocks = Math.round(days * BLOCKS_PER_DAY)
  if (blocks > MAX_CSV_BLOCKS) {
    throw new Error(
      `${days} days (${blocks} blocks) exceeds max CSV value of ${MAX_CSV_BLOCKS} blocks (~${blocksToApproxDays(MAX_CSV_BLOCKS)} days)`,
    )
  }
  if (blocks < 1) throw new Error("Duration too short: results in 0 blocks")
  return blocks
}

/**
 * Convert block count to approximate days.
 */
export function blocksToApproxDays(blocks: number): number {
  if (blocks <= 0) throw new Error("Blocks must be positive")
  return blocks / BLOCKS_PER_DAY
}

/**
 * Create a CSV timelock script for the dead man's switch.
 *
 * Owner can spend at any time (IF branch).
 * Recipient can spend after ttlBlocks confirmations (ELSE branch).
 *
 * @param ownerPubkey - Compressed public key (33 bytes)
 * @param recipientPubkey - Compressed public key (33 bytes)
 * @param ttlBlocks - Number of blocks for CSV timelock (1-65535)
 * @returns Encoded script bytes
 */
export function createCSVTimelockScript(
  ownerPubkey: Uint8Array,
  recipientPubkey: Uint8Array,
  ttlBlocks: number,
): Uint8Array {
  if (ownerPubkey.length !== 33) {
    throw new Error(
      `Owner pubkey must be 33 bytes (compressed), got ${ownerPubkey.length}`,
    )
  }
  if (recipientPubkey.length !== 33) {
    throw new Error(
      `Recipient pubkey must be 33 bytes (compressed), got ${recipientPubkey.length}`,
    )
  }
  if (ttlBlocks < 1 || ttlBlocks > MAX_CSV_BLOCKS) {
    throw new Error(
      `ttlBlocks must be between 1 and ${MAX_CSV_BLOCKS}, got ${ttlBlocks}`,
    )
  }
  if (!Number.isInteger(ttlBlocks)) {
    throw new Error(`ttlBlocks must be an integer, got ${ttlBlocks}`)
  }

  const scriptNum = btc.ScriptNum()

  return btc.Script.encode([
    "IF",
    ownerPubkey,
    "CHECKSIG",
    "ELSE",
    scriptNum.encode(BigInt(ttlBlocks)),
    "CHECKSEQUENCEVERIFY",
    "DROP",
    recipientPubkey,
    "CHECKSIG",
    "ENDIF",
  ])
}

/**
 * Create a P2WSH (Pay-to-Witness-Script-Hash) address from a witness script.
 *
 * @param script - The witness script (e.g., CSV timelock script)
 * @param network - Bitcoin network ('mainnet' or 'testnet')
 * @returns bech32 P2WSH address
 */
export function createP2WSHAddress(
  script: Uint8Array,
  network: "mainnet" | "testnet" = "mainnet",
): string {
  const net = network === "testnet" ? btc.TEST_NETWORK : btc.NETWORK
  const p2wshResult = btc.p2wsh(
    { type: "unknown" as const, script },
    net,
  )
  if (!p2wshResult.address) {
    throw new Error("Failed to generate P2WSH address")
  }
  return p2wshResult.address
}

/**
 * Get the P2WSH output script for a witness script.
 * This is the scriptPubKey used in transaction outputs.
 */
export function getP2WSHOutputScript(
  script: Uint8Array,
  network: "mainnet" | "testnet" = "mainnet",
): Uint8Array {
  const net = network === "testnet" ? btc.TEST_NETWORK : btc.NETWORK
  const p2wshResult = btc.p2wsh(
    { type: "unknown" as const, script },
    net,
  )
  return p2wshResult.script
}

/**
 * Decode a CSV timelock script to extract its components.
 * Useful for verification and debugging.
 */
export function decodeCSVTimelockScript(script: Uint8Array): {
  ownerPubkey: Uint8Array
  recipientPubkey: Uint8Array
  ttlBlocks: number
} {
  const decoded = btc.Script.decode(script)
  const scriptNum = btc.ScriptNum()

  // Expected: IF <owner_pub> CHECKSIG ELSE <ttl> CSV DROP <recipient_pub> CHECKSIG ENDIF
  if (decoded.length !== 10) {
    throw new Error(
      `Invalid CSV timelock script: expected 10 elements, got ${decoded.length}`,
    )
  }
  if (decoded[0] !== "IF") throw new Error("Script must start with IF")
  if (decoded[2] !== "CHECKSIG")
    throw new Error("Expected CHECKSIG after owner pubkey")
  if (decoded[3] !== "ELSE") throw new Error("Expected ELSE")
  if (decoded[5] !== "CHECKSEQUENCEVERIFY") throw new Error("Expected CSV")
  if (decoded[6] !== "DROP") throw new Error("Expected DROP after CSV")
  if (decoded[8] !== "CHECKSIG")
    throw new Error("Expected CHECKSIG after recipient pubkey")
  if (decoded[9] !== "ENDIF") throw new Error("Expected ENDIF")

  const ownerPubkey = decoded[1] as Uint8Array
  const recipientPubkey = decoded[7] as Uint8Array
  const ttlBytes = decoded[4] as Uint8Array
  const ttlBlocks = Number(scriptNum.decode(ttlBytes))

  if (!(ownerPubkey instanceof Uint8Array) || ownerPubkey.length !== 33) {
    throw new Error("Invalid owner pubkey in script")
  }
  if (
    !(recipientPubkey instanceof Uint8Array) ||
    recipientPubkey.length !== 33
  ) {
    throw new Error("Invalid recipient pubkey in script")
  }

  return { ownerPubkey, recipientPubkey, ttlBlocks }
}

/**
 * Encode an OP_RETURN script with arbitrary data.
 * Used to embed encrypted key K + Nostr event ID in the transaction.
 *
 * @param data - Data to embed (max 80 bytes for standard relay policy)
 * @returns OP_RETURN script bytes
 */
export function createOpReturnScript(data: Uint8Array): Uint8Array {
  if (data.length > 80) {
    throw new Error(
      `OP_RETURN data too large: ${data.length} bytes (max 80)`,
    )
  }
  return btc.Script.encode(["RETURN", data])
}

/**
 * Create the OP_RETURN payload for a dead man's switch transaction.
 * Contains: encrypted symmetric key K (32 bytes) + Nostr event ID (32 bytes) = 64 bytes.
 *
 * @param symmetricKeyK - 32-byte encrypted symmetric key
 * @param nostrEventId - 32-byte Nostr event ID (hex string, will be decoded)
 * @returns 64-byte payload
 */
export function createOpReturnPayload(
  symmetricKeyK: Uint8Array,
  nostrEventId: string,
): Uint8Array {
  if (symmetricKeyK.length !== 32) {
    throw new Error(
      `Symmetric key must be 32 bytes, got ${symmetricKeyK.length}`,
    )
  }
  if (nostrEventId.length !== 64) {
    throw new Error(
      `Nostr event ID must be 64 hex chars, got ${nostrEventId.length}`,
    )
  }

  const eventIdBytes = hex.decode(nostrEventId)
  const payload = new Uint8Array(64)
  payload.set(symmetricKeyK, 0)
  payload.set(eventIdBytes, 32)
  return payload
}
