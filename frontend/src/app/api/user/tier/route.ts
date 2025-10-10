import { authConfig } from "@/lib/auth-config";
import { getUserTierInfo } from "@/lib/subscription";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    const tierInfo = await getUserTierInfo(session.user.id);

    if (!tierInfo) {
      return NextResponse.json(
        { error: "Failed to retrieve tier information" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tier: tierInfo.tier.tiers.name,
      displayName: tierInfo.tier.tiers.display_name,
      limits: {
        maxSecrets: tierInfo.tier.tiers.max_secrets,
        maxRecipientsPerSecret: tierInfo.tier.tiers.max_recipients_per_secret,
        customIntervals: tierInfo.tier.tiers.custom_intervals,
      },
      usage: {
        secretsCount: tierInfo.usage.secrets_count,
        totalRecipients: tierInfo.usage.total_recipients,
      },
      canCreate: tierInfo.limits.secrets.canCreate,
      subscription: tierInfo.subscription
        ? {
            status: tierInfo.subscription.status,
            currentPeriodEnd: tierInfo.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: tierInfo.subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in GET /api/user/tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
