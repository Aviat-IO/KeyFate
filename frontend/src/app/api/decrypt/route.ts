import { decryptMessage } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { encryptedMessage, iv, authTag } = await request.json();

    if (!encryptedMessage || !iv) {
      return NextResponse.json(
        { error: "Missing encryptedMessage or iv" },
        { status: 400 },
      );
    }

    // Convert base64 strings back to buffers
    const ivBuffer = Buffer.from(iv, "base64");
    const authTagBuffer = authTag
      ? Buffer.from(authTag, "base64")
      : Buffer.alloc(16);

    const decrypted = await decryptMessage(
      encryptedMessage,
      ivBuffer,
      authTagBuffer,
    );

    return NextResponse.json({ decryptedMessage: decrypted });
  } catch (error) {
    console.error("Decryption error:", error);
    return NextResponse.json(
      { error: "Decryption failed" },
      { status: 500 },
    );
  }
}
