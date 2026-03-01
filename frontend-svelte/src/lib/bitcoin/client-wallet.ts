/**
 * Client-side Bitcoin wallet for key generation and session storage.
 *
 * Keys never leave the browser. They are generated using crypto.getRandomValues
 * and stored in sessionStorage for the duration of the browser session.
 */

import { secp256k1 } from "@noble/curves/secp256k1.js"
import { hex } from "@scure/base"

export interface BitcoinKeypair {
  privkey: Uint8Array // 32 bytes
  pubkey: Uint8Array // 33 bytes (compressed)
}

/**
 * Generate a fresh Bitcoin keypair.
 * Uses crypto.getRandomValues for key generation and derives
 * the compressed public key via secp256k1.
 */
export function generateBitcoinKeypair(): BitcoinKeypair {
  const privkey = new Uint8Array(32)
  crypto.getRandomValues(privkey)
  const pubkey = secp256k1.getPublicKey(privkey, true)
  return { privkey, pubkey }
}

/** Storage key format for sessionStorage. */
function storageKey(secretId: string, role: "owner" | "recipient"): string {
  return `btc-keypair:${secretId}:${role}`
}

/**
 * Store a keypair in sessionStorage (hex-encoded).
 * Only persists for the browser session.
 */
export function storeKeypair(
  secretId: string,
  role: "owner" | "recipient",
  keypair: BitcoinKeypair,
): void {
  const data = JSON.stringify({
    privkey: hex.encode(keypair.privkey),
    pubkey: hex.encode(keypair.pubkey),
  })
  sessionStorage.setItem(storageKey(secretId, role), data)
}

/**
 * Retrieve a keypair from sessionStorage.
 * Returns null if not found.
 */
export function getStoredKeypair(
  secretId: string,
  role: "owner" | "recipient",
): BitcoinKeypair | null {
  const raw = sessionStorage.getItem(storageKey(secretId, role))
  if (!raw) return null

  try {
    const data = JSON.parse(raw) as { privkey: string; pubkey: string }
    return {
      privkey: hex.decode(data.privkey),
      pubkey: hex.decode(data.pubkey),
    }
  } catch {
    return null
  }
}

/**
 * Clear stored keypairs for a secret (both owner and recipient).
 */
export function clearKeypairs(secretId: string): void {
  sessionStorage.removeItem(storageKey(secretId, "owner"))
  sessionStorage.removeItem(storageKey(secretId, "recipient"))
}

// ─── Bitcoin metadata (non-key data needed for refresh) ──────────────────────

/** Metadata needed for Bitcoin refresh that isn't a private key. */
export interface BitcoinMeta {
  /** Hex-encoded symmetric key K (for OP_RETURN) */
  symmetricKeyK: string
  /** Nostr event ID (hex, for OP_RETURN) */
  nostrEventId: string
  /** Recipient's Bitcoin address */
  recipientAddress: string
}

function metaStorageKey(secretId: string): string {
  return `btc-meta:${secretId}`
}

/**
 * Store Bitcoin metadata in sessionStorage.
 * These values are needed for refresh operations (OP_RETURN construction).
 */
export function storeBitcoinMeta(secretId: string, meta: BitcoinMeta): void {
  sessionStorage.setItem(metaStorageKey(secretId), JSON.stringify(meta))
}

/**
 * Retrieve Bitcoin metadata from sessionStorage.
 * Returns null if not found.
 */
export function getBitcoinMeta(secretId: string): BitcoinMeta | null {
  const raw = sessionStorage.getItem(metaStorageKey(secretId))
  if (!raw) return null

  try {
    return JSON.parse(raw) as BitcoinMeta
  } catch {
    return null
  }
}

/**
 * Clear all Bitcoin session data for a secret (keypairs + metadata).
 */
export function clearAllBitcoinData(secretId: string): void {
  clearKeypairs(secretId)
  sessionStorage.removeItem(metaStorageKey(secretId))
}
