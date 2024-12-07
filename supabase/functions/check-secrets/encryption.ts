"use server";

import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { ENCRYPTION_KEY } from "../_shared/env.ts";

const ENCRYPTION_KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, "base64");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

export function encryptMessage(
  message: string,
  iv?: Buffer,
): { encrypted: string; iv: string; authTag: string } {
  const ivBuffer = iv ?? generateIV();
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    ENCRYPTION_KEY_BUFFER,
    ivBuffer,
  );

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
    iv: ivBuffer.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptMessage(
  cipherText: string,
  ivBuffer: Buffer,
  authTag: Buffer,
): string {
  const cipherBuffer = Buffer.from(cipherText, "base64");

  // Extract the auth tag from the end of the cipher buffer
  const encryptedData = cipherBuffer.subarray(0, -authTag.length);
  const storedAuthTag = cipherBuffer.subarray(-authTag.length);

  // Verify the provided auth tag matches what was stored
  if (!storedAuthTag.equals(authTag)) {
    throw new Error("Authentication tag mismatch - data may be corrupted");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY_BUFFER,
    ivBuffer,
  );

  let decrypted = decipher.update(
    encryptedData.toString("base64"),
    "base64",
    "utf8",
  );
  decrypted += decipher.final("utf8");
  return decrypted;
}
