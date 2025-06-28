"use server";

import crypto from "crypto";

const ENCRYPTION_KEY_BASE64 = process.env.ENCRYPTION_KEY!;
if (!ENCRYPTION_KEY_BASE64) {
  throw new Error("Invalid encryption key");
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_BASE64, "base64");

// Validate key length for AES-256-GCM (must be exactly 32 bytes)
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error(
    `Invalid key length: expected 32 bytes, got ${ENCRYPTION_KEY.length} bytes. Please generate a new 256-bit key.`,
  );
}

const DB_ENCODING: BufferEncoding = "base64";
const MESSAGE_ENCODING: BufferEncoding = "utf8";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

async function generateIV(): Promise<Buffer> {
  return crypto.randomBytes(IV_LENGTH);
}

// Text (string) → UTF-8 → Binary → Encryption → Binary → Base64 (for storage)
export async function encryptMessage(
  message: string,
  iv?: Buffer,
): Promise<{ encrypted: string; iv: string; authTag: string }> {
  const ivBuffer = iv ?? (await generateIV());
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, ivBuffer);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(message, MESSAGE_ENCODING)),
    cipher.final(),
  ]).toString(DB_ENCODING);

  return {
    encrypted,
    iv: ivBuffer.toString(DB_ENCODING),
    authTag: cipher.getAuthTag().toString(DB_ENCODING),
  };
}

// Base64 → Binary → Decryption → Binary → UTF-8 → Text (string)
export async function decryptMessage(
  cipherText: string,
  ivBuffer: Buffer,
  authTag: Buffer,
): Promise<string> {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, ivBuffer);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, DB_ENCODING)),
    decipher.final(),
  ]).toString(MESSAGE_ENCODING);

  return decrypted;
}

// Helper function to generate a new 256-bit encryption key
export async function generateEncryptionKey(): Promise<string> {
  return crypto.randomBytes(32).toString("base64");
}
