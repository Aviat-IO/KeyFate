import { getDatabase } from "@/lib/db/drizzle";
import { checkInTokens, secrets } from "@/lib/db/schema";
import { decryptMessage } from "@/lib/encryption";
import { and, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!id) {
    return NextResponse.json({ error: "Secret ID is required" }, {
      status: 400,
    });
  }
  if (!token) {
    return NextResponse.json({ error: "Access token is required" }, {
      status: 400,
    });
  }

  try {
    const db = await getDatabase();
    // 1. Fetch and validate the token
    const tokenRows = await db
      .select()
      .from(checkInTokens)
      .where(
        and(eq(checkInTokens.token, token), eq(checkInTokens.secretId, id)),
      )
      .limit(1);
    const tokenData = tokenRows[0];

    if (!tokenData) {
      console.error("Token validation error: not found");
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 403 },
      );
    }

    const now = new Date();
    if (tokenData.usedAt) {
      const usedAtDate = new Date(tokenData.usedAt);
      const gracePeriodEnds = new Date(
        usedAtDate.getTime() + 24 * 60 * 60 * 1000,
      ); // 24 hour grace period
      if (now > gracePeriodEnds) {
        return NextResponse.json(
          {
            error:
              "Token has already been used and the grace period has expired.",
          },
          { status: 403 },
        );
      }
      // If within grace period, allow access but don't update used_at again.
    }

    if (now > new Date(tokenData.expiresAt)) {
      return NextResponse.json(
        { error: "Token has expired." },
        { status: 403 },
      );
    }

    // 2. Fetch the secret
    const secretRows = await db
      .select({
        serverShare: secrets.serverShare,
        iv: secrets.iv,
        authTag: secrets.authTag,
      })
      .from(secrets)
      .where(eq(secrets.id, id))
      .limit(1);
    const secret = secretRows[0];

    if (!secret) {
      console.error("Secret fetch error: not found");
      return NextResponse.json({ error: "Secret not found." }, { status: 404 });
    }

    if (!secret.serverShare || !secret.iv || !secret.authTag) {
      console.error("Secret data incomplete for decryption:", secret);
      return NextResponse.json(
        {
          error:
            "This secret has been disabled. The server share has been deleted and is no longer available.",
        },
        { status: 410 }, // 410 Gone - resource no longer available
      );
    }

    // 3. Decrypt the server share
    const decryptedServerShare = await decryptMessage(
      secret.serverShare,
      Buffer.from(secret.iv, "base64"),
      Buffer.from(secret.authTag, "base64"),
    );

    // 4. Mark token as used if it hasn't been marked already
    if (!tokenData.usedAt) {
      await db.execute(
        sql`update "check_in_tokens" set "used_at" = ${now} where "id" = ${tokenData.id}`,
      );
    }

    return NextResponse.json({ serverShare: decryptedServerShare });
  } catch (error: unknown) {
    console.error("[ServerShare API Error]:", error);
    return NextResponse.json(
      {
        error: "Internal server error: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 },
    );
  }
}
