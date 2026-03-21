/**
 * SendGrid Email Provider Adapter
 *
 * Production email delivery using SendGrid Web API (HTTP)
 * instead of SMTP to avoid connection timeout issues on
 * cloud platforms that block outbound SMTP.
 *
 * Features:
 * - Uses @sendgrid/mail HTTP API (port 443, not SMTP 587)
 * - Exponential backoff retry logic
 * - Rate limiting (429) error handling
 * - Configuration validation
 * - Error classification (retryable vs non-retryable)
 */

import sgMail from "@sendgrid/mail"
import type { EmailData, EmailProvider, EmailResult } from "./EmailProvider"
import { SENDGRID_UNSUBSCRIBE_GROUPS, type UnsubscribeGroup } from "../constants"

export interface SendGridEmailData extends EmailData {
  unsubscribeGroup?: UnsubscribeGroup
}

/**
 * SendGrid email provider implementation using HTTP API
 */
export class SendGridAdapter implements EmailProvider {
  private readonly maxRetries = 3
  private readonly baseRetryDelay = 1000 // 1 second
  private initialized = false

  private initialize(): void {
    if (this.initialized) return
    const apiKey = process.env.SENDGRID_API_KEY?.trim()
    if (apiKey) {
      sgMail.setApiKey(apiKey)
      this.initialized = true
    }
  }

  /**
   * Validate SendGrid configuration
   */
  async validateConfig(): Promise<boolean> {
    const apiKey = process.env.SENDGRID_API_KEY?.trim()
    const adminEmail = process.env.SENDGRID_ADMIN_EMAIL?.trim()

    if (!apiKey || apiKey === "") return false
    if (!adminEmail || adminEmail === "") return false

    return true
  }

  /**
   * Send email via SendGrid Web API
   */
  async sendEmail(data: SendGridEmailData): Promise<EmailResult> {
    const isValid = await this.validateConfig()
    if (!isValid) {
      return {
        success: false,
        error:
          "SendGrid configuration invalid: missing SENDGRID_API_KEY or SENDGRID_ADMIN_EMAIL",
        retryable: false,
      }
    }

    this.initialize()

    let attemptCount = 0

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      attemptCount++

      try {
        const result = await this.sendEmailAttempt(data)
        return { ...result, attempts: attemptCount }
      } catch (error) {
        const classification = this.classifyError(error as Error)

        if (!classification.retryable) {
          return {
            success: false,
            error: classification.message,
            retryable: false,
            attempts: attemptCount,
          }
        }

        if (classification.isRateLimit) {
          return {
            success: false,
            error: "Rate limit exceeded",
            retryable: true,
            retryAfter: 60,
            attempts: attemptCount,
            rateLimitInfo: {
              limit: 100,
              remaining: 0,
              resetTime: Date.now() + 60000,
            },
          }
        }

        if (attempt === this.maxRetries) {
          return {
            success: false,
            error: classification.message,
            retryable: true,
            attempts: attemptCount,
          }
        }

        const delay = this.calculateBackoffDelay(attempt)
        await this.sleep(delay)
      }
    }

    return {
      success: false,
      error: "Unknown error after retries",
      retryable: true,
      attempts: attemptCount,
    }
  }

  getProviderName(): string {
    return "sendgrid"
  }

  /**
   * Single email sending attempt via HTTP API
   */
  private async sendEmailAttempt(data: SendGridEmailData): Promise<EmailResult> {
    const senderName = process.env.SENDGRID_SENDER_NAME || "Dead Man's Switch"
    const adminEmail = process.env.SENDGRID_ADMIN_EMAIL!

    const msg: sgMail.MailDataRequired = {
      to: data.to,
      from: data.from || { email: adminEmail, name: senderName },
      subject: data.subject,
      html: data.html,
      text: data.text || undefined,
      replyTo: data.replyTo || undefined,
      headers: {
        ...data.headers,
      },
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    }

    // Add ASM unsubscribe group if specified
    if (data.unsubscribeGroup) {
      msg.asm = {
        groupId: SENDGRID_UNSUBSCRIBE_GROUPS[data.unsubscribeGroup],
        groupsToDisplay: Object.values(SENDGRID_UNSUBSCRIBE_GROUPS),
      }
    }

    const [response] = await sgMail.send(msg)

    // SendGrid returns x-message-id header
    const messageId =
      response.headers?.["x-message-id"] as string ||
      `sg-${Date.now()}-${Math.random().toString(36).substring(7)}`

    return {
      success: true,
      messageId,
      provider: "sendgrid",
      trackingEnabled: data.trackDelivery || false,
    }
  }

  /**
   * Classify error to determine if it's retryable
   */
  private classifyError(error: Error): {
    retryable: boolean
    message: string
    isRateLimit: boolean
  } {
    const errorMessage = error.message
    const statusCode = (error as { code?: number }).code

    // Non-retryable errors
    if (
      errorMessage.includes("Invalid API key") ||
      errorMessage.includes("Authentication failed") ||
      errorMessage.includes("Unauthorized") ||
      statusCode === 401 ||
      statusCode === 403
    ) {
      return { retryable: false, message: errorMessage, isRateLimit: false }
    }

    // Rate limiting
    if (
      errorMessage.includes("Rate limit") ||
      errorMessage.includes("429") ||
      statusCode === 429
    ) {
      return { retryable: true, message: "Rate limit exceeded", isRateLimit: true }
    }

    // All other errors are retryable
    return { retryable: true, message: errorMessage, isRateLimit: false }
  }

  private calculateBackoffDelay(attempt: number): number {
    return this.baseRetryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
