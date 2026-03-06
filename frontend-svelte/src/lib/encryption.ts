"use server"

import { serverEnv } from "$lib/server-env"
import crypto from "crypto"

interface EncryptionKeyConfig {
  key: Buffer
  version: number
  createdAt: Date
}

const ENCRYPTION_KEYS: Map<number, EncryptionKeyConfig> = new Map()
let CURRENT_KEY_VERSION = 1

function validateKeyEntropy(key: Buffer): void {
  // Check for sufficient entropy (at least 16 unique bytes)
  const uniqueBytes = new Set(key)
  if (uniqueBytes.size < 16) {
    throw new Error(
      `Encryption key has insufficient entropy: only ${uniqueBytes.size} unique bytes (minimum 16 required)`,
    )
  }

  // Verify it's not a common weak key pattern
  const keyHex = key.toString("hex")
  const weakPatterns = [
    /^0+$/, // All zeros
    /^f+$/i, // All 0xFF
    /^(.)\1+$/, // Repeating single byte
  ]

  for (const pattern of weakPatterns) {
    if (pattern.test(keyHex)) {
      throw new Error(
        "Encryption key matches weak pattern. Please generate a cryptographically random key.",
      )
    }
  }
}

function getEncryptionKey(version?: number): Buffer {
  const targetVersion = version || CURRENT_KEY_VERSION

  if (!ENCRYPTION_KEYS.has(targetVersion)) {
    // Try version-specific env var first, then fall back to default
    const keyEnvVar = `ENCRYPTION_KEY_V${targetVersion}`
    const ENCRYPTION_KEY_BASE64 =
      process.env[keyEnvVar] ||
      (targetVersion === 1 ? serverEnv.ENCRYPTION_KEY : null)

    if (!ENCRYPTION_KEY_BASE64) {
      throw new Error(
        `Encryption key version ${targetVersion} not found. Set ${keyEnvVar} environment variable.`,
      )
    }

    const key = Buffer.from(ENCRYPTION_KEY_BASE64, "base64")

    // Validate key length for AES-256-GCM (must be exactly 32 bytes)
    if (key.length !== 32) {
      throw new Error(
        `Invalid key length for version ${targetVersion}: expected 32 bytes, got ${key.length} bytes.`,
      )
    }

    // Validate key entropy
    validateKeyEntropy(key)

    ENCRYPTION_KEYS.set(targetVersion, {
      key,
      version: targetVersion,
      createdAt: new Date(),
    })

    if (process.env.NODE_ENV === "development") {
      console.log(`✅ Encryption key v${targetVersion} loaded and validated`)
    }
  }

  return ENCRYPTION_KEYS.get(targetVersion)!.key
}

const DB_ENCODING: BufferEncoding = "base64"
const MESSAGE_ENCODING: BufferEncoding = "utf8"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

async function generateIV(): Promise<Buffer> {
  return crypto.randomBytes(IV_LENGTH)
}

// Text (string) → UTF-8 → Binary → Encryption → Binary → Base64 (for storage)
export async function encryptMessage(
  message: string,
  iv?: Buffer,
  keyVersion?: number,
): Promise<{
  encrypted: string
  iv: string
  authTag: string
  keyVersion: number
}> {
  const version = keyVersion || CURRENT_KEY_VERSION
  const ivBuffer = iv ?? (await generateIV())
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    getEncryptionKey(version),
    ivBuffer,
  )

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(message, MESSAGE_ENCODING)),
    cipher.final(),
  ]).toString(DB_ENCODING)

  return {
    encrypted,
    iv: ivBuffer.toString(DB_ENCODING),
    authTag: cipher.getAuthTag().toString(DB_ENCODING),
    keyVersion: version,
  }
}

// Base64 → Binary → Decryption → Binary → UTF-8 → Text (string)
export async function decryptMessage(
  cipherText: string,
  ivBuffer: Buffer,
  authTag: Buffer,
  keyVersion?: number,
): Promise<string> {
  // Default to version 1 for backward compatibility with existing data
  const version = keyVersion || 1

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(version),
    ivBuffer,
  )
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, DB_ENCODING)),
    decipher.final(),
  ]).toString(MESSAGE_ENCODING)

  return decrypted
}

// Helper function to generate a new 256-bit encryption key
export async function generateEncryptionKey(): Promise<string> {
  return crypto.randomBytes(32).toString("base64")
}
