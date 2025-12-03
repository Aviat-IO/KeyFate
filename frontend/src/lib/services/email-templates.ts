import { getTierConfig } from "../../constants/tiers"

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

interface SubscriptionConfirmationParams {
  userName: string
  tierName: string
  provider: "stripe" | "btcpay"
  amount: number
  interval: string
  nextBillingDate: Date
}

interface PaymentFailedParams {
  userName: string
  amount: number
  provider: "stripe" | "btcpay"
  attemptCount: number
  maxAttempts: number
  nextRetry: Date
}

interface SubscriptionCancelledParams {
  userName: string
}

interface TrialWillEndParams {
  userName: string
  daysRemaining: number
  trialEndDate: Date
}

interface BitcoinPaymentConfirmationParams {
  userName: string
  amount: number
  currency: string
  tierName: string
  confirmations: number
  transactionId?: string
}

interface AdminAlertParams {
  type: string
  severity: "low" | "medium" | "high" | "critical"
  message: string
  details: Record<string, unknown>
  timestamp: Date
}

/**
 * Shared base styles for consistent email theming
 * Designed to be spam-filter friendly with clean, professional styling
 */
const BASE_STYLES = `
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
    line-height: 1.6; 
    color: #374151; 
    margin: 0;
    padding: 0;
    background-color: #f3f4f6;
  }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .email-wrapper { background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
  .content { padding: 24px; }
  .footer { padding: 16px 24px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
  .button {
    display: inline-block;
    background: #2563eb;
    color: white !important;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    margin: 16px 0;
  }
  .info-box { 
    background: #f0f9ff; 
    border-left: 4px solid #3b82f6; 
    padding: 12px 16px; 
    border-radius: 4px; 
    margin: 16px 0; 
  }
  .notice-box { 
    background: #fefce8; 
    border-left: 4px solid #eab308; 
    padding: 12px 16px; 
    border-radius: 4px; 
    margin: 16px 0; 
  }
  .details { background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0; }
`

class EmailTemplates {
  private renderWrapper(title: string, content: string): string {
    const companyName = this.getCompanyName()
    const supportEmail = this.getSupportEmail()
    const currentYear = new Date().getFullYear()

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>${BASE_STYLES}</style>
        </head>
        <body>
          <div class="container">
            <div class="email-wrapper">
              <div class="header">
                <h1>${title}</h1>
              </div>
              <div class="content">
                ${content}
              </div>
              <div class="footer">
                <p>Questions? Contact us at <a href="mailto:${supportEmail}" style="color: #2563eb;">${supportEmail}</a></p>
                <p style="color: #9ca3af;">&copy; ${currentYear} ${companyName}. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  }

  subscriptionConfirmation(
    params: SubscriptionConfirmationParams,
  ): EmailTemplate {
    const formattedAmount = this.formatCurrency(params.amount)
    const formattedDate = params.nextBillingDate.toLocaleDateString()
    const providerName =
      params.provider === "stripe" ? "Credit Card" : "Bitcoin"
    const companyName = this.getCompanyName()

    const subject = `${companyName}: Your subscription is confirmed`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>Thank you for subscribing to <strong>${companyName} ${this.capitalizeFirst(params.tierName)}</strong>. Your subscription is now active.</p>

      <div class="details">
        <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${this.capitalizeFirst(params.tierName)}</p>
        <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${formattedAmount}/${params.interval}</p>
        <p style="margin: 0 0 8px 0;"><strong>Payment Method:</strong> ${providerName}</p>
        <p style="margin: 0;"><strong>Next Billing:</strong> ${formattedDate}</p>
      </div>

      <p>Your ${this.capitalizeFirst(params.tierName)} features include:</p>
      <ul style="color: #374151;">
        ${this.getTierFeaturesFromConfig(params.tierName)}
      </ul>

      <p style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="button">
          Go to Dashboard
        </a>
      </p>
    `

    const text = `
${companyName}: Your subscription is confirmed

Hi ${params.userName},

Thank you for subscribing to ${companyName} ${this.capitalizeFirst(params.tierName)}. Your subscription is now active.

Plan: ${this.capitalizeFirst(params.tierName)}
Amount: ${formattedAmount}/${params.interval}
Payment Method: ${providerName}
Next Billing: ${formattedDate}

Dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/dashboard

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Subscription Confirmed", content), text }
  }

