import { timingSafeEqual } from "crypto"
import { NextRequest } from "next/server"

export function sanitizeError(error: unknown, secretId?: string): string {
  const message = error instanceof Error ? error.message : String(error)

  const sanitized = message
    .replace(/server_share":\s*"[^"]+"/g, 'server_share":"[REDACTED]"')
    .replace(/serverShare":\s*"[^"]+"/g, 'serverShare":"[REDACTED]"')
    .replace(/decrypted":\s*"[^"]+"/g, 'decrypted":"[REDACTED]"')
    .replace(/secret":\s*"[^"]+"/g, 'secret":"[REDACTED]"')
    .replace(/share":\s*"[^"]+"/g, 'share":"[REDACTED]"')
    .replace(/content":\s*"[^"]+"/g, 'content":"[REDACTED]"')
    .replace(/iv":\s*"[^"]+"/g, 'iv":"[REDACTED]"')
    .replace(/authTag":\s*"[^"]+"/g, 'authTag":"[REDACTED]"')
    .replace(/auth_tag":\s*"[^"]+"/g, 'auth_tag":"[REDACTED]"')
    .replace(/BEGIN\s+[A-Z\s]+KEY[^-]+-+/g, "[REDACTED_KEY]")
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, (match) => {
      if (match.length > 50) {
        return "[REDACTED_BASE64]"
      }
      return match
    })

  if (secretId) {
    return `Secret ${secretId}: ${sanitized}`
  }

  return sanitized
}

export function authorizeRequest(req: NextRequest): boolean {
  const signature = req.headers.get("x-cron-signature")
  const timestamp = req.headers.get("x-cron-timestamp")

  if (signature && timestamp) {
    return verifyHMACSignature(req, signature, timestamp)
  }

  const header =
    req.headers.get("authorization") || req.headers.get("Authorization")

  if (!header?.startsWith("Bearer ")) {
    return false
  }

  const token = header.slice(7).trim()
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !token) {
    return false
  }

  if (token.length !== cronSecret.length) {
    return false
  }

  try {
    const tokenBuffer = Buffer.from(token, "utf-8")
    const secretBuffer = Buffer.from(cronSecret, "utf-8")
    return timingSafeEqual(tokenBuffer, secretBuffer)
  } catch {
    return false
  }
}

function verifyHMACSignature(
  req: NextRequest,
  signature: string,
  timestamp: string,
): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return false
  }

  const timestampMs = parseInt(timestamp, 10)
  if (isNaN(timestampMs)) {
    return false
  }

  const now = Date.now()
  const age = now - timestampMs

  if (age < 0 || age > 5 * 60 * 1000) {
    return false
  }

  const crypto = require("crypto")

  // Validate signature is valid hex (SHA256 = 64 hex chars)
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false
  }

  // Construct the URL from the Host header and pathname to match what clients send
  const host = req.headers.get("host") || req.nextUrl.host
  const pathname = req.nextUrl.pathname
  const protocol = req.headers.get("x-forwarded-proto") || "https"
  const url = `${protocol}://${host}${pathname}`

  const message = `${timestampMs}.${url}`
  const expectedSignature = crypto
    .createHmac("sha256", cronSecret)
    .update(message)
    .digest("hex")

  try {
    const signatureBuffer = Buffer.from(signature, "hex")
    const expectedBuffer = Buffer.from(expectedSignature, "hex")

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export const CRON_CONFIG = {
  TIMEOUT_MS: 9 * 60 * 1000,
  MAX_RETRIES: 3,
  ADMIN_NOTIFICATION_THRESHOLD: 3,
  BACKOFF_BASE_MS: 5 * 60 * 1000,
  BACKOFF_MAX_MS: 60 * 60 * 1000,
  MAX_REMINDERS_PER_RUN_PER_SECRET: 10,
  RETRY_BACKOFF_EXPONENT: 2,
  RETRY_BACKOFF_BASE_MINUTES: 5,
  BATCH_SIZE: 100,
  MAX_SECRET_RETRIES: 5,
  MAX_CONCURRENT_SECRETS: 20,
  CRON_INTERVAL_MS: 15 * 60 * 1000,
} as const

export function isApproachingTimeout(startTime: number): boolean {
  return Date.now() - startTime > CRON_CONFIG.TIMEOUT_MS
}

export function logCronMetrics(
  jobName: string,
  metrics: {
    duration: number
    processed: number
    succeeded: number
    failed: number
  },
) {
  console.log(
    `[${jobName}] Completed in ${metrics.duration}ms - Processed: ${metrics.processed}, Succeeded: ${metrics.succeeded}, Failed: ${metrics.failed}`,
  )
}
