import { secrets, users, accounts, sessions, verificationTokens, subscriptionTiers, userSubscriptions } from "@/lib/db/schema";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Drizzle-based type exports
export type Secret = InferSelectModel<typeof secrets>;
export type SecretInsert = InferInsertModel<typeof secrets>;
export type SecretUpdate = Partial<SecretInsert>;

export type User = InferSelectModel<typeof users>;
export type UserInsert = InferInsertModel<typeof users>;
export type UserUpdate = Partial<UserInsert>;

export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type VerificationToken = InferSelectModel<typeof verificationTokens>;

export type SubscriptionTier = InferSelectModel<typeof subscriptionTiers>;
export type UserSubscription = InferSelectModel<typeof userSubscriptions>;
export type UserSubscriptionInsert = InferInsertModel<typeof userSubscriptions>;
export type UserSubscriptionUpdate = Partial<UserSubscriptionInsert>;

// Legacy compatibility types (deprecated - use Drizzle types above)
export type Database = {
  public: {
    Tables: {
      secrets: { Row: Secret; Insert: SecretInsert; Update: SecretUpdate };
      users: { Row: User; Insert: UserInsert; Update: UserUpdate };
      user_tiers: { Row: SubscriptionTier; Insert: InferInsertModel<typeof subscriptionTiers>; Update: Partial<InferInsertModel<typeof subscriptionTiers>> };
      user_subscriptions: { Row: UserSubscription; Insert: UserSubscriptionInsert; Update: UserSubscriptionUpdate };
    };
    Enums: {
      contact_method: "email" | "phone" | "both";
      secret_status: "active" | "paused" | "triggered";
      subscription_tier: "free" | "basic" | "pro" | "premium" | "enterprise";
      subscription_status: "active" | "inactive" | "cancelled" | "trial" | "past_due";
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

// Reminder types (if needed, implement reminders table in schema.ts)
export type Reminder = {
  id: string;
  secret_id: string;
  type: string;
  scheduled_for: Date;
  status: string;
};
export type ReminderInsert = Omit<Reminder, "id">;
export type ReminderUpdate = Partial<ReminderInsert>;
