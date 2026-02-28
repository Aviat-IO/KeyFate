/**
 * Recovery flow orchestration for the recipient recovery UI.
 *
 * Provides testable, pure-logic functions for each recovery path:
 * 1. Nostr gift-wrap unwrapping and share extraction
 * 2. Bitcoin OP_RETURN parsing and K extraction
 * 3. Passphrase-based K recovery
 *
 * These functions are decoupled from the UI so they can be unit-tested.
 */

import { getConversationKey, decrypt as nip44Decrypt } from "$lib/nostr/encryption"
import type { Event as NostrEvent } from "nostr-tools/core"
import * as nip19 from "nostr-tools/nip19"
import { recoverKFromOpReturn, decryptShare } from "$lib/crypto/recovery"
import {
  deriveKeyFromPassphrase,
  decryptWithDerivedKey,
} from "$lib/crypto/passphrase"

// ─── Types ───────────────────────────────────────────────────────────────────

/** Decoded share payload from a gift-wrapped Nostr event. */
export interface UnwrappedShare {
  /** The encrypted share data (base64 or hex) */
  share: string
  /** KeyFate secret ID */
  secretId: string
  /** 1-based share index */
  shareIndex: number
  /** Minimum shares needed to reconstruct */
  threshold: number
  /** Total number of shares */
  totalShares: number
  /** Schema version */
  version: number
}

/** A gift-wrapped event with metadata for display. */
export interface FoundGiftWrap {
  /** The raw Nostr event */
  event: NostrEvent
  /** Timestamp of the gift wrap */
  createdAt: number
  /** Ephemeral pubkey of the gift wrap */
  senderPubkey: string
}

/** Result of parsing a Bitcoin transaction for OP_RETURN data. */
export interface OpReturnData {
  /** The 32-byte symmetric key K */
  symmetricKeyK: Uint8Array
  /** The 32-byte Nostr event ID (hex) */
  nostrEventId: string
}

/** A fully decrypted share ready for display. */
export interface DecryptedShareResult {
  /** The plaintext share data */
  share: string
  /** Share index (1-based) */
  shareIndex: number
  /** Threshold needed */
  threshold: number
  /** Total shares */
  totalShares: number
  /** Secret ID */
  secretId: string
}

// ─── Nostr Recovery ──────────────────────────────────────────────────────────

/**
 * Decode an nsec string to a raw secret key (Uint8Array).
 *
 * @throws If the input is not a valid nsec
 */
export function nsecToSecretKey(nsec: string): Uint8Array {
  const decoded = nip19.decode(nsec.trim())
  if (decoded.type !== "nsec") {
    throw new Error(`Expected nsec, got ${decoded.type}`)
  }
  return decoded.data
}

/**
 * Validate that a string is a well-formed nsec.
 */
export function isValidNsec(value: string): boolean {
  try {
    nsecToSecretKey(value)
    return true
  } catch {
    return false
  }
}

/**
 * Unwrap a NIP-59 gift-wrapped event to extract the inner rumor payload.
 *
 * Performs the two-layer decryption:
 * 1. Decrypt gift wrap (kind 1059) → seal (kind 13)
 * 2. Decrypt seal → rumor (kind 21059)
 *
 * @param giftWrap - The kind 1059 gift-wrapped event
 * @param recipientSecretKey - Recipient's secret key
 * @returns The parsed share payload from the rumor
 * @throws If decryption fails or payload is malformed
 */
