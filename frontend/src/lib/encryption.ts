"use server";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptMessage(
  message: string,
): { encryptedMessage: string; iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY), iv);

  let encrypted = cipher.update(message, "utf8", "base64");
  encrypted += cipher.final("base64");

  return {
    encryptedMessage: encrypted,
    iv: iv.toString("base64"),
  };
}

export function decryptMessage(encryptedMessage: string, iv: string): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(iv, "base64"),
  );

  let decrypted = decipher.update(encryptedMessage, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
console.log({ ENCRYPTION_KEY });
if (!ENCRYPTION_KEY) {
  throw new Error("Invalid encryption key");
}
