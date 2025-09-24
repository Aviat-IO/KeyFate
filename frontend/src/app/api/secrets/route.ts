import { authConfig } from "@/lib/auth-config";
import { ensureUserExists } from "@/lib/auth/user-verification";
import { secretsService } from "@/lib/db/drizzle";
import { RobustSecretsService } from "@/lib/db/secrets-service-robust";
import { encryptMessage } from "@/lib/encryption";
import { secretSchema } from "@/lib/schemas/secret";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  let insertData: Record<string, unknown>; // Declare here so it's available in catch block

  try {
    // Use NextAuth for authentication instead of Supabase auth
    let session: Session | null;
    try {
      type GetServerSessionOptions = Parameters<typeof getServerSession>[0];
      session =
        (await getServerSession(authConfig as GetServerSessionOptions)) as
          | Session
          | null;
    } catch (sessionError) {
      console.error("NextAuth session error:", sessionError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database before creating secret
    try {
      const userVerification = await ensureUserExists(session);
      console.log("[Secrets API] User verification result:", {
        exists: userVerification.exists,
        created: userVerification.created,
        userId: session.user.id,
      });
    } catch (userError) {
      console.error("[Secrets API] User verification failed:", userError);
      return NextResponse.json(
        { error: "Failed to verify user account" },
        { status: 500 },
      );
    }

    // Note: Using direct database connection via Drizzle instead of Supabase client

    const body = await request.json();

    // Validate the request body
    let validatedData;
    try {
      validatedData = secretSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        return NextResponse.json(
          { error: firstError.message },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    // Encrypt the server share before storing (only if not already provided)
    let encryptedServerShare: string;
    let iv: string;
    let authTag: string;

    if (validatedData.iv && validatedData.auth_tag) {
      // Use provided encrypted data (for testing/backward compatibility)
      encryptedServerShare = validatedData.server_share;
      iv = validatedData.iv;
      authTag = validatedData.auth_tag;
    } else {
      // Encrypt the plain server share
      const encrypted = await encryptMessage(validatedData.server_share);
      encryptedServerShare = encrypted.encrypted;
      iv = encrypted.iv;
      authTag = encrypted.authTag;
    }

    // Handle contact method logic
    insertData = {
      title: validatedData.title,
      recipientName: validatedData.recipient_name,
      recipientEmail: validatedData.contact_method === "phone"
        ? null
        : validatedData.recipient_email,
      recipientPhone: validatedData.recipient_phone || null,
      contactMethod: validatedData.contact_method,
      checkInDays: validatedData.check_in_days,
      serverShare: encryptedServerShare,
      iv: iv,
      authTag: authTag,
      userId: session.user.id,
      sssSharesTotal: validatedData.sss_shares_total,
      sssThreshold: validatedData.sss_threshold,
      status: "active" as const,
      nextCheckIn: new Date(
        Date.now() + validatedData.check_in_days * 24 * 60 * 60 * 1000,
      ),
    };

    // Add logging to debug the insert data structure
    console.log("Insert data structure:", JSON.stringify(insertData, null, 2));

    // Try the standard service first, fall back to robust service if needed
    let data;
    try {
      data = await secretsService.create(insertData as any);
    } catch (error) {
      if (error instanceof Error && error.message.includes("recipient_name")) {
        console.log("Using robust service due to schema issue");
        const robustService = new RobustSecretsService(
          process.env.DATABASE_URL!,
        );
        data = await robustService.create(insertData as any);
      } else {
        throw error;
      }
    }

    // Note: Reminder scheduling would be handled by a separate service
    // For now, we'll skip this to get the basic functionality working
    const warning = undefined;

    const responseBody = {
      secretId: data.id,
      ...data,
      ...(warning && { warning }),
    };

    const res = NextResponse.json(responseBody, { status: 201 });
    res.headers.set("Location", `/api/secrets/${data.id}`);
    return res;
  } catch (error) {
    console.error("Error in POST /api/secrets:", error);

    // Check if this is a database column error
    if (error instanceof Error && error.message.includes("recipient_name")) {
      console.error("Column mapping error detected:", error.message);
      if (insertData) {
        console.error("Insert data was:", JSON.stringify(insertData, null, 2));
      }

      return NextResponse.json(
        {
          error: "Database schema mismatch: recipient_name column issue",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create secret" },
      { status: 500 },
    );
  }
}