export function unwrapGiftWrap(
  giftWrap: NostrEvent,
  recipientSecretKey: Uint8Array,
): UnwrappedShare {
  if (giftWrap.kind !== 1059) {
    throw new Error(`Expected kind 1059 gift wrap, got kind ${giftWrap.kind}`)
  }

  // Layer 1: Decrypt gift wrap to get the seal
  const wrapConvKey = getConversationKey(recipientSecretKey, giftWrap.pubkey)
  const sealJson = nip44Decrypt(giftWrap.content, wrapConvKey)
  const seal = JSON.parse(sealJson)

  if (seal.kind !== 13) {
    throw new Error(`Expected kind 13 seal, got kind ${seal.kind}`)
  }

  // Layer 2: Decrypt seal to get the rumor
  const sealConvKey = getConversationKey(recipientSecretKey, seal.pubkey)
  const rumorJson = nip44Decrypt(seal.content, sealConvKey)
  const rumor = JSON.parse(rumorJson)

  // Parse the rumor content as a share payload
  const payload = JSON.parse(rumor.content)

  return {
    share: payload.share,
    secretId: payload.secretId,
    shareIndex: payload.shareIndex,
    threshold: payload.threshold,
    totalShares: payload.totalShares,
    version: payload.version,
  }
}

// ─── Bitcoin Recovery ────────────────────────────────────────────────────────

/**
 * Parse a hex-encoded Bitcoin transaction to extract OP_RETURN data.
 *
 * Looks for an output with OP_RETURN (0x6a) containing exactly 64 bytes:
 * - First 32 bytes: symmetric key K
 * - Last 32 bytes: Nostr event ID
 *
 * @param txHex - Hex-encoded raw transaction
 * @returns The extracted K and Nostr event ID
 * @throws If no valid OP_RETURN output is found
 */
