import { getDatabase } from "@/lib/db/drizzle"
import { users, type UserInsert } from "@/lib/db/schema"
import { validateOTPToken } from "@/lib/auth/otp"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { APIError, handleAPIError } from "@/lib/errors/api-error"
import { validateBody, commonSchemas } from "@/lib/api/validation"
import { z } from "zod"

const verifyOTPSchema = z.object({
  email: commonSchemas.email,
  code: z.string().regex(/^\d{8}$/, "Code must be 8 digits"),
})

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await validateBody(request, verifyOTPSchema)
    if (!bodyResult.success) {
      return NextResponse.json(bodyResult.error.toJSON(), {
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

    return NextResponse.json({
      success: true,
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    })
  } catch (error) {
    return handleAPIError(error)
  }
}
