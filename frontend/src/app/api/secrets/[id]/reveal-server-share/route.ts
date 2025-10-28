import { authConfig } from "@/lib/auth-config"
import { requireCSRFProtection, createCSRFErrorResponse } from "@/lib/csrf"
import {
  requireRecentAuthentication,
  createReAuthErrorResponse,
} from "@/lib/auth/re-authentication"
import { getDatabase } from "@/lib/db/drizzle"
import { secrets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const csrfCheck = await requireCSRFProtection(request)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const reAuthCheck = await requireRecentAuthentication(request)
    if (!reAuthCheck.valid) {
      return createReAuthErrorResponse(reAuthCheck.userId)
    }

    const session = (await getServerSession(
      authConfig as any,
    )) as Session | null
    const user = session?.user as
      | (Session["user"] & { id?: string })
      | undefined
      | null
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDatabase()
    const result = await db
      .select()
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.userId, user.id)))
      .limit(1)
    const secret = result[0]

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 })
    }

    if (!secret.serverShare) {
      return NextResponse.json(
        { error: "No server share to reveal" },
        {
          status: 404,
        },
      )
    }

    return NextResponse.json({
      success: true,
      server_share: secret.serverShare,
      iv: secret.iv,
      auth_tag: secret.authTag,
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/reveal-server-share:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
