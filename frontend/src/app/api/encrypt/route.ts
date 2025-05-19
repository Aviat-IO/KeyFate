const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error("Invalid encryption key");
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return Response.json({ error: "Missing message to encrypt" }, {
        status: 400,
      });
    }

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Convert the encryption key to proper format
    const keyBuffer = new TextEncoder().encode(ENCRYPTION_KEY);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    // Encrypt the message
    const encodedMessage = new TextEncoder().encode(message);
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      cryptoKey,
      encodedMessage,
    );

    // Convert to base64 for storage
    const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
    const ivArray = Array.from(iv);

    return Response.json({
      encryptedMessage: btoa(String.fromCharCode(...encryptedArray)),
      iv: btoa(String.fromCharCode(...ivArray)),
    });
  } catch {
    return Response.json({ error: "Encryption failed" }, { status: 500 });
  }
}
