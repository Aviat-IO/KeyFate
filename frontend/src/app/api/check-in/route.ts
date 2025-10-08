import { getDatabase } from "@/lib/db/drizzle";
import { checkInTokens, secrets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

// Add a GET handler for debugging purposes
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  return NextResponse.json({
    message: "Check-in endpoint is active. Use POST method to check in.",
    hasToken: !!token,
    method: "GET",
    timestamp: new Date().toISOString()
  }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate environment
    if (!process.env.DATABASE_URL) {
      console.error('[CHECK-IN] DATABASE_URL not configured');
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      );
    }

    const db = await getDatabase();
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // Log check-in attempt (security monitoring)
    console.log('[CHECK-IN] Attempt received', {
      timestamp: new Date().toISOString(),
      hasToken: !!token,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      method: req.method,
      url: req.url
    });

    if (!token) {
      console.warn('[CHECK-IN] Missing token parameter');
      return NextResponse.json(
        { error: "Missing token" },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const [tokenRow] = await db
      .select()
      .from(checkInTokens)
      .where(eq(checkInTokens.token, token))
      .limit(1);

    if (!tokenRow) {
      // Use constant-time delay to prevent timing attacks
      const elapsed = Date.now() - startTime;
      if (elapsed < 100) {
        await new Promise(resolve => setTimeout(resolve, 100 - elapsed));
      }

      console.warn('[CHECK-IN] Invalid token attempt', {
        timestamp: new Date().toISOString(),
        tokenPrefix: token.substring(0, 8) + '...'
      });

      return NextResponse.json(
        { error: "Invalid or expired token" },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (tokenRow.usedAt) {
      console.warn('[CHECK-IN] Token reuse attempt', {
        timestamp: new Date().toISOString(),
        tokenId: tokenRow.id,
        secretId: tokenRow.secretId,
        originalUse: tokenRow.usedAt.toISOString()
      });

      return NextResponse.json(
        { error: "Token has already been used" },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (new Date(tokenRow.expiresAt) < new Date()) {
      console.warn('[CHECK-IN] Expired token attempt', {
        timestamp: new Date().toISOString(),
        tokenId: tokenRow.id,
        secretId: tokenRow.secretId,
        expiresAt: tokenRow.expiresAt.toISOString()
      });

      return NextResponse.json(
        { error: "Token has expired" },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
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
      return NextResponse.json(
        { error: "Secret not found" },
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate next check-in using milliseconds to avoid DST issues
    const now = new Date();
    const nextCheckIn = new Date(now.getTime() + ((secret.checkInDays ?? 30) * 24 * 60 * 60 * 1000));

    await db
      .update(checkInTokens)
      .set({ usedAt: now } as any)
      .where(eq(checkInTokens.id, tokenRow.id));

    await db
      .update(secrets)
      .set({ lastCheckIn: now, nextCheckIn } as any)
      .where(eq(secrets.id, tokenRow.secretId));

    // Log successful check-in for security monitoring
    console.log('[CHECK-IN] Success', {
      timestamp: new Date().toISOString(),
      tokenId: tokenRow.id,
      secretId: secret.id,
      secretTitle: secret.title,
      nextCheckIn: nextCheckIn.toISOString(),
      processingTime: Date.now() - startTime + 'ms'
    });

    return NextResponse.json(
      {
        success: true,
        secretTitle: secret.title,
        nextCheckIn: nextCheckIn.toISOString(),
        message: `Your secret "${secret.title}" timer has been reset.`,
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("[CHECK-IN] Error:", {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
