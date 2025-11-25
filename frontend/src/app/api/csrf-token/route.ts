import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authConfig } from "@/lib/auth-config"
import { generateCSRFToken } from "@/lib/csrf"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authConfig)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      )
    }

    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const token = await generateCSRFToken(userId)

    return NextResponse.json({
      token,
      expiresIn: 3600, // 1 hour in seconds
    })
  } catch (error) {
    console.error("Error generating CSRF token:", error)
    return NextResponse.json(
      { error: "Failed to generate CSRF token" },
      { status: 500 },
    )
  }
}
