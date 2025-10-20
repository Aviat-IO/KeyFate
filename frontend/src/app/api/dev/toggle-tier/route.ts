import { authConfig } from "@/lib/auth-config"
import { getDatabase } from "@/lib/db/get-database"
import { userSubscriptions, subscriptionTiers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  // Only allow in development and staging
  const env = process.env.NODE_ENV
  const isStaging =
    process.env.NEXT_PUBLIC_APP_ENV === "staging" ||
    process.env.NEXT_PUBLIC_ENV === "staging" ||
    process.env.VERCEL_ENV === "preview"

  const isDevelopment = env === "development"

  if (!isDevelopment && !isStaging) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    )
  }

  console.log("[DEV Toggle] Starting tier toggle...")

  try {
    const session = (await getServerSession(
      authConfig as any,
    )) as Session | null

    if (!session?.user?.id) {
      console.error("[DEV Toggle] No session found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[DEV Toggle] User ID:", session.user.id)

    const db = await getDatabase()

    // Check current subscription
    const [currentSub] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, session.user.id))
      .limit(1)

    console.log(
      "[DEV Toggle] Current subscription:",
      currentSub ? "exists" : "none",
    )

    // Get free and pro tier IDs - create them if they don't exist
    let [freeTier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.name, "free"))
      .limit(1)

    let [proTier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.name, "pro"))
      .limit(1)

    console.log("[DEV Toggle] Free tier:", freeTier ? "found" : "not found")
    console.log("[DEV Toggle] Pro tier:", proTier ? "found" : "not found")

    // Create tiers if they don't exist
    if (!freeTier) {
      console.log("[DEV Toggle] Creating free tier...")
      const [newFreeTier] = await db
        .insert(subscriptionTiers)
        .values({
          name: "free",
          displayName: "Free",
          maxSecrets: 1,
          maxRecipientsPerSecret: 1,
          customIntervals: false,
          priceMonthly: null,
          priceYearly: null,
        } as any)
        .returning()
      freeTier = newFreeTier
    }

    if (!proTier) {
      console.log("[DEV Toggle] Creating pro tier...")
      const [newProTier] = await db
        .insert(subscriptionTiers)
        .values({
          name: "pro",
          displayName: "Pro",
          maxSecrets: 10,
          maxRecipientsPerSecret: 5,
          customIntervals: true,
          priceMonthly: "9.99",
          priceYearly: "99.99",
        } as any)
        .returning()
      proTier = newProTier
    }

    if (!freeTier || !proTier) {
      console.error("[DEV Toggle] Failed to create tier configuration")
      return NextResponse.json(
        { error: "Failed to initialize tier configuration" },
        { status: 500 },
      )
    }

    if (!currentSub) {
      // No subscription exists - create a pro subscription
      console.log("[DEV Toggle] Creating new pro subscription")
      const insertData: any = {
        userId: session.user.id,
        tierId: proTier.id,
        provider: "dev-bypass",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        cancelAtPeriodEnd: false,
      }

      try {
        await db.insert(userSubscriptions).values(insertData)
        console.log("[DEV Toggle] Successfully created pro subscription")
      } catch (insertError) {
        console.error(
          "[DEV Toggle] Failed to insert subscription:",
          insertError,
        )
        throw insertError
      }

      return NextResponse.json({
        success: true,
        newTier: "pro",
        message: "Upgraded to Pro tier (dev mode)",
      })
    }

    // Toggle between free and pro
    const isCurrentlyPro = currentSub.tierId === proTier.id
    const newTierId = isCurrentlyPro ? freeTier.id : proTier.id
    const newTierName = isCurrentlyPro ? "free" : "pro"

    console.log("[DEV Toggle] Current tier:", isCurrentlyPro ? "pro" : "other")
    console.log("[DEV Toggle] Switching to:", newTierName)

    if (isCurrentlyPro) {
      // Switch to free by deleting subscription
      console.log("[DEV Toggle] Deleting subscription to switch to free")
      await db
        .delete(userSubscriptions)
        .where(eq(userSubscriptions.userId, session.user.id))
    } else {
      // Switch to pro by updating subscription
      console.log("[DEV Toggle] Updating subscription to pro")
      const updateData: any = {
        tierId: newTierId,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }
      await db
        .update(userSubscriptions)
        .set(updateData)
        .where(eq(userSubscriptions.userId, session.user.id))
    }

    console.log("[DEV Toggle] Successfully switched to", newTierName)

    return NextResponse.json({
      success: true,
      newTier: newTierName,
      message: `Switched to ${newTierName} tier (dev mode)`,
    })
  } catch (error) {
    console.error("[DEV Toggle] Error toggling tier:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 },
    )
  }
}
