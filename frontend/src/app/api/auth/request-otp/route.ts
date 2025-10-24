import { checkOTPRateLimit, createOTPToken } from "@/lib/auth/otp"
import { sendOTPEmail } from "@/lib/email/email-service"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      )
    }

    const rateLimit = await checkOTPRateLimit(normalizedEmail)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          resetAt: rateLimit.resetAt,
        },
        { status: 429 },
      )
    }

    const otpResult = await createOTPToken(normalizedEmail, "authentication")
    if (!otpResult.success || !otpResult.code) {
      console.error("[OTP] Failed to create OTP:", otpResult.error)
      return NextResponse.json(
        { error: "Failed to generate OTP. Please try again." },
        { status: 500 },
      )
    }

    const emailResult = await sendOTPEmail(normalizedEmail, otpResult.code, 10)
    if (!emailResult.success) {
      console.error("[OTP] Failed to send email:", emailResult.error)
      return NextResponse.json(
        { error: "Failed to send email. Please try again later." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully. Check your email.",
      remaining: rateLimit.remaining,
    })
  } catch (error) {
    console.error("[OTP] Request OTP error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    )
  }
}
