import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { getDatabase } from "$lib/db/drizzle"
import { users, type UserInsert } from "$lib/db/schema"
import { validateOTPToken } from "$lib/auth/otp"
import { eq } from "drizzle-orm"
import { APIError, handleAPIError } from "$lib/errors/api-error"
import { validateBody, commonSchemas } from "$lib/api/validation"
import { z } from "zod"

const verifyOTPSchema = z.object({
  email: commonSchemas.email,
  code: z.string().regex(/^\d{8}$/, "Code must be 8 digits"),
})

export const POST: RequestHandler = async (event) => {
  try {
    const bodyResult = await validateBody(
      event.request as any,
      verifyOTPSchema,
    )
    if (!bodyResult.success) {
      return json(bodyResult.error.toJSON(), {
        status: bodyResult.error.statusCode,
      })
    }

    const { email, code } = bodyResult.data
    const normalizedEmail = email.toLowerCase().trim()
    const normalizedCode = code.trim()

    const validationResult = await validateOTPToken(
      normalizedEmail,
      normalizedCode,
    )

    if (!validationResult.success || !validationResult.valid) {
      throw APIError.validation(
        validationResult.error || "Invalid or expired code",
        { email: normalizedEmail },
      )
    }

    const db = await getDatabase()
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    let user
    if (existingUsers.length === 0) {
      const newUsers = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email: normalizedEmail,
          emailVerified: new Date(),
          password: null,
          name: null,
          image: null,
        } as UserInsert)
        .returning()

      user = newUsers[0]
    } else {
      user = existingUsers[0]

      if (!user.emailVerified) {
        await db
          .update(users)
          .set({ emailVerified: new Date() } as Partial<UserInsert>)
          .where(eq(users.id, user.id))
      }
    }

    return json({
      success: true,
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    })
  } catch (error) {
    const errorResponse = handleAPIError(error)
    return errorResponse
  }
}
