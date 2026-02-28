/**
 * Passphrase-based key derivation and encryption
 *
 * Uses Web Crypto API (available in Bun and browsers) for:
 * - PBKDF2-SHA256 key derivation (600,000 iterations per OWASP 2023)
 * - AES-256-GCM authenticated encryption
 *
 * This provides a quantum-safe recovery path since both PBKDF2 and AES-256-GCM
 * rely on symmetric primitives not vulnerable to Shor's algorithm.
 */

const PBKDF2_ITERATIONS = 600_000
const SALT_LENGTH = 16 // 128-bit salt
const AES_NONCE_LENGTH = 12 // 96-bit nonce for AES-GCM
const KEY_LENGTH_BITS = 256

/**
 * Derive a 256-bit AES key from a passphrase using PBKDF2-SHA256.
 *
 * @param passphrase - User-provided passphrase
 * @param existingSalt - Optional salt for decryption (generates new if omitted)
 * @returns Derived CryptoKey and the salt used
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  existingSalt?: Uint8Array,
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  if (!passphrase) {
    throw new Error("Passphrase must not be empty")
  }

  const salt = existingSalt ?? crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const encoder = new TextEncoder()
  const passphraseBytes = encoder.encode(passphrase)

  // Import passphrase as raw key material
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passphraseBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  )

  // Derive AES-256-GCM key
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false, // not extractable
    ["encrypt", "decrypt"],
  )

  return { key: derivedKey, salt }
}

/**
 * Encrypt data with a derived AES-256-GCM key.
 *
 * @param plaintext - Data to encrypt
 * @param key - AES-256-GCM CryptoKey from deriveKeyFromPassphrase
 * @returns Ciphertext (includes GCM auth tag) and nonce
 */
export async function encryptWithDerivedKey(
  plaintext: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const nonce = crypto.getRandomValues(new Uint8Array(AES_NONCE_LENGTH))

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    plaintext,
  )

  return {
    ciphertext: new Uint8Array(ciphertextBuffer),
    nonce,
  }
}

/**
 * Decrypt data with a derived AES-256-GCM key.
 *
 * @param ciphertext - Data to decrypt (includes GCM auth tag)
 * @param nonce - 12-byte nonce used during encryption
 * @param key - AES-256-GCM CryptoKey from deriveKeyFromPassphrase
 * @returns Decrypted plaintext
 * @throws If authentication fails or key is wrong
 */
export async function decryptWithDerivedKey(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: CryptoKey,
): Promise<Uint8Array> {
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext,
  )

  return new Uint8Array(plaintextBuffer)
}
