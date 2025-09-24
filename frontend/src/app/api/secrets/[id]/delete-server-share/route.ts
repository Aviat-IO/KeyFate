import { authConfig } from "@/lib/auth-config";
import { db } from "@/lib/db/drizzle";
import { secrets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authConfig as any)) as
      | Session
      | null;
    const user = session?.user as
      | (Session["user"] & { id?: string })
      | undefined
      | null;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership and update in one go
    const result = await db
      .update(secrets)
      .set({
        serverShare: null,
        iv: null,
        authTag: null,
        status: "paused",
        updatedAt: new Date(),
      } as any)
      .where(and(eq(secrets.id, id), eq(secrets.userId, user.id)))
      .returning();
    if (result.length === 0) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Error in POST /api/secrets/[id]/delete-server-share:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
