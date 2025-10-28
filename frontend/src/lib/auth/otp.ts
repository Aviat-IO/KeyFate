import { getDatabase } from "@/lib/db/drizzle"
import { otpRateLimits, verificationTokens } from "@/lib/db/schema"
import { and, eq, gt, lt } from "drizzle-orm"
import crypto from "crypto"

const OTP_EXPIRATION_MINUTES = 5
const OTP_MAX_VALIDATION_ATTEMPTS = 5
const MAX_COLLISION_RETRIES = 3

const isProduction = process.env.NODE_ENV === "production"
const OTP_RATE_LIMIT_REQUESTS = isProduction ? 3 : 10
const OTP_RATE_LIMIT_WINDOW_HOURS = 1
const OTP_RATE_LIMIT_VALIDATION_ATTEMPTS = 5
const OTP_RATE_LIMIT_VALIDATION_WINDOW_MINUTES = 15

export function generateOTP(): string {
  const code = crypto.randomInt(0, 100000000)
  return code.toString().padStart(8, "0")
}

interface CreateOTPTokenResult {
  success: boolean
  code?: string
  error?: string
}

export async function createOTPToken(
  email: string,
  purpose: "authentication" | "email_verification",
): Promise<CreateOTPTokenResult> {
  const db = await getDatabase()

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const code = generateOTP()

    const existing = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, code),
          eq(verificationTokens.identifier, email),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      continue
    }

    await db
      .update(verificationTokens)
      .set({ expires: new Date() })
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.purpose, purpose),
          gt(verificationTokens.expires, new Date()),
        ),
      )

    const expires = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)
    const result = await db
      .insert(verificationTokens)
      .values({
        identifier: email,
        token: code,
        expires,
        purpose,
        attemptCount: 0,
      } as any)
      .returning()

    if (result.length > 0) {
      return {
        success: true,
        code,
      }
    }
  }

  return {
    success: false,
    error: "Failed to generate unique OTP after collision retries",
  }
}

interface ValidateOTPTokenResult {
  success: boolean
  valid: boolean
  error?: string
}

export async function validateOTPToken(
  email: string,
  code: string,
): Promise<ValidateOTPTokenResult> {
  const db = await getDatabase()

  return await db.transaction(async (tx) => {
    const now = new Date()
    const validationWindowStart = new Date(
      now.getTime() - OTP_RATE_LIMIT_VALIDATION_WINDOW_MINUTES * 60 * 1000,
    )

    const recentAttempts = await tx
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.purpose, "authentication"),
          gt(verificationTokens.attemptCount, 0),
          gt(verificationTokens.expires, validationWindowStart),
        ),
      )

    const totalAttempts = recentAttempts.reduce(
      (sum, token) => sum + (token.attemptCount ?? 0),
      0,
    )

    if (totalAttempts >= OTP_RATE_LIMIT_VALIDATION_ATTEMPTS) {
      return {
        success: false,
        valid: false,
        error: "Too many validation attempts. Please try again later.",
      }
    }

    const tokens = await tx
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.token, code),
          eq(verificationTokens.purpose, "authentication"),
        ),
      )
      .limit(1)
      .for("update")

    if (tokens.length === 0) {
      return {
        success: false,
        valid: false,
        error: "Invalid OTP code",
      }
    }

    const token = tokens[0]

    if (token.expires && token.expires < new Date()) {
      return {
        success: false,
        valid: false,
        error: "OTP code has expired",
      }
    }

    const attemptCount = token.attemptCount ?? 0
    if (attemptCount >= OTP_MAX_VALIDATION_ATTEMPTS) {
      return {
        success: false,
        valid: false,
        error: "Too many validation attempts for this OTP",
      }
    }

    await tx
      .update(verificationTokens)
      .set({ expires: new Date() })
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.token, code),
        ),
      )

    return {
      success: true,
      valid: true,
    }
  })
}

export async function invalidateOTPTokens(email: string): Promise<void> {
  const db = await getDatabase()

  await db
    .update(verificationTokens)
    .set({ expires: new Date() })
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.purpose, "authentication"),
        gt(verificationTokens.expires, new Date()),
      ),
    )
}

interface CheckOTPRateLimitResult {
  allowed: boolean
  remaining: number
  resetAt?: Date
}

export async function checkOTPRateLimit(
  email: string,
): Promise<CheckOTPRateLimitResult> {
  const db = await getDatabase()

  const now = new Date()
  const windowEnd = new Date(
    now.getTime() + OTP_RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  )

  if (!isProduction) {
    console.log(
      `[OTP Rate Limit] Non-production mode: Allowing ${OTP_RATE_LIMIT_REQUESTS} requests per hour`,
    )
  }

  const existingLimits = await db
    .select()
    .from(otpRateLimits)
    .where(
      and(eq(otpRateLimits.email, email), gt(otpRateLimits.windowEnd, now)),
    )
    .limit(1)

  if (existingLimits.length === 0) {
    await db.insert(otpRateLimits).values({
      email,
      requestCount: 1,
      windowStart: now,
      windowEnd,
    } as any)

    return {
      allowed: true,
      remaining: OTP_RATE_LIMIT_REQUESTS - 1,
    }
  }

  const limit = existingLimits[0]

  if (limit.windowEnd < now) {
    await db
      .update(otpRateLimits)
      .set({
        requestCount: 1,
        windowStart: now,
        windowEnd,
        updatedAt: now,
      } as any)
      .where(eq(otpRateLimits.id, limit.id))

    return {
      allowed: true,
      remaining: OTP_RATE_LIMIT_REQUESTS - 1,
    }
  }

  if (limit.requestCount >= OTP_RATE_LIMIT_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: limit.windowEnd,
    }
  }

  await db
    .update(otpRateLimits)
    .set({
      requestCount: limit.requestCount + 1,
      updatedAt: now,
    } as any)
    .where(eq(otpRateLimits.id, limit.id))

  return {
    allowed: true,
    remaining: OTP_RATE_LIMIT_REQUESTS - limit.requestCount - 1,
  }
}
