import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { checkOTPRateLimit, createOTPToken } from "$lib/auth/otp"
import { sendOTPEmail } from "$lib/email/email-service"
import { verifyTurnstileToken } from "$lib/auth/turnstile"

export const POST: RequestHandler = async (event) => {
  try {
    const body = await event.request.json()
    const { email, acceptedPrivacyPolicy, turnstileToken } = body

    if (!email || typeof email !== "string") {
      return json({ error: "Email is required" }, { status: 400 })
    }

    // Require privacy policy acceptance for new signups
    if (!acceptedPrivacyPolicy) {
      return json(
        {
          error:
            "You must accept the Privacy Policy and Terms of Service to continue",
        },
        { status: 400 },
      )
    }

    // Verify Turnstile token (bot protection)
    // Only enforce in production when TURNSTILE_SECRET_KEY is set
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return json(
          { error: "Please complete the security check" },
          { status: 400 },
        )
      }

      const isValidToken = await verifyTurnstileToken(turnstileToken)
      if (!isValidToken) {
        return json(
          { error: "Security verification failed. Please try again." },
          { status: 400 },
        )
      }
    }

    const normalizedEmail = email.toLowerCase().trim()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return json({ error: "Invalid email format" }, { status: 400 })
    }

    const rateLimit = await checkOTPRateLimit(normalizedEmail)
    if (!rateLimit.allowed) {
      return json(
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
      return json(
        { error: "Failed to generate OTP. Please try again." },
        { status: 500 },
      )
    }

    const emailResult = await sendOTPEmail(normalizedEmail, otpResult.code, 5)
    if (!emailResult.success) {
      console.error("[OTP] Failed to send email:", emailResult.error)
      return json(
        { error: "Failed to send email. Please try again later." },
        { status: 500 },
      )
    }

    return json({
      success: true,
      message: "OTP sent successfully. Check your email.",
      remaining: rateLimit.remaining,
    })
  } catch (error) {
    console.error("[OTP] Request OTP error:", error)
    return json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
