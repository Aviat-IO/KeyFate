import { Database } from "@/types/database.types";

export type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];
export type SubscriptionStatus =
  Database["public"]["Enums"]["subscription_status"];

export type UserTier = Database["public"]["Tables"]["user_tiers"]["Row"];
export type UserTierInsert =
  Database["public"]["Tables"]["user_tiers"]["Insert"];
export type UserTierUpdate =
  Database["public"]["Tables"]["user_tiers"]["Update"];

export type UserSubscription =
  Database["public"]["Tables"]["user_subscriptions"]["Row"];
export type UserSubscriptionInsert =
  Database["public"]["Tables"]["user_subscriptions"]["Insert"];
export type UserSubscriptionUpdate =
  Database["public"]["Tables"]["user_subscriptions"]["Update"];

// Usage data from calculate_user_usage function
export interface SubscriptionUsage {
  secrets_count: number;
  total_recipients: number;
}

// Tier configuration interface
export interface TierConfig {
  name: string;
  id: SubscriptionTier;
  displayName: string;
  description: string;
  maxSecrets: number;
  maxRecipientsPerSecret: number;
  customIntervals: boolean;
  features: string[];
  price: {
    monthly: number;
    annual: number;
  };
  priceInCents?: {
    monthly: number;
    annual: number;
  };
  priceIds: {
    monthly: string;
    annual: string;
  };
  featured: boolean;
}

// User tier info with usage (normalized schema)
export interface UserTierInfo {
  tier: UserTier & {
    tiers: {
      id: string;
      name: SubscriptionTier;
      display_name: string;
      max_secrets: number;
      max_recipients_per_secret: number;
      custom_intervals: boolean;
      price_monthly: number | null;
      price_yearly: number | null;
      created_at: string;
      updated_at: string;
    };
  };
  subscription?: UserSubscription;
  usage: SubscriptionUsage;
  limits: {
    secrets: {
      current: number;
      max: number;
      canCreate: boolean;
    };
    recipients: {
      current: number;
      max: number;
    };
  };
}

// Custom data interface for Paddle webhooks
export interface PaddleCustomData {
  userId?: string;
  tier?: SubscriptionTier;
  [key: string]: string | number | boolean | undefined;
}

// Paddle webhook event types
export interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id: string;
    status?: string;
    customer_id?: string;
    subscription_id?: string;
    custom_data?: PaddleCustomData;
    [key: string]: string | number | boolean | object | undefined;
  };
}

// Paddle checkout options
export interface PaddleCheckoutOptions {
  items: Array<{
    priceId: string;
    quantity: number;
  }>;
  customData?: {
    userId: string;
    tier: SubscriptionTier;
  };
  customer?: {
    email?: string;
  };
  discountCode?: string;
}

// Usage tracking
export interface UsageMetrics {
  secretsCount: number;
  totalRecipients: number;
  lastCalculated: string;
}

// Tier limit enforcement
export interface TierLimits {
  maxSecrets: number;
  maxRecipientsPerSecret: number;
  customIntervals: boolean;
}

// Subscription management actions
export type SubscriptionAction =
  | "upgrade"
  | "downgrade"
  | "cancel"
  | "resume"
  | "update_payment_method";

export interface SubscriptionActionRequest {
  action: SubscriptionAction;
  newTier?: SubscriptionTier;
  effectiveDate?: string;
}
