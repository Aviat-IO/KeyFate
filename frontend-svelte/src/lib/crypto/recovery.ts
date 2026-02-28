/**
 * Three-path K recovery for double-encrypted shares
 *
 * Recipients can recover the symmetric key K through any of three independent paths:
 * 1. Bitcoin OP_RETURN - trustless, quantum-safe, requires trigger timeout
 * 2. NIP-44 decryption - convenient, NOT quantum-safe long-term
 * 3. Passphrase - quantum-safe, requires out-of-band sharing
 *
 * Once K is recovered, the share can be decrypted with ChaCha20-Poly1305.
 */

import { decryptWithSymmetricKey } from "./symmetric"
import {
  deriveKeyFromPassphrase,
  decryptWithDerivedKey,
} from "./passphrase"
import type { Nip44Ops, EncryptedKPassphrase } from "./double-encrypt"

/**
 * Default NIP-44 stub matching the one in double-encrypt.ts.
 * Replace with real NIP-44 implementation when available.
 */
const defaultNip44Ops: Nip44Ops = {
  encrypt(plaintext: string): string {
    return btoa(plaintext)
  },
  decrypt(ciphertext: string): string {
    return atob(ciphertext)
  },
}

/**
 * Recover K from NIP-44 encrypted payload.
 *
 * @param encryptedK - NIP-44 encrypted K string
 * @param recipientPrivkey - Recipient's Nostr private key (32 bytes)
 * @param senderPubkey - Sender's Nostr public key (hex)
 * @param nip44 - NIP-44 operations
 * @returns The 32-byte symmetric key K
 */
export async function recoverKFromNostr(
  encryptedK: string,
  recipientPrivkey: Uint8Array,
  senderPubkey: string,
  nip44: Nip44Ops = defaultNip44Ops,
): Promise<Uint8Array> {
  const kHex = await nip44.decrypt(encryptedK, recipientPrivkey, senderPubkey)
  const K = hexToBytes(kHex)

  if (K.length !== 32) {
    throw new Error(`Recovered K must be 32 bytes, got ${K.length}`)
  }

  return K
}

/**
 * Recover K from passphrase-encrypted payload.
 *
 * @param encryptedKPassphrase - The passphrase-encrypted K bundle
 * @param passphrase - The passphrase used during encryption
 * @returns The 32-byte symmetric key K
 */
export async function recoverKFromPassphrase(
  encryptedKPassphrase: EncryptedKPassphrase,
  passphrase: string,
): Promise<Uint8Array> {
  const { ciphertext, nonce, salt } = encryptedKPassphrase

  // Re-derive the same key using the stored salt
  const { key: derivedKey } = await deriveKeyFromPassphrase(passphrase, salt)

  // Decrypt K
  const K = await decryptWithDerivedKey(ciphertext, nonce, derivedKey)

  if (K.length !== 32) {
    throw new Error(`Recovered K must be 32 bytes, got ${K.length}`)
  }

  return K
}

/**
 * Recover K from Bitcoin OP_RETURN data.
 *
 * K is stored as-is in the OP_RETURN output (32 raw bytes).
 * This is the simplest recovery path - just extract and validate.
 *
 * @param opReturnData - Raw OP_RETURN payload containing K
 * @returns The 32-byte symmetric key K
 */
export function recoverKFromOpReturn(opReturnData: Uint8Array): Uint8Array {
  if (opReturnData.length !== 32) {
    throw new Error(
      `OP_RETURN data must be exactly 32 bytes, got ${opReturnData.length}`,
    )
  }

  // Return a copy to prevent mutation of the source
  return new Uint8Array(opReturnData)
}

/**
 * Decrypt a share using the recovered symmetric key K.
 *
 * @param encryptedShare - ChaCha20-Poly1305 encrypted share
 * @param nonce - 12-byte nonce used during encryption
 * @param key - The 32-byte symmetric key K
 * @returns The original share string
 */
export function decryptShare(
  encryptedShare: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): string {
  const plaintext = decryptWithSymmetricKey(encryptedShare, nonce, key)
  return new TextDecoder().decode(plaintext)
}

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have even length")
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
