import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireSession } from "$lib/server/auth"
import {
  getUserContactMethods,
  upsertUserContactMethods,
} from "$lib/db/operations"

export const GET: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const methods = await getUserContactMethods(session.user.id)
    return json({ contactMethods: methods })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in GET /api/user/contact-methods:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}

export const POST: RequestHandler = async (event) => {
  try {
    const session = await requireSession(event)
    const body = await event.request.json()

    const { email, phone, preferredMethod } = body as {
      email?: string
      phone?: string
      preferredMethod?: "email" | "phone" | "both"
    }

    // Validate preferredMethod if provided
    if (
      preferredMethod &&
      !["email", "phone", "both"].includes(preferredMethod)
    ) {
      return json({ error: "Invalid preferred method" }, { status: 400 })
    }

    // Require at least one contact method
    if (!email && !phone) {
      return json(
        { error: "At least one contact method (email or phone) is required" },
        { status: 400 },
      )
    }

    // Basic email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Invalid email address" }, { status: 400 })
    }

    const result = await upsertUserContactMethods(session.user.id, {
      email: email || undefined,
      phone: phone || undefined,
      preferredMethod: preferredMethod || "email",
    })

    return json({ contactMethod: result })
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error
    }
    console.error("Error in POST /api/user/contact-methods:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
