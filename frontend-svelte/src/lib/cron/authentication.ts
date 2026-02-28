import type { NextRequest } from "$lib/compat/next-server"
import crypto from "crypto"

const REPLAY_WINDOW = 5 * 60 * 1000 // 5 minutes

export function generateCronSignature(
  payload: string,
  timestamp: number,
  secret: string,
): string {
  const message = `${timestamp}.${payload}`
  return crypto.createHmac("sha256", secret).update(message).digest("hex")
}

export function verifyCronSignature(request: NextRequest): {
  valid: boolean
  error?: string
} {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return { valid: false, error: "CRON_SECRET not configured" }
  }

  const signature = request.headers.get("x-cron-signature")
  const timestamp = request.headers.get("x-cron-timestamp")

  if (!signature || !timestamp) {
    return { valid: false, error: "Missing cron authentication headers" }
  }

  // Validate signature is valid hex (SHA256 = 64 hex chars)
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return { valid: false, error: "Invalid signature format" }
  }

  const timestampMs = parseInt(timestamp, 10)
  if (isNaN(timestampMs)) {
    return { valid: false, error: "Invalid timestamp format" }
  }

  const now = Date.now()
  const age = now - timestampMs

  if (age < 0) {
    return { valid: false, error: "Timestamp is in the future" }
  }

  if (age > REPLAY_WINDOW) {
    return {
      valid: false,
      error: `Request too old (${Math.floor(age / 1000)}s, max 300s)`,
    }
  }

  // Construct the URL from the Host header and pathname to match what clients send
  const host = request.headers.get("host") || request.nextUrl.host
  const pathname = request.nextUrl.pathname
  const protocol = request.headers.get("x-forwarded-proto") || "https"
  const url = `${protocol}://${host}${pathname}`

  const expectedSignature = generateCronSignature(url, timestampMs, cronSecret)

  const signatureBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expectedSignature, "hex")

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false, error: "Invalid signature" }
  }

  return { valid: true }
}

export function createCronAuthErrorResponse(error?: string) {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      message: error || "Invalid cron authentication",
    }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    },
  )
}
