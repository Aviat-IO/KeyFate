import { supabase } from "./supabase";
import {
  SubscriptionStatus,
  SubscriptionTier,
  TierLimits,
  UserTierInfo,
} from "../types/subscription";
import { getTierConfig } from "../constants/tiers";

// Get current user's tier information with usage and limits
export async function getUserTierInfo(
  userId: string,
): Promise<UserTierInfo | null> {
  // Get user tier with subscription and usage data
  const { data: tier, error: tierError } = await supabase
    .from("user_tiers")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (tierError) {
    console.error("Error fetching user tier:", tierError);
    return null;
  }

  // Get subscription data if exists
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Get usage data
  const { data: usage } = await supabase
    .from("subscription_usage")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!usage) {
    // Calculate usage if not exists
    await calculateUserUsage(userId);
    const { data: newUsage } = await supabase
      .from("subscription_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!newUsage) {
      console.error("Failed to calculate user usage");
      return null;
    }
  }

  const finalUsage = usage ||
    {
      secrets_count: 0,
      total_recipients: 0,
      last_calculated: new Date().toISOString(),
    };

  return {
    tier,
    subscription: subscription || undefined,
    usage: finalUsage,
    limits: {
      secrets: {
        current: finalUsage.secrets_count,
        max: tier.max_secrets,
        canCreate: finalUsage.secrets_count < tier.max_secrets,
      },
      recipients: {
        current: finalUsage.total_recipients,
        max: tier.max_recipients_per_secret,
      },
    },
  };
}

// Check if user can create a new secret
export async function canUserCreateSecret(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc("can_create_secret", { p_user_id: userId });

  if (error) {
    console.error("Error checking secret creation limit:", error);
    return false;
  }

  return data;
}

// Calculate and update user usage
export async function calculateUserUsage(userId: string) {
  const { data, error } = await supabase
    .rpc("calculate_user_usage", { p_user_id: userId });

  if (error) {
    console.error("Error calculating user usage:", error);
    return null;
  }

  return data;
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
  const config = getTierConfig(tierName);

  // Update user tier
  const { error: tierError } = await supabase
    .from("user_tiers")
    .upsert({
      user_id: userId,
      tier_name: tierName,
      max_secrets: config.maxSecrets,
      max_recipients_per_secret: config.maxRecipientsPerSecret,
      custom_intervals: config.customIntervals,
    });

  if (tierError) {
    console.error("Error updating user tier:", tierError);
    return false;
  }

  // Update subscription if provided
  if (subscriptionData) {
    const { error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: userId,
        paddle_subscription_id: subscriptionData.paddleSubscriptionId,
        paddle_customer_id: subscriptionData.paddleCustomerId,
        status: subscriptionData.status as SubscriptionStatus,
        tier_name: tierName,
        current_period_start: subscriptionData.currentPeriodStart,
        current_period_end: subscriptionData.currentPeriodEnd,
      });

    if (subscriptionError) {
      console.error("Error updating user subscription:", subscriptionError);
      return false;
    }
  }

  // Recalculate usage
  await calculateUserUsage(userId);

  return true;
}

// Initialize free tier for new users
export async function initializeUserTier(userId: string) {
  const freeConfig = getTierConfig("free");

  const { error } = await supabase
    .from("user_tiers")
    .upsert({
      user_id: userId,
      tier_name: "free",
      max_secrets: freeConfig.maxSecrets,
      max_recipients_per_secret: freeConfig.maxRecipientsPerSecret,
      custom_intervals: freeConfig.customIntervals,
    });

  if (error) {
    console.error("Error initializing user tier:", error);
    return false;
  }

  // Initialize usage tracking
  await calculateUserUsage(userId);

  return true;
}
