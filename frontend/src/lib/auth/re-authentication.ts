import { validateOTPToken } from "./otp"

const RE_AUTH_WINDOW = 5 * 60 * 1000 // 5 minutes

export async function requireRecentAuthentication(
  request: Request,
  session: { user?: { id?: string; email?: string | null } } | null,
): Promise<{
  valid: boolean
  error?: string
  userId?: string
}> {
  if (!session?.user) {
    return { valid: false, error: "Authentication required" }
  }

  const userId = session.user.id
  if (!userId) {
    return { valid: false, error: "User ID not found" }
  }

  const reAuthToken = request.headers.get("x-reauth-token")
  if (!reAuthToken) {
    return {
      valid: false,
      error: "Re-authentication required",
      userId,
    }
  }

  const email = session.user.email
  if (!email) {
    return { valid: false, error: "Email not found" }
  }

  const validation = await validateOTPToken(email, reAuthToken)
  if (!validation.success || !validation.valid) {
    return {
      valid: false,
      error: "Invalid or expired re-authentication token",
      userId,
    }
  }

  return { valid: true, userId }
}

export function createReAuthErrorResponse(userId?: string) {
  return new Response(
    JSON.stringify({
      error: "Re-authentication required",
      message:
        "This sensitive operation requires recent authentication. Please verify your identity.",
      code: "REAUTH_REQUIRED",
      userId,
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  )
}
