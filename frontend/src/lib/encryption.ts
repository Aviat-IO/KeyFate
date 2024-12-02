"use server";

import crypto from "crypto";

const ENCRYPTION_KEY_BASE64 = process.env.ENCRYPTION_KEY!;
if (!ENCRYPTION_KEY_BASE64) {
  throw new Error("Invalid encryption key");
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_BASE64, "base64");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

async function generateKey(): Promise<Buffer> {
  return crypto.randomBytes(KEY_LENGTH);
}

async function generateIV(): Promise<Buffer> {
  return crypto.randomBytes(IV_LENGTH);
}

export async function encryptMessage(
  message: string,
  iv?: Buffer,
): Promise<{ encrypted: string; iv: string }> {
  let ivBuffer = iv ?? await generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, ivBuffer);
  let encrypted = cipher.update(message, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Store the auth tag with the encrypted data
  const finalEncrypted = Buffer.concat([
    Buffer.from(encrypted, "base64"),
    authTag,
  ]).toString("base64");

  return {
    encrypted: finalEncrypted,
    iv: iv.toString("base64"),
  };
}

export async function decryptMessage(
  encrypted: string,
  iv: Buffer,
): Promise<string> {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    iv,
  );

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
