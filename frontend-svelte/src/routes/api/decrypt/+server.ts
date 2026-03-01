import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { decryptMessage } from "$lib/encryption"
import { requireSession } from "$lib/server/auth"

/**
 * POST /api/decrypt
 *
 * Decrypt a message using server-side decryption.
 * Requires authentication.
 */
export const POST: RequestHandler = async (event) => {
  try {
    await requireSession(event)

    const { encryptedMessage, iv, authTag } = await event.request.json()

    if (!encryptedMessage || !iv) {
      return json(
        { error: "Missing encryptedMessage or iv" },
        { status: 400 },
      )
    }

    // Convert base64 strings back to buffers
    const ivBuffer = Buffer.from(iv, "base64")
    const authTagBuffer = authTag
      ? Buffer.from(authTag, "base64")
      : Buffer.alloc(16)

    const decrypted = await decryptMessage(
      encryptedMessage,
      ivBuffer,
      authTagBuffer,
    )

    return json({ decryptedMessage: decrypted })
  } catch (error) {
    console.error("Decryption error:", error)
    return json({ error: "Decryption failed" }, { status: 500 })
  }
}