  paymentFailed(params: PaymentFailedParams): EmailTemplate {
    const formattedAmount = this.formatCurrency(params.amount)
    const formattedRetry = params.nextRetry.toLocaleString()
    const providerName =
      params.provider === "stripe" ? "Credit Card" : "Bitcoin"
    const companyName = this.getCompanyName()

    const subject = `${companyName}: Payment update needed`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>We were unable to process your payment of <strong>${formattedAmount}</strong> using your ${providerName}.</p>

      <div class="notice-box">
        <p style="margin: 0 0 8px 0; color: #92400e;"><strong>Attempt ${params.attemptCount} of ${params.maxAttempts}</strong></p>
        <p style="margin: 0; color: #92400e;">We'll retry automatically on ${formattedRetry}.</p>
        ${
          params.attemptCount >= params.maxAttempts
            ? '<p style="margin: 8px 0 0 0; color: #92400e;"><strong>Note:</strong> This was our final automatic attempt.</p>'
            : ""
        }
      </div>

      <p>To resolve this:</p>
      <ul style="color: #374151;">
        <li>Ensure your payment method has sufficient funds</li>
        <li>Verify your payment details are current</li>
        <li>Update your payment method if needed</li>
      </ul>

      <p style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/settings/subscription" class="button">
          Update Payment Method
        </a>
      </p>
    `

    const text = `
${companyName}: Payment update needed

Hi ${params.userName},

We were unable to process your payment of ${formattedAmount} using your ${providerName}.

Attempt ${params.attemptCount} of ${params.maxAttempts}
We'll retry automatically on ${formattedRetry}.

${params.attemptCount >= params.maxAttempts ? "Note: This was our final automatic attempt." : ""}

To resolve this:
- Ensure your payment method has sufficient funds
- Verify your payment details are current
- Update your payment method if needed

Update payment: ${process.env.NEXT_PUBLIC_SITE_URL}/settings/subscription

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Payment Update Needed", content), text }
  }

  subscriptionCancelled(params: SubscriptionCancelledParams): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Your subscription has been cancelled`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>Your subscription has been cancelled. We're sorry to see you go.</p>

      <div class="info-box">
        <p style="margin: 0; color: #1e40af;">Your account will remain active until the end of your current billing period, then revert to the free plan.</p>
      </div>

      <p>What happens next:</p>
      <ul style="color: #374151;">
        <li>Continue using premium features until your billing period ends</li>
        <li>Your secrets remain secure and accessible</li>
        <li>You can resubscribe at any time</li>
      </ul>

      <p style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing" class="button">
          View Plans
        </a>
      </p>

      <p style="font-size: 13px; color: #6b7280;">
        We'd appreciate any feedback on how we can improve. Just reply to this email.
      </p>
    `

    const text = `
${companyName}: Your subscription has been cancelled

Hi ${params.userName},

Your subscription has been cancelled. We're sorry to see you go.

Your account will remain active until the end of your current billing period, then revert to the free plan.

What happens next:
- Continue using premium features until your billing period ends
- Your secrets remain secure and accessible
- You can resubscribe at any time

View plans: ${process.env.NEXT_PUBLIC_SITE_URL}/pricing

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Subscription Cancelled", content), text }
  }

  trialWillEnd(params: TrialWillEndParams): EmailTemplate {
    const formattedDate = params.trialEndDate.toLocaleDateString()
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Your trial ends in ${params.daysRemaining} days`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>Your free trial ends in <strong>${params.daysRemaining} days</strong> (${formattedDate}).</p>