export function parseOpReturnFromTx(txHex: string): OpReturnData {
  const txBytes = hexToBytes(txHex)

  // Use a minimal transaction parser to find OP_RETURN outputs.
  // Bitcoin tx format: version(4) + inputs + outputs + locktime(4)
  // We use @scure/btc-signer's RawTx decoder.
  let rawTx: { outputs: Array<{ script: Uint8Array; amount: bigint }> }
  try {
    // Dynamic import would be async; instead we parse manually for the OP_RETURN
    // Since we have @scure/btc-signer available, we import it at module level
    rawTx = parseRawTx(txBytes)
  } catch (e) {
    throw new Error(`Failed to parse transaction: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Find the OP_RETURN output
  for (const output of rawTx.outputs) {
    if (output.script.length > 0 && output.script[0] === 0x6a) {
      // OP_RETURN found - extract the data payload
      const data = extractOpReturnData(output.script)
      if (data.length === 64) {
        return {
          symmetricKeyK: data.slice(0, 32),
          nostrEventId: bytesToHex(data.slice(32)),
        }
      }
    }
  }

  throw new Error("No valid OP_RETURN output found with 64-byte payload")
}

/**
 * Extract the data payload from an OP_RETURN script.
 *
 * OP_RETURN scripts: 0x6a <push_opcode> <data>
 * For data <= 75 bytes, push opcode is the length byte.
 * For data 76-255 bytes, push opcode is 0x4c followed by length byte.
 */
function extractOpReturnData(script: Uint8Array): Uint8Array {
  if (script[0] !== 0x6a) {
    throw new Error("Not an OP_RETURN script")
  }

  let offset = 1
  if (offset >= script.length) return new Uint8Array(0)

  const pushByte = script[offset]
  offset++

  if (pushByte <= 75) {
    // Direct push: pushByte is the length
    return script.slice(offset, offset + pushByte)
  } else if (pushByte === 0x4c) {
    // OP_PUSHDATA1: next byte is length
    if (offset >= script.length) return new Uint8Array(0)
    const len = script[offset]
    offset++
    return script.slice(offset, offset + len)
  }

  return new Uint8Array(0)
}

/**
 * Minimal Bitcoin raw transaction parser.
 *
 * Parses just enough to extract outputs and their scripts.
 * Handles both legacy and segwit (witness) transactions.
 */
function parseRawTx(
  bytes: Uint8Array,
): { outputs: Array<{ script: Uint8Array; amount: bigint }> } {
  let offset = 0

  function readUint32LE(): number {
    const val =
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    offset += 4
    return val >>> 0
  }

  function readUint64LE(): bigint {
    const lo = BigInt(readUint32LE())
    const hi = BigInt(readUint32LE())
    return (hi << 32n) | lo
  }

  function readVarInt(): number {
    const first = bytes[offset]
    offset++
    if (first < 0xfd) return first
    if (first === 0xfd) {
      const val = bytes[offset] | (bytes[offset + 1] << 8)
      offset += 2
      return val
    }
    if (first === 0xfe) {
      const val = readUint32LE()
      return val
    }
    // 0xff - 8 byte, but we don't expect this for tx counts
    throw new Error("VarInt too large")
  }

  function readBytes(n: number): Uint8Array {
    const result = bytes.slice(offset, offset + n)
    offset += n
    return result
  }

  // Version
  readUint32LE()

  // Check for segwit marker
  let isSegwit = false
  if (bytes[offset] === 0x00 && bytes[offset + 1] === 0x01) {
    isSegwit = true
    offset += 2
  }

  // Inputs
  const inputCount = readVarInt()
  for (let i = 0; i < inputCount; i++) {
    readBytes(32) // prev txid
    readUint32LE() // prev vout
    const scriptLen = readVarInt()
    readBytes(scriptLen) // scriptSig
    readUint32LE() // sequence
  }

  // Outputs
  const outputCount = readVarInt()
  const outputs: Array<{ script: Uint8Array; amount: bigint }> = []
  for (let i = 0; i < outputCount; i++) {
    const amount = readUint64LE()
    const scriptLen = readVarInt()
    const script = readBytes(scriptLen)
    outputs.push({ script, amount })
  }

  // We don't need witness data or locktime for our purposes

  return { outputs }
}

// ─── Passphrase Recovery ─────────────────────────────────────────────────────

/**
 * Parse a JSON-encoded encrypted K bundle from a recovery kit.
 *
 * Expected format:
 * {
 *   "ciphertext": "<base64>",
 *   "nonce": "<base64>",
 *   "salt": "<base64>"
 * }
 */
export function parseEncryptedKBundle(
  bundleJson: string,
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {
  let parsed: { ciphertext: string; nonce: string; salt: string }
  try {
    parsed = JSON.parse(bundleJson)
  } catch {
    throw new Error("Invalid JSON: could not parse encrypted K bundle")
  }

  if (!parsed.ciphertext || !parsed.nonce || !parsed.salt) {
    throw new Error(
      "Invalid bundle: must contain ciphertext, nonce, and salt fields",
    )
  }

  return {
    ciphertext: base64ToBytes(parsed.ciphertext),
    nonce: base64ToBytes(parsed.nonce),
    salt: base64ToBytes(parsed.salt),
  }
}

/**
 * Recover K from a passphrase and encrypted K bundle.
 *
 * @param passphrase - The passphrase
 * @param bundle - JSON-encoded encrypted K bundle
 * @returns The 32-byte symmetric key K
 */
export async function recoverKWithPassphrase(
  passphrase: string,
  bundle: { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array },
): Promise<Uint8Array> {
  const { key: derivedKey } = await deriveKeyFromPassphrase(
    passphrase,
    bundle.salt,
  )
  const K = await decryptWithDerivedKey(bundle.ciphertext, bundle.nonce, derivedKey)

  if (K.length !== 32) {
    throw new Error(`Recovered K must be 32 bytes, got ${K.length}`)
  }

  return K
}

/**
 * Decrypt an encrypted share using the symmetric key K.
 *
 * @param encryptedShareHex - Hex-encoded encrypted share
 * @param nonceHex - Hex-encoded 12-byte nonce
 * @param key - The 32-byte symmetric key K
 * @returns The decrypted share string
 */
export function decryptShareWithK(
  encryptedShareHex: string,
  nonceHex: string,
  key: Uint8Array,
): string {
  const encryptedShare = hexToBytes(encryptedShareHex)
  const nonce = hexToBytes(nonceHex)
  return decryptShare(encryptedShare, nonce, key)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert hex string to Uint8Array */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "").replace(/\s/g, "")
  if (clean.length % 2 !== 0) {
    throw new Error("Hex string must have even length")
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Convert Uint8Array to hex string */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Convert base64 string to Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
