/**
 * Production Email Service
 *
 * Provides production-ready email delivery using SendGrid/Resend
 * with proper error handling, retry logic, and rate limiting.
 */

import nodemailer from "nodemailer"
import { CircuitBreaker } from "$lib/circuit-breaker"
import { SITE_URL } from "$lib/env"
import { logger } from "$lib/logger"
import { SENDGRID_UNSUBSCRIBE_GROUPS, type UnsubscribeGroup } from "./constants"

// Re-export for backwards compatibility
export { SENDGRID_UNSUBSCRIBE_GROUPS, type UnsubscribeGroup } from "./constants"

// Email service configuration
interface EmailConfig {
  provider: "sendgrid" | "console-dev" | "resend"
  apiKey?: string
  adminEmail?: string
  senderName?: string
  developmentMode?: boolean
}

// Email data structure
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

// Email configuration validation result
interface ConfigValidationResult {
  valid: boolean
  provider: string
  missingVars: string[]
  config?: EmailConfig
  developmentMode?: boolean
}

// Delivery status tracking
interface DeliveryStatus {
  messageId: string
  status: "sent" | "delivered" | "failed" | "bounced" | "spam"
  deliveredAt?: Date
  events: Array<{
    type: string
    timestamp: Date
    details?: string
  }>
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
export async function validateEmailConfig(): Promise<ConfigValidationResult> {
  const missingVars: string[] = []
  const isDevelopment = process.env.NODE_ENV === "development"

  // Check for SendGrid configuration
  if (!process.env.SENDGRID_API_KEY) {
    missingVars.push("SENDGRID_API_KEY")
  }
  if (!process.env.SENDGRID_ADMIN_EMAIL) {
    missingVars.push("SENDGRID_ADMIN_EMAIL")
  }

  // In development, allow fallback to console logging
  if (isDevelopment && missingVars.length > 0) {
    return {
      valid: true,
      provider: "console-dev",
      missingVars: [],
      developmentMode: true,
    }
  }

  if (missingVars.length > 0) {
    return {
      valid: false,
      provider: "sendgrid",
      missingVars,
    }
  }

  return {
    valid: true,
    provider: "sendgrid",
    missingVars: [],
    config: {
      provider: "sendgrid",
      apiKey: process.env.SENDGRID_API_KEY,
      adminEmail: process.env.SENDGRID_ADMIN_EMAIL,
      senderName: process.env.SENDGRID_SENDER_NAME || "Dead Man's Switch",
    },
  }
}

/**
 * Cached email transporter singleton
 */
let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null
let cachedTransporterApiKey: string | undefined

/**
 * Get or create email transporter (lazy singleton, recreated if API key changes)
 */
async function getTransporter() {
  const config = await validateEmailConfig()

  if (!config.valid) {
    throw new Error(
      `Email configuration invalid: ${config.missingVars.join(", ")}`,
    )
  }

  if (config.developmentMode) {
    // Development mode - log to console
    return null
  }

  const currentApiKey = process.env.SENDGRID_API_KEY
  if (cachedTransporter && cachedTransporterApiKey === currentApiKey) {
    return cachedTransporter
  }

  // Production SendGrid configuration
  cachedTransporter = nodemailer.createTransport({
    service: "SendGrid",
    auth: {
      user: "apikey",
      pass: currentApiKey,
    },
  })
  cachedTransporterApiKey = currentApiKey

  return cachedTransporter
}

/**
 * Implement exponential backoff retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Don't retry on non-retryable errors
      if (error instanceof Error && error.message.includes("Invalid API key")) {
        throw error
      }

      if (attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Send email using configured provider
 */
export async function sendEmail(
  emailData: EmailData,
  options: EmailOptions = {},
): Promise<EmailResult> {
  const { maxRetries = 3, retryDelay = 1000 } = options

  try {
    const config = await validateEmailConfig()

    if (!config.valid && !config.developmentMode) {
      return {
        success: false,
        error: `Email service not configured: ${config.missingVars.join(", ")}`,
        retryable: false,
      }
    }

    // Development mode - console logging
    if (config.developmentMode) {
      console.log(`
======== DEVELOPMENT EMAIL ========
To: ${emailData.to}
Subject: ${emailData.subject}
From: ${emailData.from || config.config?.adminEmail}
${emailData.text || "HTML content provided"}
===================================
      `)

      return {
        success: true,
        messageId: `dev-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`,
        provider: "console-dev",
      }
    }

    // Production email sending with circuit breaker and retry logic
    let attempts = 0

    const result = await emailCircuitBreaker.execute(async () => {
      return await withRetry(
        async () => {
          attempts++
          const transporter = await getTransporter()

          if (!transporter) {
            throw new Error("Failed to create email transporter")
          }

          const siteUrl = SITE_URL || "https://keyfate.com"
          const unsubscribeUrl = `${siteUrl}/settings/notifications`

          const mailOptions = {
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            from:
              emailData.from ||
              `${config.config?.senderName} <${config.config?.adminEmail}>`,
            replyTo: emailData.replyTo,
            headers: {
              ...emailData.headers,
              // List-Unsubscribe helps deliverability with Gmail/Outlook
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              "X-SMTPAPI": JSON.stringify({
                // SendGrid ASM (Advanced Suppression Manager) for unsubscribe groups
                ...(emailData.unsubscribeGroup && {
                  asm: {
                    group_id: SENDGRID_UNSUBSCRIBE_GROUPS[emailData.unsubscribeGroup],
                    groups_to_display: Object.values(SENDGRID_UNSUBSCRIBE_GROUPS),
                  },
                }),
                tracking_settings: {
                  click_tracking: {
                    enable: false,
                  },
                },
              }),
            },
            priority: emailData.priority || "normal",
          }

          const info = await transporter.sendMail(mailOptions)

          return {
            success: true,
            messageId: info.messageId,
            provider: "sendgrid",
            attempts,
            trackingEnabled: emailData.trackDelivery || false,
          }
        },
        maxRetries,
        retryDelay,
      )
    })

    return result
  } catch (error) {
    logger.error("Error sending email", error instanceof Error ? error : undefined)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    const isRetryable =
      !errorMessage.includes("Invalid API key") &&
      !errorMessage.includes("Authentication failed") &&
      !errorMessage.includes("Circuit breaker is OPEN")

    // Check for circuit breaker open
    if (errorMessage.includes("Circuit breaker is OPEN")) {
      return {
        success: false,
        error: "Email service temporarily unavailable",
        retryable: true,
        retryAfter: 60,
      }
    }

    // Check for rate limiting
    if (errorMessage.includes("Rate limit") || errorMessage.includes("429")) {
      return {
        success: false,
        error: "Rate limit exceeded",
        retryable: true,
        retryAfter: 60,
        rateLimitInfo: {
          limit: 100,
          remaining: 0,
          resetTime: Date.now() + 60000,
        },
      }
    }

    return {
      success: false,
      error: errorMessage,
      retryable: isRetryable,
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
    return {
      ...result,
      templateUsed: "disclosure",
    }
  }

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
