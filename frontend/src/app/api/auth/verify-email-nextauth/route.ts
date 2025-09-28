import { getDatabase } from "@/lib/db/drizzle";
import { users, verificationTokens } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const body = await request.json();

    // Validate request body
    const validation = verifyEmailSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const { token, email } = validation.data;

    // Verify the token exists and hasn't expired
    const verificationResult = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.token, token),
        ),
      )
      .limit(1);

    const verificationRecord = verificationResult[0];
    if (!verificationRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification token",
        },
        { status: 400 },
      );
    }

    // Check if token has expired
    if (verificationRecord.expires < new Date()) {
      // Clean up expired token
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, token));

      return NextResponse.json(
        {
          success: false,
          error: "Verification token has expired",
        },
        { status: 400 },
      );
    }

    // Update user's email verification status
    const updateResult = await db
      .update(users)
      .set({
        emailVerified: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(users.email, email))
      .returning();

    const updatedUser = updateResult[0];
    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      );
    }

    // Remove the used verification token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token));

    console.log(`[VerifyEmail] Successfully verified email for user: ${email}`);

    return NextResponse.json({
      success: true,
      verified: true,
      message: "Email successfully verified",
    });
  } catch (error) {
    console.error("[VerifyEmail] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred during verification",
      },
      { status: 500 },
    );
  }
}
