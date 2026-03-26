/**
 * Symmetric encryption using ChaCha20-Poly1305
 *
 * Provides quantum-safe symmetric encryption for the double-encryption layer.
 * ChaCha20-Poly1305 is an AEAD cipher that provides both confidentiality and
 * authenticity. It is not vulnerable to quantum attacks (Grover's algorithm
 * only halves the effective key length, so 256-bit keys remain 128-bit secure).
 */

import { chacha20poly1305 } from "@noble/ciphers/chacha.js"

const KEY_LENGTH = 32 // 256-bit key
const NONCE_LENGTH = 12 // 96-bit nonce for ChaCha20-Poly1305

/** Generate cryptographically secure random bytes using Web Crypto API. */
function secureRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Generate a cryptographically secure random 256-bit symmetric key.
 */
export function generateSymmetricKey(): Uint8Array {
  return secureRandomBytes(KEY_LENGTH)
}

/**
 * Encrypt plaintext with ChaCha20-Poly1305.
 *
 * @param plaintext - Data to encrypt
 * @param key - 256-bit symmetric key
 * @returns Ciphertext (includes 16-byte Poly1305 auth tag appended) and nonce
 * @throws If key is not 32 bytes
 */
export function encryptWithSymmetricKey(
  plaintext: Uint8Array,
  key: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes, got ${key.length}`)
  }

  const nonce = secureRandomBytes(NONCE_LENGTH)
  const cipher = chacha20poly1305(key, nonce)
  const ciphertext = cipher.encrypt(plaintext)

  return { ciphertext, nonce }
}

/**
 * Decrypt ciphertext with ChaCha20-Poly1305.
 *
 * @param ciphertext - Data to decrypt (includes 16-byte Poly1305 auth tag)
 * @param nonce - 12-byte nonce used during encryption
 * @param key - 256-bit symmetric key
 * @returns Decrypted plaintext
 * @throws If key is not 32 bytes, nonce is not 12 bytes, or authentication fails
 */
export function decryptWithSymmetricKey(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Uint8Array {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes, got ${key.length}`)
  }
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Nonce must be ${NONCE_LENGTH} bytes, got ${nonce.length}`)
  }

  const cipher = chacha20poly1305(key, nonce)
  return cipher.decrypt(ciphertext)
}
