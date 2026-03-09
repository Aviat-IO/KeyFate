/**
 * SendGrid Email Provider Adapter
 *
 * Production email delivery using SendGrid with retry logic,
 * rate limiting, and comprehensive error handling.
 *
 * Features:
 * - Exponential backoff retry logic
 * - Rate limiting (429) error handling
 * - Configuration validation
 * - Error classification (retryable vs non-retryable)
 */

import nodemailer from "nodemailer"
import type { EmailData, EmailProvider, EmailResult } from "./EmailProvider"

/**
 * SendGrid email provider implementation
 *
 * Wraps existing SendGrid logic from email-service.ts
 * with the EmailProvider interface for consistent usage.
 */
export class SendGridAdapter implements EmailProvider {
  private readonly maxRetries = 3
  private readonly baseRetryDelay = 1000 // 1 second

  /**
   * Validate SendGrid configuration
   *
   * Checks for required environment variables:
   * - SENDGRID_API_KEY
   * - SENDGRID_ADMIN_EMAIL
   * - SENDGRID_SENDER_NAME (optional, defaults to "Dead Man's Switch")
   */
  async validateConfig(): Promise<boolean> {
    const apiKey = process.env.SENDGRID_API_KEY?.trim()
    const adminEmail = process.env.SENDGRID_ADMIN_EMAIL?.trim()

    // Check for missing or empty values
    if (!apiKey || apiKey === "") {
      return false
    }

    if (!adminEmail || adminEmail === "") {
      return false
    }

    return true
  }

  /**
   * Send email via SendGrid
   *
   * Implements retry logic with exponential backoff.
   * Handles rate limiting and error classification.
   */
  async sendEmail(data: EmailData): Promise<EmailResult> {
    // Validate configuration before attempting to send
    const isValid = await this.validateConfig()
    if (!isValid) {
      return {
        success: false,
        error:
          "SendGrid configuration invalid: missing SENDGRID_API_KEY or SENDGRID_ADMIN_EMAIL",
        retryable: false,
      }
    }

    // Execute with retry logic
    let attemptCount = 0
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      attemptCount++

      try {
        const result = await this.sendEmailAttempt(data)
        return {
          ...result,
          attempts: attemptCount,
        }
      } catch (error) {
        lastError = error as Error

        // Check if error is retryable
        const errorClassification = this.classifyError(error as Error)

        // Don't retry on non-retryable errors
        if (!errorClassification.retryable) {
          return {
            success: false,
            error: errorClassification.message,
            retryable: false,
            attempts: attemptCount,
          }
        }

        // Check for rate limiting
        if (errorClassification.isRateLimit) {
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

        // If this was the last attempt, return error
        if (attempt === this.maxRetries) {
          return {
            success: false,
            error: errorClassification.message,
            retryable: true,
            attempts: attemptCount,
          }
        }

        // Exponential backoff with jitter before next retry
        const delay = this.calculateBackoffDelay(attempt)
        await this.sleep(delay)
      }
    }

    // Should never reach here, but TypeScript requires it
    return {
      success: false,
      error: lastError?.message || "Unknown error",
      retryable: true,
      attempts: attemptCount,
    }
  }

  /**
   * Get provider name for logging and debugging
   */
  getProviderName(): string {
    return "sendgrid"
  }

  /**
   * Single email sending attempt without retry logic
   */
  private async sendEmailAttempt(data: EmailData): Promise<EmailResult> {
    const transporter = this.createTransporter()

    const senderName = process.env.SENDGRID_SENDER_NAME || "Dead Man's Switch"
    const adminEmail = process.env.SENDGRID_ADMIN_EMAIL!

    const mailOptions = {
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
      from: data.from || `${senderName} <${adminEmail}>`,
      replyTo: data.replyTo,
      headers: {
        ...data.headers,
        "X-SMTPAPI": JSON.stringify({
          tracking_settings: {
            click_tracking: {
              enable: false,
            },
          },
        }),
      },
      priority: data.priority || "normal",
    }

    const info = await transporter.sendMail(mailOptions)

    return {
      success: true,
      messageId: info.messageId,
      provider: "sendgrid",
      trackingEnabled: data.trackDelivery || false,
    }
  }

  /**
   * Create SendGrid transporter using nodemailer
   */
  private createTransporter() {
    return nodemailer.createTransport({
      service: "SendGrid",
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    })
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

    // Non-retryable errors
    if (
      errorMessage.includes("Invalid API key") ||
      errorMessage.includes("Authentication failed")
    ) {
      return {
        retryable: false,
        message: errorMessage,
        isRateLimit: false,
      }
    }

    // Rate limiting errors
    if (
      errorMessage.includes("Rate limit") ||
      errorMessage.includes("429") ||
      (error as { statusCode?: number }).statusCode === 429
    ) {
      return {
        retryable: true,
        message: "Rate limit exceeded",
        isRateLimit: true,
      }
    }

    // All other errors are retryable (network issues, temporary failures, etc.)
    return {
      retryable: true,
      message: errorMessage,
      isRateLimit: false,
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 1000
    return exponentialDelay + jitter
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
