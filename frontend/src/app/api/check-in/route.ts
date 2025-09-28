import { getDatabase } from "@/lib/db/drizzle";
import { checkInTokens, secrets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const db = await getDatabase();
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const [tokenRow] = await db
      .select()
      .from(checkInTokens)
      .where(eq(checkInTokens.token, token))
      .limit(1);

    if (!tokenRow) {
      return NextResponse.json({ error: "Invalid or expired token" }, {
        status: 400,
      });
    }

    if (tokenRow.usedAt) {
      return NextResponse.json({ error: "Token has already been used" }, {
        status: 400,
      });
    }

    if (new Date(tokenRow.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Token has expired" }, { status: 400 });
    }

    const [secret] = await db
      .select({
        id: secrets.id,
        title: secrets.title,
        checkInDays: secrets.checkInDays,
      })
      .from(secrets)
      .where(eq(secrets.id, tokenRow.secretId))
      .limit(1);

    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    const now = new Date();
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + (secret.checkInDays ?? 30));

    await db
      .update(checkInTokens)
      .set({ usedAt: now } as any)
      .where(eq(checkInTokens.id, tokenRow.id));

    await db
      .update(secrets)
      .set({ lastCheckIn: now, nextCheckIn } as any)
      .where(eq(secrets.id, tokenRow.secretId));

    return NextResponse.json({
      success: true,
      secretTitle: secret.title,
      nextCheckIn: nextCheckIn.toISOString(),
      message: `Your secret "${secret.title}" timer has been reset.`,
    });
  } catch (error) {
    console.error("/api/check-in error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, {
      status: 500,
    });
  }
}
