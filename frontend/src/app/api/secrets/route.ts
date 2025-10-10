import { authConfig } from "@/lib/auth-config";
import { ensureUserExists } from "@/lib/auth/user-verification";
import { secretsService } from "@/lib/db/drizzle";
import { RobustSecretsService } from "@/lib/db/secrets-service-robust";
import { encryptMessage } from "@/lib/encryption";
import { secretSchema } from "@/lib/schemas/secret";
import { canUserCreateSecret, getUserTierInfo, isIntervalAllowed } from "@/lib/subscription";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

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

    const canCreate = await canUserCreateSecret(session.user.id);
    if (!canCreate) {
      const tierInfo = await getUserTierInfo(session.user.id);
      const tierName = tierInfo?.tier?.tiers?.name ?? "free";
      const maxSecrets = tierInfo?.tier?.tiers?.max_secrets ?? 1;
      return NextResponse.json(
        {
          error: `Secret limit reached. Your ${tierName} tier allows ${maxSecrets} secret${maxSecrets === 1 ? "" : "s"}. Upgrade to Pro for more.`,
          code: "TIER_LIMIT_EXCEEDED",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

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

    const tierInfo = await getUserTierInfo(session.user.id);
    const userTier = (tierInfo?.tier?.tiers?.name ?? "free") as "free" | "pro";
    const maxRecipients = tierInfo?.tier?.tiers?.max_recipients_per_secret ?? 1;

    if (!isIntervalAllowed(userTier, validatedData.check_in_days)) {
      return NextResponse.json(
        {
          error: `Check-in interval of ${validatedData.check_in_days} days is not allowed for your tier. Upgrade to Pro for custom intervals.`,
          code: "INTERVAL_NOT_ALLOWED",
        },
        { status: 403 },
      );
    }

    if (validatedData.recipients.length > maxRecipients) {
      return NextResponse.json(
        {
          error: `Recipient limit exceeded. Your ${userTier} tier allows ${maxRecipients} recipient${maxRecipients === 1 ? "" : "s"} per secret. Upgrade to Pro for more.`,
          code: "RECIPIENT_LIMIT_EXCEEDED",
        },
        { status: 403 },
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

    // Create secret without recipients (they'll be added separately)
    insertData = {
      title: validatedData.title,
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

    console.log("Insert data structure:", JSON.stringify(insertData, null, 2));

    // Create the secret
    let data;
    try {
      data = await secretsService.create(insertData as any);
    } catch (error) {
      if (error instanceof Error && error.message.includes("recipient")) {
        console.log("Using robust service due to schema issue");
        const robustService = new RobustSecretsService(
          process.env.DATABASE_URL!,
        );
        data = await robustService.create(insertData as any);
      } else {
        throw error;
      }
    }

    // Now insert the recipients
    const db = await import("@/lib/db/drizzle").then(m => m.getDatabase());
    const { secretRecipients } = await import("@/lib/db/schema");
    
    await db.insert(secretRecipients).values(
      validatedData.recipients.map((recipient, index) => ({
        secretId: data.id,
        name: recipient.name,
        email: recipient.email,
        isPrimary: recipient.isPrimary || index === 0,
      }))
    );

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
