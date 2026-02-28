import { rateLimits } from "$lib/db/schema"
import { sql, eq, and, gt } from "drizzle-orm"

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// Lazy load db to avoid build-time initialization
async function getDb() {
  const { db } = await import("$lib/db/index")
  return db
}

export async function checkRateLimitDB(
  type: "ip" | "user" | "checkIn" | "secretCreation" | "otp",
  identifier: string,
  limit: number,
  windowMs: number = 60000,
): Promise<RateLimitResult> {
  const key = `${type}:${identifier}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMs)

  try {
    const db = await getDb()

    // Try to get existing entry
    const existing = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1)

    if (existing.length > 0) {
      const entry = existing[0]

      // Check if expired
      if (entry.expiresAt <= now) {
        // Reset count
        await db
          .update(rateLimits)
          .set({ count: 1, expiresAt })
          .where(eq(rateLimits.key, key))

        return {
          success: true,
          limit,
          remaining: limit - 1,
          reset: Math.ceil(expiresAt.getTime() / 1000),
        }
      }

      // Increment count
      const newCount = entry.count + 1
      await db
        .update(rateLimits)
        .set({ count: newCount })
        .where(eq(rateLimits.key, key))

      const success = newCount <= limit
      return {
        success,
        limit,
        remaining: Math.max(0, limit - newCount),
        reset: Math.ceil(entry.expiresAt.getTime() / 1000),
      }
    }

    // Create new entry
    await db.insert(rateLimits).values({
      key,
      count: 1,
      expiresAt,
    })

    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil(expiresAt.getTime() / 1000),
    }
  } catch (error) {
    console.error("Rate limit check failed:", error)
    // Fail open - allow request on error
    return {
      success: true,
      limit,
      remaining: limit,
      reset: 0,
    }
  }
}

export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const db = await getDb()
    const now = new Date()
    const result = await db
      .delete(rateLimits)
      .where(sql`${rateLimits.expiresAt} < ${now}`)

    // Drizzle doesn't return rowCount in a standard way, so we'll return 0
    return 0
  } catch (error) {
    console.error("Rate limit cleanup failed:", error)
    return 0
  }
}
