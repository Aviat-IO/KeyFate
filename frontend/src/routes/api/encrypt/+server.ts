import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { encryptMessage } from "$lib/encryption"

/**
 * POST /api/encrypt
 *
 * Encrypt a message using server-side encryption.
 * Requires authentication.
 */
export const POST: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const { message } = await event.request.json()

    if (!message || message === "") {
      return json(
        { error: "Missing message to encrypt" },
        { status: 400 },
      )
    }

    const result = await encryptMessage(message)

    return json({
      encryptedMessage: result.encrypted,
      iv: result.iv,
      authTag: result.authTag,
    })
  } catch (error) {
    console.error("Encryption error:", error)
    return json({ error: "Encryption failed" }, { status: 500 })
  }
}
