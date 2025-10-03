import { authConfig } from "@/lib/auth-config";
import { getDatabase, secretsService } from "@/lib/db/drizzle";
import {
  checkinHistory,
  checkInTokens,
  emailNotifications,
  reminderJobs,
  secrets as secretsTable,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Use NextAuth for authentication
    type GetServerSessionOptions = Parameters<typeof getServerSession>[0];
    const session =
      (await getServerSession(authConfig as GetServerSessionOptions)) as
        | Session
        | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = await secretsService.getById(id, session.user.id);

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    return NextResponse.json(secret);
  } catch (error) {
    console.error("Error fetching secret:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Schema for updating secret metadata
const updateSecretSchema = z.object({
  title: z.string().min(1, "Title is required"),
  recipient_name: z.string().min(1, "Recipient name is required"),
  recipient_email: z.string().email().optional().or(z.literal("")),
  recipient_phone: z.string().optional().or(z.literal("")),
  contact_method: z.enum(["email", "phone", "both"]),
  check_in_days: z.number().min(1).max(365),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Use NextAuth for authentication
    type GetServerSessionOptions = Parameters<typeof getServerSession>[0];
    const session =
      (await getServerSession(authConfig as GetServerSessionOptions)) as
        | Session
        | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateSecretSchema.parse(body);

    // Map the validated data to the database schema
    const updateData = {
      title: validatedData.title,
      recipientName: validatedData.recipient_name,
      recipientEmail: validatedData.recipient_email || null,
      recipientPhone: validatedData.recipient_phone || null,
      contactMethod: validatedData.contact_method,
      checkInDays: validatedData.check_in_days,
    };

    const secret = await secretsService.update(id, updateData);

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    return NextResponse.json(secret);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error updating secret:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Use NextAuth for authentication
    type GetServerSessionOptions = Parameters<typeof getServerSession>[0];
    const session =
      (await getServerSession(authConfig as GetServerSessionOptions)) as
        | Session
        | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First verify the secret exists and belongs to the user
    const secret = await secretsService.getById(id, session.user.id);

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Cascade delete related records inside a transaction
    // Get database connection for transaction
    const db = await getDatabase();

    await db.transaction(async (tx) => {
      await tx.delete(checkinHistory).where(eq(checkinHistory.secretId, id));
      await tx.delete(checkInTokens).where(eq(checkInTokens.secretId, id));
      await tx.delete(reminderJobs).where(eq(reminderJobs.secretId, id));
      await tx.delete(emailNotifications).where(
        eq(emailNotifications.secretId, id),
      );
      await tx.delete(secretsTable).where(
        and(eq(secretsTable.id, id), eq(secretsTable.userId, session.user.id)),
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting secret:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
