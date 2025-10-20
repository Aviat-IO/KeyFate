import { getDatabase } from "@/lib/db/drizzle"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { emailTemplates } from "./email-templates"
import { smtpService } from "./smtp-service"

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

class EmailService {
  private maxRetries = 3
  private retryDelay = 1000 // 1 second

  async sendSubscriptionConfirmation(
    userId: string,
    data: SubscriptionConfirmationData,
  ) {
    try {
      const user = await this.getUserById(userId)
      if (!user) {
        console.warn(
          `User ${userId} not found for subscription confirmation email`,
        )
        return
      }

      const template = emailTemplates.subscriptionConfirmation({
        userName: user.name || "User",
        tierName: data.tierName,
        provider: data.provider,
        amount: data.amount,
        interval: data.interval,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      })

      await this.sendEmailWithRetry(user.email, template)
    } catch (error) {
      console.error("Failed to send subscription confirmation email:", error)
      await this.logEmailFailure(userId, "subscription_confirmation", error)
    }
  }

  async sendPaymentFailedNotification(userId: string, data: PaymentFailedData) {
    try {
      const user = await this.getUserById(userId)
      if (!user) {
        console.warn(`User ${userId} not found for payment failed notification`)
        return
      }

      const template = emailTemplates.paymentFailed({
        userName: user.name || "User",
        amount: data.amount,
        provider: data.provider,
        attemptCount: data.attemptCount,
        maxAttempts: 3,
        nextRetry: data.nextRetry,
      })

      await this.sendEmailWithRetry(user.email, template)
    } catch (error) {
      console.error("Failed to send payment failed notification:", error)
      await this.logEmailFailure(userId, "payment_failed", error)
    }
  }

  async sendSubscriptionCancelledNotification(userId: string) {
    try {
      const user = await this.getUserById(userId)
      if (!user) {
        console.warn(
          `User ${userId} not found for subscription cancelled notification`,
        )
        return
      }

      const template = emailTemplates.subscriptionCancelled({
        userName: user.name || "User",
      })

      await this.sendEmailWithRetry(user.email, template)
    } catch (error) {
      console.error(
        "Failed to send subscription cancelled notification:",
        error,
      )
      await this.logEmailFailure(userId, "subscription_cancelled", error)
    }
  }

  async sendTrialWillEndNotification(userId: string, data: TrialWillEndData) {
    try {
      const user = await this.getUserById(userId)
      if (!user) {
        console.warn(`User ${userId} not found for trial will end notification`)
        return
      }

      const template = emailTemplates.trialWillEnd({
        userName: user.name || "User",
        daysRemaining: data.daysRemaining,
        trialEndDate: data.trialEndDate,
      })

      await this.sendEmailWithRetry(user.email, template)
    } catch (error) {
      console.error("Failed to send trial will end notification:", error)
      await this.logEmailFailure(userId, "trial_will_end", error)
    }
  }

  async sendBitcoinPaymentConfirmation(
    userId: string,
    data: BitcoinPaymentData,
  ) {
    try {
      const user = await this.getUserById(userId)
      if (!user) {
        console.warn(
          `User ${userId} not found for Bitcoin payment confirmation`,
        )
        return
      }

      const template = emailTemplates.bitcoinPaymentConfirmation({
        userName: user.name || "User",
        amount: data.amount,
        currency: data.currency,
        tierName: data.tierName,
        confirmations: data.confirmations,
        transactionId: data.transactionId,
      })

      await this.sendEmailWithRetry(user.email, template)
    } catch (error) {
      console.error("Failed to send Bitcoin payment confirmation:", error)
      await this.logEmailFailure(userId, "bitcoin_payment_confirmation", error)
    }
  }

  async sendAdminAlert(data: AdminAlertData) {
    try {
      const adminEmail = process.env.SENDGRID_ADMIN_EMAIL || "support@aviat.io"

      const template = emailTemplates.adminAlert({
        type: data.type,
        severity: data.severity,
        message: data.message,
        details: data.details,
        timestamp: new Date(),
      })

      await this.sendEmailWithRetry(adminEmail, template)
    } catch (error) {
      console.error("Failed to send admin alert:", error)
      // Don't log admin alert failures to avoid infinite loops
    }
  }

  private async sendEmailWithRetry(
    to: string,
    template: { subject: string; html: string; text: string },
  ) {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await smtpService.sendEmail({
          to,
          subject: template.subject,
          html: template.html,
          text: template.text,
        })

        if (result.success) {
          await this.logEmailSuccess(to, template.subject)
          return
        } else {
          throw new Error(result.error || "Unknown SMTP error")
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.maxRetries) {
          // Wait before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * attempt),
          )
        }
      }
    }

    // All retries failed
    throw lastError
  }

  private async getUserById(userId: string) {
    try {
      const db = await getDatabase()
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      return user || null
    } catch (error) {
      console.error("Failed to get user by ID:", error)
      return null
    }
  }

  private async logEmailSuccess(recipientEmail: string, subject: string) {
    try {
      // Skip logging for system emails (admin alerts, etc.) since they don't have a secretId
      // TODO: Make secretId nullable in schema or create separate system_email_logs table
      console.log(`Email sent successfully to ${recipientEmail}: ${subject}`)
    } catch (error) {
      console.error("Failed to log email success:", error)
    }
  }

  private async logEmailFailure(userId: string, emailType: string, error: any) {
    try {
      // Skip logging for system emails since they don't have a secretId
      // TODO: Make secretId nullable in schema or create separate system_email_logs table
      console.error(
        `Failed to send ${emailType} email to user ${userId}:`,
        error.message,
      )
    } catch (logError) {
      console.error("Failed to log email failure:", logError)
    }
  }
}

export const emailService = new EmailService()
