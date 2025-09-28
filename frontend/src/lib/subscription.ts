import { getTierConfig } from "../constants/tiers";
import {
  SubscriptionTier,
  TierLimits,
  UserTierInfo,
} from "../types/subscription";
import { getDatabase } from "./db/drizzle";
import { userSubscriptions } from "./db/schema";

// Get current user's tier information with usage and limits
export async function getUserTierInfo(
  userId: string,
): Promise<UserTierInfo | null> {
  try {
    const db = await getDatabase();
    // Drizzle-based minimal stub until full tier system is migrated
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(
        (userSubscriptions as any).userId
          ? (db as any).drizzle.sql`${
            (userSubscriptions as any).user_id
          } = ${userId}`
          : undefined as any,
      )
      .limit(1);

    const defaultLimits: TierLimits = {
      maxSecrets: 3,
      maxRecipientsPerSecret: 1,
      customIntervals: false,
    };

    return {
      tier: {
        tiers: {
          max_secrets: defaultLimits.maxSecrets,
          max_recipients_per_secret: defaultLimits.maxRecipientsPerSecret,
          custom_intervals: defaultLimits.customIntervals,
        },
      } as any,
      subscription: subscription as any,
      usage: { secrets_count: 0, total_recipients: 0 } as any,
      limits: {
        secrets: { current: 0, max: defaultLimits.maxSecrets, canCreate: true },
        recipients: { current: 0, max: defaultLimits.maxRecipientsPerSecret },
      },
    };
  } catch (error) {
    console.error("Error in getUserTierInfo:", error);
    return null;
  }
}

// Check if user can create a new secret
export async function canUserCreateSecret(_userId: string): Promise<boolean> {
  // Allow for now; enforce limits in future implementation
  return true;
}

// Calculate and update user usage
export async function calculateUserUsage(_userId: string) {
  return { secrets_count: 0, total_recipients: 0 } as any;
}

// Get tier limits for enforcement
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  const config = getTierConfig(tier);
  return {
    maxSecrets: config.maxSecrets,
    maxRecipientsPerSecret: config.maxRecipientsPerSecret,
    customIntervals: config.customIntervals,
  };
}

// Check if an interval is allowed for a tier
export function isIntervalAllowed(
  tier: SubscriptionTier,
  intervalDays: number,
): boolean {
  const config = getTierConfig(tier);

  if (config.customIntervals) {
    // Pro tier allows: 1 day, 3 days, 7 days, 2 weeks, 1 month, 3 months, 6 months, 12 months, 3 years
    const allowedDays = [1, 3, 7, 14, 30, 90, 180, 365, 1095];
    return allowedDays.includes(intervalDays);
  } else {
    // Free tier allows: 1 week, 1 month, 1 year
    const allowedDays = [7, 30, 365];
    return allowedDays.includes(intervalDays);
  }
}

// Get available intervals for a tier
export function getAvailableIntervals(
  tier: SubscriptionTier,
): Array<{ days: number; label: string }> {
  const config = getTierConfig(tier);

  if (config.customIntervals) {
    // Pro tier intervals
    return [
      { days: 1, label: "1 day" },
      { days: 3, label: "3 days" },
      { days: 7, label: "1 week" },
      { days: 14, label: "2 weeks" },
      { days: 30, label: "1 month" },
      { days: 90, label: "3 months" },
      { days: 180, label: "6 months" },
      { days: 365, label: "1 year" },
      { days: 1095, label: "3 years" },
    ];
  } else {
    // Free tier intervals
    return [
      { days: 7, label: "1 week" },
      { days: 30, label: "1 month" },
      { days: 365, label: "1 year" },
    ];
  }
}

// Update user tier (typically called from webhook or admin functions)
export async function updateUserTier(
  userId: string,
  tierName: SubscriptionTier,
  subscriptionData?: {
    paddleSubscriptionId: string;
    paddleCustomerId: string;
    status: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
  },
) {
  // Stubbed no-op for now
  await calculateUserUsage(userId);
  return true;
}

// Initialize free tier for new users
export async function initializeUserTier(userId: string) {
  await calculateUserUsage(userId);
  return true;
}
