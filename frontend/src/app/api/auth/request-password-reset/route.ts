import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/auth/rate-limiting"
import {
  canRequestPasswordReset,
  generatePasswordResetToken,
} from "@/lib/auth/password-reset"
import { renderPasswordResetTemplate } from "@/lib/email/templates"
import { sendEmail } from "@/lib/email/email-service"
import { getDatabase } from "@/lib/db/drizzle"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { email } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    email = email.toLowerCase().trim()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 },
      )
    }

    const rateLimit = await checkRateLimit("request-password-reset", email)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many password reset requests. Please try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`,
        },
        { status: 429 },
      )
    }

    const resetCheck = await canRequestPasswordReset(email)

    if (!resetCheck.canReset) {
      return NextResponse.json(
        {
          success: true,
          message:
            "If an account exists, a password reset email has been sent.",
        },
        { status: 200 },
      )
    }

    const db = await getDatabase()
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (userResults.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message:
            "If an account exists, a password reset email has been sent.",
        },
        { status: 200 },
      )
    }

    const user = userResults[0]
    const token = await generatePasswordResetToken(user.id)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const resetUrl = `${siteUrl}/auth/reset-password?token=${token}`

    const emailTemplate = renderPasswordResetTemplate({
      resetUrl,
      userName: user.name || undefined,
    })

    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    })

    return NextResponse.json(
      {
        success: true,
        message: "If an account exists, a password reset email has been sent.",
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 },
    )
  }
}
