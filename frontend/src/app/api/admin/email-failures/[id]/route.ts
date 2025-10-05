/**
 * Email Failure Resolution API
 *
 * DELETE /api/admin/email-failures/:id - Mark failure as resolved
 * Provides admin interface for marking failures as manually resolved
 */

import { NextRequest, NextResponse } from "next/server";
import { DeadLetterQueue } from "@/lib/email/dead-letter-queue";

export const dynamic = "force-dynamic";

/**
 * Authorization helper
 */
async function isAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const adminToken = process.env.ADMIN_TOKEN || "admin-secret";
  return authHeader === `Bearer ${adminToken}`;
}

/**
 * DELETE /api/admin/email-failures/:id
 *
 * Mark a failed email as resolved without retry
 * Used when admin manually fixes issue or determines retry is not needed
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: failureId } = await params;

    const dlq = new DeadLetterQueue();
    const resolved = await dlq.markResolved(failureId);

    return NextResponse.json({
      success: true,
      failure: {
        id: resolved.id,
        emailType: resolved.emailType,
        recipient: resolved.recipient,
        resolvedAt: resolved.resolvedAt,
      },
    });
  } catch (error) {
    console.error("[admin/email-failures/delete] DELETE error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Email failure not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to resolve email failure",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
