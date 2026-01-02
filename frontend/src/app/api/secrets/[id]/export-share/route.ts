import { authConfig } from "@/lib/auth-config"
import { requireCSRFProtection, createCSRFErrorResponse } from "@/lib/csrf"
import {
  requireRecentAuthentication,
  createReAuthErrorResponse,
} from "@/lib/auth/re-authentication"
import { getDatabase } from "@/lib/db/drizzle"
import { secrets } from "@/lib/db/schema"
import { decryptMessage } from "@/lib/encryption"
import { and, eq } from "drizzle-orm"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

// Validation schema for secret ID
const secretIdSchema = z.string().uuid({
  message: "Invalid secret ID format",
})

/**
 * Export Share API
 *
 * Returns the DECRYPTED server share for inclusion in a recovery kit.
 * Requires CSRF protection and recent re-authentication for security.
 *
 * This is different from reveal-server-share which returns encrypted data.
 * The decryption happens server-side since the encryption key is not available client-side.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Validate UUID format before any processing
    const validation = secretIdSchema.safeParse(id)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid secret ID format",
          details: validation.error.flatten().formErrors,
        },
        { status: 400 },
      )
    }

    const csrfCheck = await requireCSRFProtection(request)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const reAuthCheck = await requireRecentAuthentication(request)
    if (!reAuthCheck.valid) {
      return createReAuthErrorResponse(reAuthCheck.userId)
    }

    const session = (await getServerSession(authConfig as any)) as Session | null
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
        { error: "No server share to export" },
        { status: 404 },
      )
    }

    // Decrypt the server share
    const decryptedShare = await decryptMessage(
      secret.serverShare,
      Buffer.from(secret.iv!, "base64"),
      Buffer.from(secret.authTag!, "base64"),
      secret.keyVersion ?? undefined,
    )

    return NextResponse.json({
      success: true,
      serverShare: decryptedShare,
      metadata: {
        id: secret.id,
        title: secret.title,
        checkInDays: secret.checkInDays,
        createdAt: secret.createdAt?.toISOString(),
        threshold: secret.sssThreshold,
        totalShares: secret.sssSharesTotal,
      },
    })
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/export-share:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
