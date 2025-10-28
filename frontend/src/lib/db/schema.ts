import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
  boolean,
  jsonb,
  numeric,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/pg-core"

// Enums
export const contactMethodEnum = pgEnum("contact_method", [
  "email",
  "phone",
  "both",
])
export const secretStatusEnum = pgEnum("secret_status", [
  "active",
  "paused",
  "triggered",
  "failed",
])
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "basic",
  "pro",
  "premium",
  "enterprise",
])
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "inactive",
  "cancelled",
  "trial",
  "past_due",
])
export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
])
export const reminderTypeEnum = pgEnum("reminder_type", [
  "25_percent",
  "50_percent",
  "7_days",
  "3_days",
  "24_hours",
  "12_hours",
  "1_hour",
])
export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processing",
  "processed",
  "failed",
  "retrying",
])
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
])
export const emailFailureTypeEnum = pgEnum("email_failure_type", [
  "reminder",
  "disclosure",
  "admin_notification",
  "verification",
])
export const emailFailureProviderEnum = pgEnum("email_failure_provider", [
  "sendgrid",
  "console-dev",
  "resend",
])
export const tokenPurposeEnum = pgEnum("token_purpose", [
  "email_verification",
  "authentication",
])
export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "secret_created",
  "secret_edited",
  "secret_deleted",
  "check_in",
  "secret_triggered",
  "recipient_added",
  "recipient_removed",
  "settings_changed",
  "login",
  "subscription_changed",
])
export const auditEventCategoryEnum = pgEnum("audit_event_category", [
  "secrets",
  "authentication",
  "subscriptions",
  "settings",
  "recipients",
])
export const disclosureStatusEnum = pgEnum("disclosure_status", [
  "pending",
  "sent",
  "failed",
])

// NextAuth.js Tables
export const users = pgTable("users", {
  id: text("id").notNull().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  name: text("name"),
  image: text("image"),
  password: text("password"), // Optional field for credential-based authentication
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
})

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
)

export const sessions = pgTable("sessions", {
  id: text("id").notNull().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
    purpose: tokenPurposeEnum("purpose").default("email_verification"),
    attemptCount: integer("attempt_count").default(0),
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token),
  }),
)

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
})

export const otpRateLimits = pgTable(
  "otp_rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    requestCount: integer("request_count").notNull().default(1),
    windowStart: timestamp("window_start", { mode: "date" }).notNull(),
    windowEnd: timestamp("window_end", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    emailWindowIdx: index("idx_otp_rate_limits_email_window").on(
      table.email,
      table.windowEnd,
    ),
  }),
)

export const privacyPolicyAcceptance = pgTable("privacy_policy_acceptance", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  policyVersion: text("policy_version").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
})

// Application Tables
export const secrets = pgTable(
  "secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    checkInDays: integer("check_in_days").notNull().default(30),
    status: secretStatusEnum("status").notNull().default("active"),
    serverShare: text("server_share"),
    iv: text("iv"),
    authTag: text("auth_tag"),
    sssSharesTotal: integer("sss_shares_total").notNull().default(3),
    sssThreshold: integer("sss_threshold").notNull().default(2),
    lastCheckIn: timestamp("last_check_in"),
    nextCheckIn: timestamp("next_check_in"),
    triggeredAt: timestamp("triggered_at"),
    processingStartedAt: timestamp("processing_started_at"),
    lastError: text("last_error"),
    retryCount: integer("retry_count").notNull().default(0),
    lastRetryAt: timestamp("last_retry_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userStatusIdx: index("secrets_user_status_idx").on(
      table.userId,
      table.status,
    ),
  }),
)

