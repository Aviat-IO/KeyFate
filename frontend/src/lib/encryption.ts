"use server";

import crypto from "crypto";

const ENCRYPTION_KEY_BASE64 = process.env.ENCRYPTION_KEY!;
if (!ENCRYPTION_KEY_BASE64) {
  throw new Error("Invalid encryption key");
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_BASE64, "base64");

const ENCODING: BufferEncoding = "base64";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

async function generateIV(): Promise<Buffer> {
  return crypto.randomBytes(IV_LENGTH);
}

export async function encryptMessage(
  message: string,
  iv?: Buffer,
): Promise<{ encrypted: string; iv: string; authTag: string }> {
  const ivBuffer = iv ?? (await generateIV());
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, ivBuffer);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(message, ENCODING)),
    cipher.final(),
  ]).toString(ENCODING);

  return {
    encrypted,
    iv: ivBuffer.toString(ENCODING),
    authTag: cipher.getAuthTag().toString(ENCODING),
  };
}

export async function decryptMessage(
  cipherText: string,
  ivBuffer: Buffer,
  authTag: Buffer,
): Promise<string> {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, ivBuffer);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, ENCODING)),
    decipher.final(),
  ]).toString(ENCODING);

  return decrypted;
}
