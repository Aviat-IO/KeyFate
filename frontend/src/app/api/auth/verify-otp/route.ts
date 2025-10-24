import { getDatabase } from "@/lib/db/drizzle"
import { users, type UserInsert } from "@/lib/db/schema"
import { validateOTPToken } from "@/lib/auth/otp"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const normalizedCode = code.trim()

    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Invalid code format" },
        { status: 400 },
      )
    }

    const validationResult = await validateOTPToken(
      normalizedEmail,
      normalizedCode,
    )

    if (!validationResult.success || !validationResult.valid) {
      return NextResponse.json(
        {
          error: validationResult.error || "Invalid or expired code",
          valid: false,
        },
        { status: 400 },
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
    console.error("[OTP] Verify OTP error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    )
  }
}
