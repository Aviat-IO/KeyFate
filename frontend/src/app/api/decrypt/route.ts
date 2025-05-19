const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error("Invalid encryption key");
}

export async function POST(req: Request) {
  try {
    const { encryptedMessage, iv } = await req.json();

    if (!encryptedMessage || !iv) {
      return Response.json({ error: "Missing encryptedMessage or iv" }, {
        status: 400,
      });
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

    // Import the key
    const keyBuffer = new TextEncoder().encode(ENCRYPTION_KEY);
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
      encryptedArray,
    );

    const decryptedMessage = new TextDecoder().decode(decryptedBuffer);

    return Response.json({ decryptedMessage });
  } catch {
    return Response.json({ error: "Decryption failed" }, { status: 500 });
  }
}
