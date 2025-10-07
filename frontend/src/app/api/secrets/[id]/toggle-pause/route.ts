import { authConfig } from "@/lib/auth-config";
import { secretsService } from "@/lib/db/drizzle";
import { mapDrizzleSecretToApiShape } from "@/lib/db/secret-mapper";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Use NextAuth for authentication
    const session = (await getServerSession(authConfig as any)) as
      | Session
      | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = await secretsService.getById(id, session.user.id);

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    const newStatus = secret.status === "active" ? "paused" : "active";

    // Update the secret status
    const updatedSecret = await secretsService.update(
      id,
      session.user.id,
      { status: newStatus as "active" | "paused" } as any,
    );

    if (!updatedSecret) {
      return NextResponse.json({ error: "Failed to update secret" }, {
        status: 500,
      });
    }

    const mapped = mapDrizzleSecretToApiShape(updatedSecret);
    return NextResponse.json({
      success: true,
      secret: mapped,
      status: newStatus,
    });
  } catch (error) {
    console.error("Error in POST /api/secrets/[id]/toggle-pause:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
