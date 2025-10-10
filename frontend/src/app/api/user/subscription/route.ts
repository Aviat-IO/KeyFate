import { authConfig } from "@/lib/auth-config";
import { getUserTierInfo } from "@/lib/subscription";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = (await getServerSession(authConfig as any)) as Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tierInfo = await getUserTierInfo(session.user.id);

    if (!tierInfo) {
      return NextResponse.json({ tier: { name: "free" } });
    }

    return NextResponse.json({
      tier: {
        name: tierInfo.tier.tiers.name,
        displayName: tierInfo.tier.tiers.display_name,
      },
      subscription: tierInfo.subscription ? {
        status: tierInfo.subscription.status,
      } : null,
    });
  } catch (error) {
    console.error("Error in GET /api/user/subscription:", error);
    return NextResponse.json({ tier: { name: "free" } });
  }
}
