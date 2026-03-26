/**
 * Timing-safe comparison utilities
 *
 * Prevents timing attacks by ensuring string/buffer comparisons
 * take constant time regardless of input values.
 */

import { timingSafeEqual } from "crypto"

/**
 * Compare two strings in constant time
 *
 * Uses Node.js crypto.timingSafeEqual to prevent timing attacks
 * on security-sensitive string comparisons like signatures, tokens, etc.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * const valid = timingSafeStringEqual(receivedSignature, expectedSignature)
 * if (!valid) {
 *   throw new Error("Invalid signature")
 * }
 * ```
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  // Early length check is safe - length isn't secret
  if (a.length !== b.length) {
    return false
  }

  // Convert strings to buffers for timing-safe comparison
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")

  try {
    return timingSafeEqual(bufA, bufB)
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    // This shouldn't happen due to the length check above,
    // but we handle it defensively
    return false
  }
}

/**
 * Compare two buffers in constant time
 *
 * Wrapper around crypto.timingSafeEqual for Buffer comparison
 *
 * @param a - First buffer to compare
 * @param b - Second buffer to compare
 * @returns true if buffers are equal, false otherwise
 */
export function timingSafeBufferEqual(a: Buffer, b: Buffer): boolean {
  // Early length check is safe - length isn't secret
  if (a.length !== b.length) {
    return false
  }

  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Compare two hex strings in constant time
 *
 * Converts hex strings to buffers before comparison
 *
 * @param a - First hex string to compare
 * @param b - Second hex string to compare
 * @returns true if hex strings are equal, false otherwise
 */
export function timingSafeHexEqual(a: string, b: string): boolean {
  // Early length check is safe - length isn't secret
  if (a.length !== b.length) {
    return false
  }

  const bufA = Buffer.from(a, "hex")
  const bufB = Buffer.from(b, "hex")

  try {
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
