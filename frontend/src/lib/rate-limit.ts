interface RateLimitOptions {
  interval: number
  uniqueTokenPerInterval?: number
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

const tokenCache = new Map<string, { timestamps: number[]; expiry: number }>()

export function rateLimit(options: RateLimitOptions) {
  const { interval, uniqueTokenPerInterval = 500 } = options

  return {
    check: async (limit: number, token: string): Promise<RateLimitResult> => {
      const now = Date.now()
      const cached = tokenCache.get(token)

      if (cached && cached.expiry < now) {
        tokenCache.delete(token)
      }

      const entry = tokenCache.get(token) || {
        timestamps: [],
        expiry: now + interval,
      }
      const windowStart = now - interval
      const validTokens = entry.timestamps.filter(
        (timestamp) => timestamp > windowStart,
      )

      if (validTokens.length >= limit) {
        const oldestToken = Math.min(...validTokens)
        const reset = oldestToken + interval

        return {
          success: false,
          limit,
          remaining: 0,
          reset: Math.ceil(reset / 1000),
        }
      }

      validTokens.push(now)
      tokenCache.set(token, {
        timestamps: validTokens,
        expiry: now + interval,
      })

      return {
        success: true,
        limit,
        remaining: limit - validTokens.length,
        reset: Math.ceil((now + interval) / 1000),
      }
    },
  }
}

const limiters = {
  ip: rateLimit({ interval: 60 * 1000 }),
  user: rateLimit({ interval: 60 * 1000 }),
  checkIn: rateLimit({ interval: 60 * 60 * 1000 }),
  secretCreation: rateLimit({ interval: 60 * 60 * 1000 }),
  otp: rateLimit({ interval: 60 * 60 * 1000 }),
}

export async function checkRateLimit(
  type: "ip" | "user" | "checkIn" | "secretCreation" | "otp",
  identifier: string,
  limit: number,
): Promise<RateLimitResult> {
  const limiter = limiters[type]
  return limiter.check(limit, identifier)
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