export const secretRecipients = pgTable("secret_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  secretId: uuid("secret_id")
    .notNull()
    .references(() => secrets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const adminNotifications = pgTable("admin_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  metadata: jsonb("metadata"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const checkInTokens = pgTable(
  "check_in_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    secretId: uuid("secret_id")
      .notNull()
      .references(() => secrets.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    secretValidTokenIdx: index("check_in_tokens_secret_valid_idx").on(
      table.secretId,
      table.usedAt,
      table.expiresAt,
    ),
  }),
)

export const checkinHistory = pgTable("checkin_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  secretId: uuid("secret_id")
    .notNull()
    .references(() => secrets.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  checkedInAt: timestamp("checked_in_at").notNull(),
  nextCheckIn: timestamp("next_check_in").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const cronConfig = pgTable("cron_config", {
  id: integer("id").primaryKey(),
  projectUrl: text("project_url").notNull().default(""),
  serviceRoleKey: text("service_role_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const emailNotifications = pgTable("email_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientEmail: text("recipient_email").notNull(),
  secretId: uuid("secret_id")
    .notNull()
    .references(() => secrets.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const reminderJobs = pgTable(
  "reminder_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    secretId: uuid("secret_id")
      .notNull()
      .references(() => secrets.id, { onDelete: "cascade" }),
    reminderType: reminderTypeEnum("reminder_type").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    status: reminderStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at"),
    failedAt: timestamp("failed_at"),
    error: text("error"),
    retryCount: integer("retry_count").default(0),
    nextRetryAt: timestamp("next_retry_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    secretReminderStatusIdx: index(
      "reminder_jobs_secret_reminder_status_idx",
    ).on(table.secretId, table.reminderType, table.status, table.sentAt),
    statusRetryIdx: index("reminder_jobs_status_retry_idx").on(
      table.status,
      table.retryCount,
      table.nextRetryAt,
    ),
    uniqueSecretReminder: unique("unique_secret_reminder_scheduled").on(
      table.secretId,
      table.reminderType,
      table.scheduledFor,
    ),
  }),
)

export const disclosureLog = pgTable(
  "disclosure_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    secretId: uuid("secret_id")
      .notNull()
      .references(() => secrets.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    status: disclosureStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at"),
    error: text("error"),
    retryCount: integer("retry_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    batchFetchIdx: index("disclosure_log_batch_fetch_idx").on(
      table.secretId,
      table.recipientEmail,
      table.status,
      table.createdAt,
    ),
  }),
)

export const subscriptionTiers = pgTable("subscription_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: subscriptionTierEnum("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  maxSecrets: integer("max_secrets").notNull(),
  maxRecipientsPerSecret: integer("max_recipients_per_secret").notNull(),
  customIntervals: boolean("custom_intervals").default(false),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }),
  priceYearly: numeric("price_yearly", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userContactMethods = pgTable("user_contact_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email"),
  phone: text("phone"),
  preferredMethod: contactMethodEnum("preferred_method").default("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id")
    .notNull()
    .references(() => subscriptionTiers.id),
  provider: text("provider"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  status: subscriptionStatusEnum("status").notNull().default("inactive"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  scheduledDowngradeAt: timestamp("scheduled_downgrade_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(), // "stripe" or "btcpay"
  eventType: text("event_type").notNull(),
  eventId: text("event_id").notNull().unique(),
  payload: jsonb("payload").notNull(),
  status: webhookStatusEnum("status").notNull().default("received"),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const paymentHistory = pgTable("payment_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(
    () => userSubscriptions.id,
  ),
  provider: text("provider").notNull(),
  providerPaymentId: text("provider_payment_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: paymentStatusEnum("status").notNull(),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const emailFailures = pgTable(
  "email_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailType: emailFailureTypeEnum("email_type").notNull(),
    provider: emailFailureProviderEnum("provider").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    errorMessage: text("error_message").notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    recipientTypeIdx: index("email_failures_recipient_type_idx").on(
      table.recipient,
      table.emailType,
      table.createdAt,
    ),
  }),
)

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: auditEventTypeEnum("event_type").notNull(),
    eventCategory: auditEventCategoryEnum("event_category").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
    eventTypeIdx: index("audit_logs_event_type_idx").on(table.eventType),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
)

// Export types for use in application
export type Secret = typeof secrets.$inferSelect
export type SecretInsert = typeof secrets.$inferInsert
export type SecretUpdate = Partial<Omit<Secret, "id" | "createdAt">>

export type AdminNotification = typeof adminNotifications.$inferSelect
export type CheckInToken = typeof checkInTokens.$inferSelect
export type CheckInTokenInsert = typeof checkInTokens.$inferInsert
export type CheckinHistory = typeof checkinHistory.$inferSelect
export type ReminderJob = typeof reminderJobs.$inferSelect
export type ReminderJobInsert = typeof reminderJobs.$inferInsert
export type UserContactMethod = typeof userContactMethods.$inferSelect
export type UserSubscription = typeof userSubscriptions.$inferSelect
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect
export type WebhookEvent = typeof webhookEvents.$inferSelect
export type PaymentHistory = typeof paymentHistory.$inferSelect
export type EmailFailure = typeof emailFailures.$inferSelect
export type EmailFailureInsert = typeof emailFailures.$inferInsert
export type EmailFailureUpdate = Partial<Omit<EmailFailure, "id" | "createdAt">>

export type AuditLog = typeof auditLogs.$inferSelect
export type AuditLogInsert = typeof auditLogs.$inferInsert

// NextAuth.js types
export type User = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert
export type Account = typeof accounts.$inferSelect
export type Session = typeof sessions.$inferSelect
export type VerificationToken = typeof verificationTokens.$inferSelect
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type PasswordResetTokenInsert = typeof passwordResetTokens.$inferInsert
export type OTPRateLimit = typeof otpRateLimits.$inferSelect
export type OTPRateLimitInsert = typeof otpRateLimits.$inferInsert
