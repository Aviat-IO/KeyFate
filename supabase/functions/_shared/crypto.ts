export async function decrypt(
  encryptedMessage: string,
  iv: string,
  authTag: string,
): Promise<string> {
  const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  // Convert base64 strings back to Uint8Arrays
  const encryptedArray = Uint8Array.from(
    atob(encryptedMessage)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );

  const ivArray = Uint8Array.from(
    atob(iv)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );

  const authTagArray = Uint8Array.from(
    atob(authTag)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );

  // Combine encrypted data and auth tag
  const encryptedWithTag = new Uint8Array(encryptedArray.length + 16);
  encryptedWithTag.set(encryptedArray);
  encryptedWithTag.set(authTagArray, encryptedArray.length);

  // Import the key - handle both raw and base64 encoded keys
  let keyBuffer;
  try {
    // Try to decode as base64 first
    keyBuffer = Uint8Array.from(atob(ENCRYPTION_KEY), (c) => c.charCodeAt(0));
  } catch {
    // If that fails, treat as raw string
    keyBuffer = new TextEncoder().encode(ENCRYPTION_KEY);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  // Decrypt the message
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivArray,
    },
    cryptoKey,
    encryptedWithTag,
  );

  return new TextDecoder().decode(decryptedBuffer);
}
