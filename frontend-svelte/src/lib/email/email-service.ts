/**
 * Production Email Service
 *
 * Provides production-ready email delivery using SendGrid Web API
 * with proper error handling, retry logic, and rate limiting.
 *
 * Uses the provider adapter pattern — see providers/SendGridAdapter.ts
 * for the HTTP API transport (replaces nodemailer SMTP which caused
 * connection timeouts on Railway).
 */

import { CircuitBreaker } from "$lib/circuit-breaker"
import { SITE_URL } from "$lib/env"
import { logger } from "$lib/logger"
import { SENDGRID_UNSUBSCRIBE_GROUPS, type UnsubscribeGroup } from "./constants"
import { getEmailProvider } from "./email-factory"
import type { SendGridEmailData } from "./providers/SendGridAdapter"

// Re-export for backwards compatibility
export { SENDGRID_UNSUBSCRIBE_GROUPS, type UnsubscribeGroup } from "./constants"

// Email data structure (delegates to provider's EmailData)
interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  priority?: "high" | "normal" | "low"
  headers?: Record<string, string>
  trackDelivery?: boolean
  unsubscribeGroup?: UnsubscribeGroup
}

// Email sending options
interface EmailOptions {
  maxRetries?: number
  retryDelay?: number
}

// Email sending result
export interface EmailResult {
  success: boolean
  messageId?: string
  provider?: string
  error?: string
  retryable?: boolean
  retryAfter?: number
  attempts?: number
  trackingEnabled?: boolean
  rateLimitInfo?: {
    limit: number
    remaining: number
    resetTime: number
  }
}

// Circuit breaker for email service
const emailCircuitBreaker = new CircuitBreaker("EmailService", {
  failureThreshold: 5,
  timeout: 60000, // 1 minute
  halfOpenAttempts: 3,
})

/**
 * Validate email service configuration
 */
export async function validateEmailConfig(): Promise<{
  valid: boolean
  provider: string
  missingVars: string[]
  developmentMode?: boolean
}> {
  const isDevelopment = process.env.NODE_ENV === "development"
  const provider = getEmailProvider()
  const isValid = await provider.validateConfig()

  if (!isValid && isDevelopment) {
    return { valid: true, provider: "console-dev", missingVars: [], developmentMode: true }
  }

  if (!isValid) {
    const missingVars: string[] = []
    if (!process.env.SENDGRID_API_KEY) missingVars.push("SENDGRID_API_KEY")
    if (!process.env.SENDGRID_ADMIN_EMAIL) missingVars.push("SENDGRID_ADMIN_EMAIL")
    return { valid: false, provider: provider.getProviderName(), missingVars }
  }

  return { valid: true, provider: provider.getProviderName(), missingVars: [] }
}

/**
 * Send email using configured provider (SendGrid Web API or Mock)
 *
 * Wraps the provider with circuit breaker protection and logging.
 */
