/**
 * Double encryption orchestrator
 *
 * Implements the double-encryption layer for quantum resistance:
 * 1. Encrypt share with random symmetric key K (ChaCha20-Poly1305, quantum-safe)
 * 2. Encrypt K via NIP-44 for convenient Nostr-based recovery (NOT quantum-safe)
 * 3. Optionally encrypt K with passphrase via PBKDF2+AES-256-GCM (quantum-safe)
 * 4. Return plaintext K for Bitcoin OP_RETURN storage (quantum-safe, trustless)
 *
 * Recipients have three independent paths to recover K.
 */

import { generateSymmetricKey, encryptWithSymmetricKey } from "./symmetric"
import {
  deriveKeyFromPassphrase,
  encryptWithDerivedKey,
} from "./passphrase"

/**
 * Interface for NIP-44 encryption operations.
 * Implemented in src/lib/nostr/encryption.ts (built by another agent).
 */
export interface Nip44Ops {
  encrypt(
    plaintext: string,
    senderPrivkey: Uint8Array,
    recipientPubkey: string,
  ): string | Promise<string>
  decrypt(
    ciphertext: string,
    recipientPrivkey: Uint8Array,
    senderPubkey: string,
  ): string | Promise<string>
}

/** Passphrase-encrypted K bundle */
export interface EncryptedKPassphrase {
  ciphertext: Uint8Array
  nonce: Uint8Array
  salt: Uint8Array
}

/** Result of double-encrypting a share */
export interface DoubleEncryptResult {
  /** Share encrypted with K via ChaCha20-Poly1305 */
  encryptedShare: Uint8Array
  /** Nonce used for ChaCha20-Poly1305 encryption of the share */
  nonce: Uint8Array
  /** K encrypted via NIP-44 (base64/hex string from NIP-44) */
  encryptedKNostr: string
  /** K encrypted with passphrase-derived key (if passphrase provided) */
  encryptedKPassphrase?: EncryptedKPassphrase
  /** Plaintext K for Bitcoin OP_RETURN storage */
  plaintextK: Uint8Array
}

/**
 * Default NIP-44 stub that encodes K as hex in a simple wrapper.
 * Replace with real NIP-44 implementation when available.
 */
const defaultNip44Ops: Nip44Ops = {
  encrypt(
    plaintext: string,
    _senderPrivkey: Uint8Array,
    _recipientPubkey: string,
  ): string {
    // Stub: base64-encode the plaintext. Real impl uses NIP-44 ECDH + ChaCha.
    return btoa(plaintext)
  },
  decrypt(
    ciphertext: string,
    _recipientPrivkey: Uint8Array,
    _senderPubkey: string,
  ): string {
    return atob(ciphertext)
  },
}

/**
 * Double-encrypt a Shamir share for a specific recipient.
 *
 * @param share - The Shamir share string to encrypt
 * @param recipientNostrPubkey - Recipient's Nostr public key (hex)
 * @param senderNostrPrivkey - Sender's Nostr private key (32 bytes)
 * @param passphrase - Optional passphrase for third recovery path
 * @param nip44 - NIP-44 operations (defaults to stub implementation)
 * @returns All encrypted pieces needed for storage and recovery
 */
export async function doubleEncryptShare(
  share: string,
  recipientNostrPubkey: string,
  senderNostrPrivkey: Uint8Array,
  passphrase?: string,
  nip44: Nip44Ops = defaultNip44Ops,
): Promise<DoubleEncryptResult> {
  // 1. Generate random symmetric key K
  const K = generateSymmetricKey()

  // 2. Encrypt share with K using ChaCha20-Poly1305
  const shareBytes = new TextEncoder().encode(share)
  const { ciphertext: encryptedShare, nonce } = encryptWithSymmetricKey(
    shareBytes,
    K,
  )

  // 3. Encrypt K with NIP-44 (sender privkey + recipient pubkey)
  const kHex = bytesToHex(K)
  const encryptedKNostr = await nip44.encrypt(
    kHex,
    senderNostrPrivkey,
    recipientNostrPubkey,
  )

  // 4. If passphrase provided, derive key and encrypt K with AES-256-GCM
  let encryptedKPassphrase: EncryptedKPassphrase | undefined
  if (passphrase) {
    const { key: derivedKey, salt } = await deriveKeyFromPassphrase(passphrase)
    const encrypted = await encryptWithDerivedKey(K, derivedKey)
    encryptedKPassphrase = {
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      salt,
    }
  }

  return {
    encryptedShare,
    nonce,
    encryptedKNostr,
    encryptedKPassphrase,
    plaintextK: K,
  }
}

/** Convert Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
