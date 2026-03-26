/**
 * Shared hex/bytes conversion utilities.
 *
 * Centralised here to avoid duplication across crypto modules.
 */

/** Convert a Uint8Array to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Convert a hex string to a Uint8Array.
 *
 * Accepts optional `0x` prefix and whitespace, which are stripped before parsing.
 * @throws If the cleaned hex string has an odd length.
 */
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
