import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authConfig } from "@/lib/auth-config"

export async function requireCSRFProtection(
  request: NextRequest,
): Promise<{ valid: boolean; error?: string }> {
  const session = await getServerSession(authConfig)
  if (!session) {
    return { valid: false, error: "Authentication required" }
  }

  const origin = request.headers.get("origin")
  const host = request.headers.get("host")

  if (!origin) {
    return { valid: false, error: "Missing origin header" }
  }

  const originHost = new URL(origin).host
  if (originHost !== host) {
    return {
      valid: false,
      error: "Origin mismatch - potential CSRF attack",
    }
  }

  return { valid: true }
}

export function createCSRFErrorResponse() {
  return new Response(
    JSON.stringify({
      error: "CSRF validation failed",
      message: "Request origin validation failed",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  )
}
