/**
 * SendGrid Unsubscribe Group IDs
 * 
 * These groups allow users to manage their email preferences.
 * Created in SendGrid dashboard under Marketing > Unsubscribe Groups.
 */
export const SENDGRID_UNSUBSCRIBE_GROUPS = {
  /** Check-in reminder emails */
  CHECK_IN_REMINDERS: 341804,
  /** Account notifications (OTP, verification, disclosure, GDPR) */
  ACCOUNT_NOTIFICATIONS: 341805,
  /** Billing and subscription emails */
  BILLING_SUBSCRIPTION: 341806,
} as const

export type UnsubscribeGroup = keyof typeof SENDGRID_UNSUBSCRIBE_GROUPS
