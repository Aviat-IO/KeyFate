/**
 * NIP-44 encryption/decryption wrapper.
 *
 * Provides a thin, typed interface over nostr-tools' NIP-44 v2
 * implementation for encrypting and decrypting payloads between
 * two Nostr keypairs.
 */

import * as nip44 from "nostr-tools/nip44"

/**
 * Derive a shared conversation key from a private key and a public key.
 *
 * The conversation key is symmetric: `conversationKey(a, B) === conversationKey(b, A)`.
 *
 * @param privateKey - Sender's secret key as Uint8Array
 * @param publicKey  - Recipient's hex-encoded public key
 */
export function getConversationKey(
  privateKey: Uint8Array,
  publicKey: string,
): Uint8Array {
  return nip44.v2.utils.getConversationKey(privateKey, publicKey)
}

/**
 * Encrypt a plaintext string using NIP-44 v2.
 *
 * @param plaintext       - The message to encrypt
 * @param conversationKey - Shared key from {@link getConversationKey}
 * @returns Base64-encoded NIP-44 payload
 */
export function encrypt(
  plaintext: string,
  conversationKey: Uint8Array,
): string {
  return nip44.v2.encrypt(plaintext, conversationKey)
}

/**
 * Decrypt a NIP-44 v2 payload.
 *
 * @param payload         - Base64-encoded NIP-44 ciphertext
 * @param conversationKey - Shared key from {@link getConversationKey}
 * @returns The original plaintext
 * @throws If the MAC check fails or the payload is malformed
 */
export function decrypt(
  payload: string,
  conversationKey: Uint8Array,
): string {
  return nip44.v2.decrypt(payload, conversationKey)
}
