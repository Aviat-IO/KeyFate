/**
 * Nostr keypair generation and encoding utilities.
 *
 * Wraps nostr-tools key generation with NIP-19 encoding/decoding
 * for human-friendly key representations (npub/nsec).
 */

import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import * as nip19 from "nostr-tools/nip19"

export interface NostrKeypair {
  /** Raw secret key bytes */
  secretKey: Uint8Array
  /** Hex-encoded public key */
  publicKey: string
  /** Bech32-encoded public key (npub1…) */
  npub: string
  /** Bech32-encoded secret key (nsec1…) */
  nsec: string
}

/**
 * Generate a fresh Nostr keypair.
 *
 * The secret key should be stored securely and never exposed to clients.
 */
export function generateKeypair(): NostrKeypair {
  const secretKey = generateSecretKey()
  const publicKey = getPublicKey(secretKey)

  return {
    secretKey,
    publicKey,
    npub: nip19.npubEncode(publicKey),
    nsec: nip19.nsecEncode(secretKey),
  }
}

/**
 * Derive the hex public key from a secret key (Uint8Array).
 */
export function publicKeyFromSecret(secretKey: Uint8Array): string {
  return getPublicKey(secretKey)
}

/**
 * Decode an npub string to a hex public key.
 * Throws if the input is not a valid npub.
 */
export function npubToHex(npub: string): string {
  const decoded = nip19.decode(npub)
  if (decoded.type !== "npub") {
    throw new Error(`Expected npub, got ${decoded.type}`)
  }
  return decoded.data
}

/**
 * Encode a hex public key as an npub string.
 */
export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex)
}

/**
 * Validate that a string is a well-formed npub.
 * Returns true if valid, false otherwise.
 */
export function isValidNpub(value: string): boolean {
  try {
    npubToHex(value)
    return true
  } catch {
    return false
  }
}

/**
 * Validate that a string is a 64-character lowercase hex public key.
 */
export function isValidHexPubkey(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value)
}
