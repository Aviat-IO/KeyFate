import { checkRateLimitDB } from "@/lib/rate-limit-db"

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

const RATE_LIMIT_WINDOWS = {
  ip: 60 * 1000, // 1 minute
  user: 60 * 1000, // 1 minute
  checkIn: 60 * 60 * 1000, // 1 hour
  secretCreation: 60 * 60 * 1000, // 1 hour
  otp: 60 * 60 * 1000, // 1 hour
}

export async function checkRateLimit(
  type: "ip" | "user" | "checkIn" | "secretCreation" | "otp",
  identifier: string,
  limit: number,
): Promise<RateLimitResult> {
  const windowMs = RATE_LIMIT_WINDOWS[type]
  return checkRateLimitDB(type, identifier, limit, windowMs)
}

export function getRateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  }
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const ip = forwarded?.split(",")[0] || realIp || "unknown"

  return ip
}

export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(0, result.reset - Math.floor(Date.now() / 1000))

  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        ...getRateLimitHeaders(result),
      },
    },
  )
}