      <div class="info-box">
        <p style="margin: 0; color: #1e40af;">Subscribe now to keep access to all your premium features.</p>
      </div>

      <p>Premium benefits include:</p>
      <ul style="color: #374151;">
        <li>Unlimited secrets storage</li>
        <li>Advanced encryption options</li>
        <li>Priority support</li>
        <li>Custom check-in intervals</li>
      </ul>

      <p style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing" class="button">
          Choose Your Plan
        </a>
      </p>
    `

    const text = `
${companyName}: Your trial ends in ${params.daysRemaining} days

Hi ${params.userName},

Your free trial ends in ${params.daysRemaining} days (${formattedDate}).

Subscribe now to keep access to all your premium features.

Premium benefits include:
- Unlimited secrets storage
- Advanced encryption options
- Priority support
- Custom check-in intervals

Choose your plan: ${process.env.NEXT_PUBLIC_SITE_URL}/pricing

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Trial Ending Soon", content), text }
  }

  bitcoinPaymentConfirmation(
    params: BitcoinPaymentConfirmationParams,
  ): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Bitcoin payment confirmed`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>Your Bitcoin payment has been confirmed and your <strong>${this.capitalizeFirst(params.tierName)}</strong> subscription is now active.</p>

      <div class="details">
        <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${params.amount} ${params.currency}</p>
        <p style="margin: 0 0 8px 0;"><strong>Confirmations:</strong> ${params.confirmations}/6</p>
        <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${this.capitalizeFirst(params.tierName)}</p>
        ${params.transactionId ? `<p style="margin: 0; font-size: 12px; color: #6b7280;"><strong>TX:</strong> ${params.transactionId}</p>` : ""}
      </div>

      <p style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="button">
          Go to Dashboard
        </a>
      </p>
    `

    const text = `
${companyName}: Bitcoin payment confirmed

Hi ${params.userName},

Your Bitcoin payment has been confirmed and your ${this.capitalizeFirst(params.tierName)} subscription is now active.

Amount: ${params.amount} ${params.currency}
Confirmations: ${params.confirmations}/6
Plan: ${this.capitalizeFirst(params.tierName)}
${params.transactionId ? `TX: ${params.transactionId}` : ""}

Dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/dashboard

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Bitcoin Payment Confirmed", content), text }
  }

  adminAlert(params: AdminAlertParams): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName} Admin: ${params.type} [${params.severity}]`

    const content = `
      <p><strong>Type:</strong> ${params.type}</p>
      <p><strong>Severity:</strong> ${params.severity}</p>
      <p><strong>Time:</strong> ${params.timestamp.toISOString()}</p>
      
      <div class="info-box">
        <p style="margin: 0; color: #1e40af;">${params.message}</p>
      </div>

      <div class="details">
        <p style="margin: 0 0 8px 0; font-weight: 600;">Details</p>
        <pre style="margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${JSON.stringify(params.details, null, 2)}</pre>
      </div>
    `

    const text = `
${companyName} Admin: ${params.type} [${params.severity}]

Type: ${params.type}
Severity: ${params.severity}
Time: ${params.timestamp.toISOString()}

Message: ${params.message}

Details:
${JSON.stringify(params.details, null, 2)}
    `.trim()

    return { subject, html: this.renderWrapper(`Admin Alert: ${params.type}`, content), text }
  }

  private formatCurrency(cents: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private getTierFeaturesFromConfig(tierName: string): string {
    const tierConfig = getTierConfig(tierName as "free" | "pro")
    if (!tierConfig || !tierConfig.features) {
      return "<li>All features included</li>"
    }

    // Replace support email in features with current env var value
    const supportEmail = this.getSupportEmail()
    return tierConfig.features
      .map((feature: string) => {
        // Replace any support@keyfate.com references with current support email
        return feature.replace(/support@keyfate\.com/g, supportEmail)
      })
      .map((feature: string) => `<li>${feature}</li>`)
      .join("")
  }

  private getTierFeatures(tierName: string): string {
    // Deprecated: Use getTierFeaturesFromConfig instead
    // Keeping for backwards compatibility with other email templates
    const features = {
      free: [
        "<li>Up to 3 secrets</li>",
        "<li>Basic encryption</li>",
        "<li>Email notifications</li>",
      ],
      basic: [
        "<li>Up to 10 secrets</li>",
        "<li>Advanced encryption</li>",
        "<li>Email and SMS notifications</li>",
        "<li>Custom check-in intervals</li>",
      ],
      premium: [
        "<li>Unlimited secrets</li>",
        "<li>Military-grade encryption</li>",
        "<li>Multi-channel notifications</li>",
        "<li>Custom check-in intervals</li>",
        "<li>Priority support</li>",
        "<li>Advanced sharing options</li>",
      ],
      enterprise: [
        "<li>Unlimited secrets</li>",
        "<li>Military-grade encryption</li>",
        "<li>Multi-channel notifications</li>",
        "<li>Custom check-in intervals</li>",
        "<li>24/7 support</li>",
        "<li>Advanced sharing options</li>",
        "<li>Team management</li>",
        "<li>Audit logs</li>",
      ],
    }

    return (features[tierName as keyof typeof features] || features.free).join(
      "",
    )
  }

  // GDPR Email Templates
  dataExportReady(params: {
    userName: string
    downloadUrl: string
    expiresAt: Date
  }): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Your data export is ready`
    const hoursRemaining = Math.floor(
      (params.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60),
    )

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>Your personal data export is ready to download.</p>

      <div class="notice-box">
        <p style="margin: 0; color: #92400e;">
          This link expires in <strong>${hoursRemaining} hours</strong> and can be downloaded up to 3 times.
        </p>
      </div>

      <p style="text-align: center;">
        <a href="${params.downloadUrl}" class="button">Download My Data</a>
      </p>

      <p><strong>What's included:</strong></p>
      <ul style="color: #374151;">
        <li>Your profile information</li>
        <li>All secrets and their metadata</li>
        <li>Check-in history</li>
        <li>Audit logs</li>
        <li>Subscription and payment history</li>
      </ul>

      <p style="font-size: 13px; color: #6b7280;">
        If you didn't request this export, please contact us at ${this.getSupportEmail()}
      </p>
    `

    const text = `
${companyName}: Your data export is ready

Hi ${params.userName},

Your personal data export is ready to download.

Download: ${params.downloadUrl}

Note: This link expires in ${hoursRemaining} hours and can be downloaded up to 3 times.

What's included:
- Your profile information
- All secrets and their metadata
- Check-in history
- Audit logs
- Subscription and payment history

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Your Data Export is Ready", content), text }
  }

  accountDeletionConfirmation(params: {
    userName: string
    confirmationUrl: string
    scheduledDate: Date
  }): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Confirm your account deletion request`
    const daysUntilDeletion = Math.floor(
      (params.scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>We received a request to delete your account and all associated data.</p>

      <div class="notice-box">
        <p style="margin: 0 0 12px 0; color: #92400e; font-weight: 600;">This action is permanent</p>
        <p style="margin: 0 0 8px 0; color: #92400e;">Once confirmed, your account will be deleted in <strong>${daysUntilDeletion} days</strong>.</p>
        <p style="margin: 0; color: #92400e; font-size: 13px;">
          <strong>Will be deleted:</strong> All secrets, recipients, check-in history, audit logs, and account settings.<br>
          <strong>Will be retained:</strong> Payment records (required for compliance).
        </p>
      </div>

      <p>To proceed with deletion:</p>

      <p style="text-align: center;">
        <a href="${params.confirmationUrl}" class="button">Confirm Account Deletion</a>
      </p>

      <p style="font-size: 13px; color: #6b7280;">
        <strong>Changed your mind?</strong> Simply ignore this email. Your account will remain active.<br>
        <strong>Didn't request this?</strong> Contact us at ${this.getSupportEmail()}
      </p>
    `

    const text = `
${companyName}: Confirm your account deletion request

Hi ${params.userName},

We received a request to delete your account and all associated data.

This action is permanent. Once confirmed, your account will be deleted in ${daysUntilDeletion} days.

Will be deleted: All secrets, recipients, check-in history, audit logs, and account settings.
Will be retained: Payment records (required for compliance).

To confirm: ${params.confirmationUrl}

Changed your mind? Simply ignore this email.
Didn't request this? Contact us at ${this.getSupportEmail()}

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Account Deletion Request", content), text }
  }

  accountDeletionGracePeriod(params: {
    userName: string
    daysRemaining: number
    cancelUrl: string
  }): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Account deletion in ${params.daysRemaining} days`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>This is a reminder that your account is scheduled for deletion in <strong>${params.daysRemaining} days</strong>.</p>

      <div class="notice-box">
        <p style="margin: 0; color: #92400e;">
          Your account and all data will be permanently deleted unless you cancel.
        </p>
      </div>

      <p>Changed your mind?</p>

      <p style="text-align: center;">
        <a href="${params.cancelUrl}" class="button">Cancel Deletion</a>
      </p>

      <p style="font-size: 13px; color: #6b7280;">
        If you take no action, deletion will proceed automatically on the scheduled date.
      </p>
    `

    const text = `
${companyName}: Account deletion in ${params.daysRemaining} days

Hi ${params.userName},

This is a reminder that your account is scheduled for deletion in ${params.daysRemaining} days.

Your account and all data will be permanently deleted unless you cancel.

To cancel: ${params.cancelUrl}

If you take no action, deletion will proceed automatically.

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Account Deletion Reminder", content), text }
  }

  accountDeletionComplete(params: { userName: string }): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Your account has been deleted`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>Your account has been permanently deleted as requested.</p>

      <div class="info-box">
        <p style="margin: 0; color: #1e40af;">
          All your data has been removed from our systems in accordance with GDPR regulations.
        </p>
      </div>

      <p>Thank you for using ${companyName}. If you ever need our services again, you're welcome to create a new account.</p>
    `

    const text = `
${companyName}: Your account has been deleted

Hi ${params.userName},

Your account has been permanently deleted as requested.

All your data has been removed from our systems in accordance with GDPR regulations.

Thank you for using ${companyName}. If you ever need our services again, you're welcome to create a new account.

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Account Deleted", content), text }
  }

  accountDeletionCancelled(params: { userName: string }): EmailTemplate {
    const companyName = this.getCompanyName()
    const subject = `${companyName}: Account deletion cancelled`

    const content = `
      <p>Hi ${params.userName},</p>
      
      <p>Your account deletion request has been cancelled.</p>

      <div class="info-box">
        <p style="margin: 0; color: #1e40af;">
          Your account and all your data remain active and secure.
        </p>
      </div>

      <p style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL || "https://keyfate.com"}/dashboard" class="button">Go to Dashboard</a>
      </p>

      <p style="font-size: 13px; color: #6b7280;">
        If you didn't cancel this request, please contact us at ${this.getSupportEmail()}
      </p>
    `

    const text = `
${companyName}: Account deletion cancelled

Hi ${params.userName},

Your account deletion request has been cancelled.

Your account and all your data remain active and secure.

Dashboard: ${process.env.NEXTAUTH_URL || "https://keyfate.com"}/dashboard

If you didn't cancel this request, please contact us at ${this.getSupportEmail()}

${companyName}
    `.trim()

    return { subject, html: this.renderWrapper("Account Deletion Cancelled", content), text }
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      low: "#10b981", // green
      medium: "#f59e0b", // yellow
      high: "#f97316", // orange
      critical: "#dc2626", // red
    }

    return colors[severity as keyof typeof colors] || colors.medium
  }

  private getCompanyName(): string {
    return process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  }

  private getSupportEmail(): string {
    return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@keyfate.com"
  }
}

export const emailTemplates = new EmailTemplates()