export async function sendEmail(
  emailData: EmailData,
  _options: EmailOptions = {},
): Promise<EmailResult> {
  const sendStartTime = Date.now()

  try {
    const isDevelopment = process.env.NODE_ENV === "development"
    const provider = getEmailProvider()

    // Development mode with mock provider - console logging
    if (isDevelopment && provider.getProviderName() === "mock") {
      console.log(`
======== DEVELOPMENT EMAIL ========
To: ${emailData.to}
Subject: ${emailData.subject}
From: ${emailData.from || process.env.SENDGRID_ADMIN_EMAIL}
${emailData.text || "HTML content provided"}
===================================
      `)

      return {
        success: true,
        messageId: `dev-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        provider: "console-dev",
      }
    }

    logger.info("Sending email via SendGrid Web API", {
      to: emailData.to,
      subject: emailData.subject,
      priority: emailData.priority,
      circuitBreakerState: emailCircuitBreaker.getState?.() ?? "unknown",
    })

    // Circuit breaker wraps the provider call
    // The provider (SendGridAdapter) handles its own retry logic internally
    const result = await emailCircuitBreaker.execute(async () => {
      const providerData: SendGridEmailData = {
        ...emailData,
      }
      return await provider.sendEmail(providerData)
    })

    if (result.success) {
      logger.info("Email sent successfully", {
        to: emailData.to,
        messageId: result.messageId,
        provider: result.provider,
        durationMs: Date.now() - sendStartTime,
      })
    }

    return result
  } catch (error) {
    const sendDuration = Date.now() - sendStartTime
    logger.error("Error sending email", error instanceof Error ? error : undefined, {
      to: emailData.to,
      subject: emailData.subject,
      durationMs: sendDuration,
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (errorMessage.includes("Circuit breaker is OPEN")) {
      return {
        success: false,
        error: "Email service temporarily unavailable",
        retryable: true,
        retryAfter: 60,
      }
    }

    return {
      success: false,
      error: errorMessage,
      retryable: !errorMessage.includes("Invalid API key") &&
        !errorMessage.includes("Authentication failed"),
    }
  }
}

/**
 * Send OTP authentication email
 */
export async function sendOTPEmail(
  email: string,
  code: string,
  expirationMinutes: number = 10,
): Promise<EmailResult & { templateUsed?: string; emailData?: any }> {
  const { renderOTPTemplate } = await import("./templates")

  const templateData = {
    code,
    expirationMinutes,
    userName: email.split("@")[0],
    supportEmail: process.env.SENDGRID_ADMIN_EMAIL,
  }

  const template = renderOTPTemplate(templateData)

  const maxRetries = 2
  const retryDelay = 1000

  const result = await sendEmail(
    {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: "high",
      trackDelivery: true,
      unsubscribeGroup: "ACCOUNT_NOTIFICATIONS",
    },
    { maxRetries, retryDelay },
  )

  if (result.success) {
    return {
      ...result,
      templateUsed: "otp",
      emailData: {
        subject: template.subject,
        expirationMinutes,
      },
    }
  }

  return result
}

/**
 * Send verification email using template
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<EmailResult & { templateUsed?: string; emailData?: any }> {
  const { renderVerificationTemplate } = await import("./templates")

  const templateData = {
    verificationUrl: `${SITE_URL || "https://keyfate.com"}/auth/verify-email?token=${token}&email=${encodeURIComponent(
      email,
    )}`,
    expirationHours: 24,
    userName: email.split("@")[0], // Simple fallback
    supportEmail: process.env.SENDGRID_ADMIN_EMAIL,
  }

  const template = renderVerificationTemplate(templateData)

  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    trackDelivery: true,
    unsubscribeGroup: "ACCOUNT_NOTIFICATIONS",
  })

  if (result.success) {
    return {
      ...result,
      templateUsed: "verification",
      emailData: {
        subject: template.subject,
        verificationUrl: templateData.verificationUrl,
        expirationHours: templateData.expirationHours,
      },
    }
  }

  return result
}

/**
 * Send reminder email
 */
export async function sendReminderEmail(reminderData: {
  userEmail: string
  userName: string
  secretTitle: string
  daysRemaining: number
  checkInUrl: string
  urgencyLevel?: "low" | "medium" | "high" | "critical"
  reminderType?:
    | "1_hour"
    | "12_hours"
    | "24_hours"
    | "3_days"
    | "7_days"
    | "25_percent"
    | "50_percent"
}): Promise<EmailResult & { templateUsed?: string }> {
  const { renderReminderTemplate } = await import("./templates")

  const template = renderReminderTemplate(reminderData)

  const result = await sendEmail({
    to: reminderData.userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    priority:
      reminderData.urgencyLevel === "critical" ||
      reminderData.urgencyLevel === "high"
        ? "high"
        : "normal",
    trackDelivery: true,
    unsubscribeGroup: "CHECK_IN_REMINDERS",
  })

  if (result.success) {
    return {
      ...result,
      templateUsed: "reminder",
    }
  }

  return result
}

/**
 * Send secret disclosure email
 */
export async function sendSecretDisclosureEmail(disclosureData: {
  contactEmail: string
  contactName: string
  secretTitle: string
  senderName: string
  message: string
  secretContent: string
  disclosureReason?: "scheduled" | "manual"
  senderLastSeen?: Date
  secretCreatedAt?: Date
}): Promise<EmailResult & { templateUsed?: string }> {
  logger.info("Preparing disclosure email", {
    recipient: disclosureData.contactEmail,
    secretTitle: disclosureData.secretTitle,
    reason: disclosureData.disclosureReason,
    hasContent: !!disclosureData.secretContent,
    contentLength: disclosureData.secretContent?.length ?? 0,
  })

  const { renderDisclosureTemplate } = await import("./templates")

  const template = renderDisclosureTemplate(disclosureData)

  const result = await sendEmail({
    to: disclosureData.contactEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
    trackDelivery: true,
    unsubscribeGroup: "ACCOUNT_NOTIFICATIONS",
  })

  if (result.success) {
    logger.info("Disclosure email delivered", {
      recipient: disclosureData.contactEmail,
      messageId: result.messageId,
      provider: result.provider,
    })

    return {
      ...result,
      templateUsed: "disclosure",
    }
  }

  logger.warn("Disclosure email send returned failure", {
    recipient: disclosureData.contactEmail,
    error: result.error,
    retryable: result.retryable,
    provider: result.provider,
  })

  return result
}

/**
 * Get delivery status for a message
 */
export async function getDeliveryStatus(
  messageId: string,
): Promise<DeliveryStatus> {
  // Mock implementation - in production this would integrate with SendGrid Events API
  return {
    messageId,
    status: "delivered",
    deliveredAt: new Date(),
    events: [
      { type: "sent", timestamp: new Date(Date.now() - 60000) },
      { type: "delivered", timestamp: new Date() },
    ],
  }
}

/**
 * Format email template (re-exported from templates)
 */
export async function formatEmailTemplate(
  templateType: "verification" | "reminder" | "disclosure",
  data: any,
): Promise<{ subject: string; html: string; text: string }> {
  const templates = await import("./templates")

  switch (templateType) {
    case "verification":
      return templates.renderVerificationTemplate(data)
    case "reminder":
      return templates.renderReminderTemplate(data)
    case "disclosure":
      return templates.renderDisclosureTemplate(data)
    default:
      throw new Error(`Unknown template type: ${templateType}`)
  }
}

/**
 * Get email service circuit breaker status
 */
export function getEmailServiceHealth() {
  return emailCircuitBreaker.getStats()
}

/**
 * Reset email service circuit breaker
 */
export function resetEmailCircuitBreaker() {
  emailCircuitBreaker.reset()
}

// ============================================================================
// Billing & Subscription Email Service
// (Merged from $lib/services/email-service.ts)
// ============================================================================

export interface SubscriptionConfirmationData {
  provider: "stripe" | "btcpay"
  tierName: string
  amount: number
  interval: string
}

export interface PaymentFailedData {
  provider: "stripe" | "btcpay"
  subscriptionId: string
  amount: number
  attemptCount: number
  nextRetry: Date
}

export interface TrialWillEndData {
  daysRemaining: number
  trialEndDate: Date
}

export interface BitcoinPaymentData {
  invoiceId: string
  amount: number
  currency: string
  tierName: string
  confirmations: number
  transactionId?: string
}

export interface AdminAlertData {
  type: string
  severity: "low" | "medium" | "high" | "critical"
  message: string
  details: Record<string, unknown>
}

async function getUserById(userId: string) {
  try {
    const { getDatabase } = await import("$lib/db/drizzle")
    const { users } = await import("$lib/db/schema")
    const { eq } = await import("drizzle-orm")
    const db = await getDatabase()
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return user || null
  } catch (error) {
    logger.error("Failed to get user by ID", error instanceof Error ? error : undefined)
    return null
  }
}

class BillingEmailService {
  async sendSubscriptionConfirmation(
    userId: string,
    data: SubscriptionConfirmationData,
  ) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        logger.warn("User not found for subscription confirmation email", { userId })
        return
      }

      const { renderSubscriptionConfirmationTemplate } = await import(
        "./templates"
      )
      const template = renderSubscriptionConfirmationTemplate({
        userName: user.name || "User",
        tierName: data.tierName,
        provider: data.provider,
        amount: data.amount,
        interval: data.interval,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      await sendEmail(
        {
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          unsubscribeGroup: "BILLING_SUBSCRIPTION",
        },
        { maxRetries: 3, retryDelay: 1000 },
      )
    } catch (error) {
      logger.error("Failed to send subscription confirmation email", error instanceof Error ? error : undefined)
    }
  }

  async sendPaymentFailedNotification(userId: string, data: PaymentFailedData) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        logger.warn("User not found for payment failed notification", { userId })
        return
      }

      const { renderPaymentFailedTemplate } = await import("./templates")
      const template = renderPaymentFailedTemplate({
        userName: user.name || "User",
        amount: data.amount,
        provider: data.provider,
        attemptCount: data.attemptCount,
        maxAttempts: 3,
        nextRetry: data.nextRetry,
      })

      await sendEmail(
        {
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          unsubscribeGroup: "BILLING_SUBSCRIPTION",
        },
        { maxRetries: 3, retryDelay: 1000 },
      )
    } catch (error) {
      logger.error("Failed to send payment failed notification", error instanceof Error ? error : undefined)
    }
  }

  async sendSubscriptionCancelledNotification(userId: string) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        logger.warn("User not found for subscription cancelled notification", { userId })
        return
      }

      const { renderSubscriptionCancelledTemplate } = await import(
        "./templates"
      )
      const template = renderSubscriptionCancelledTemplate({
        userName: user.name || "User",
      })

      await sendEmail(
        {
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          unsubscribeGroup: "BILLING_SUBSCRIPTION",
        },
        { maxRetries: 3, retryDelay: 1000 },
      )
    } catch (error) {
      logger.error("Failed to send subscription cancelled notification", error instanceof Error ? error : undefined)
    }
  }

  async sendTrialWillEndNotification(userId: string, data: TrialWillEndData) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        logger.warn("User not found for trial will end notification", { userId })
        return
      }

      const { renderTrialWillEndTemplate } = await import("./templates")
      const template = renderTrialWillEndTemplate({
        userName: user.name || "User",
        daysRemaining: data.daysRemaining,
        trialEndDate: data.trialEndDate,
      })

      await sendEmail(
        {
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          unsubscribeGroup: "BILLING_SUBSCRIPTION",
        },
        { maxRetries: 3, retryDelay: 1000 },
      )
    } catch (error) {
      logger.error("Failed to send trial will end notification", error instanceof Error ? error : undefined)
    }
  }

  async sendBitcoinPaymentConfirmation(
    userId: string,
    data: BitcoinPaymentData,
  ) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        logger.warn("User not found for Bitcoin payment confirmation", { userId })
        return
      }

      const { renderBitcoinPaymentConfirmationTemplate } = await import(
        "./templates"
      )
      const template = renderBitcoinPaymentConfirmationTemplate({
        userName: user.name || "User",
        amount: data.amount,
        currency: data.currency,
        tierName: data.tierName,
        confirmations: data.confirmations,
        transactionId: data.transactionId,
      })

      await sendEmail(
        {
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          unsubscribeGroup: "BILLING_SUBSCRIPTION",
        },
        { maxRetries: 3, retryDelay: 1000 },
      )
    } catch (error) {
      logger.error("Failed to send Bitcoin payment confirmation", error instanceof Error ? error : undefined)
    }
  }

  async sendAdminAlert(data: AdminAlertData) {
    try {
      const adminEmail = process.env.SENDGRID_ADMIN_EMAIL || "support@aviat.io"

      const { renderAdminAlertTemplate } = await import("./templates")
      const template = renderAdminAlertTemplate({
        type: data.type,
        severity: data.severity,
        message: data.message,
        details: data.details,
        timestamp: new Date(),
      })

      await sendEmail(
        {
          to: adminEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
        },
        { maxRetries: 3, retryDelay: 1000 },
      )
    } catch (error) {
      logger.error("Failed to send admin alert", error instanceof Error ? error : undefined)
    }
  }
}

export const emailService = new BillingEmailService()
