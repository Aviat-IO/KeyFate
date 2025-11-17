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

class EmailTemplates {
  subscriptionConfirmation(
    params: SubscriptionConfirmationParams,
  ): EmailTemplate {
    const formattedAmount = this.formatCurrency(params.amount)
    const formattedDate = params.nextBillingDate.toLocaleDateString()
    const providerName =
      params.provider === "stripe" ? "Credit Card" : "Bitcoin"
    const companyName = this.getCompanyName()
    const supportEmail =
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@keyfate.com"

    const subject = `Subscription Confirmed - ${companyName}`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: hsl(13.2143 73.0435% 54.9020%); color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .button {
              display: inline-block;
              background: hsl(13.2143 73.0435% 54.9020%);
              color: white !important;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Subscription Confirmed</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName}!</h2>
              <p>Thank you for subscribing to <strong>${companyName} ${this.capitalizeFirst(params.tierName)}</strong>. Your subscription has been successfully activated.</p>

              <div class="details">
                <h3>Subscription Details</h3>
                <ul>
                  <li><strong>Plan:</strong> ${this.capitalizeFirst(params.tierName)}</li>
                  <li><strong>Amount:</strong> ${formattedAmount}/${params.interval}</li>
                  <li><strong>Payment Method:</strong> ${providerName}</li>
                  <li><strong>Next Billing Date:</strong> ${formattedDate}</li>
                </ul>
              </div>

              <p>You now have access to all ${this.capitalizeFirst(params.tierName)} features, including:</p>
              <ul>
                ${this.getTierFeaturesFromConfig(params.tierName)}
              </ul>

               <p style="text-align: center;">
                 <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="button" style="color: white !important;">
                   Access Your Dashboard
                 </a>
               </p>

               <p>If you have any questions, please contact our <a href="mailto:${supportEmail}">support team</a>.</p>
            </div>
            <div class="footer">
              <p>${companyName} - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Subscription Confirmed - ${companyName}

Hello ${params.userName}!

Thank you for subscribing to ${companyName} ${this.capitalizeFirst(params.tierName)}. Your subscription has been successfully activated.

Subscription Details:
- Plan: ${this.capitalizeFirst(params.tierName)}
- Amount: ${formattedAmount}/${params.interval}
- Payment Method: ${providerName}
- Next Billing Date: ${formattedDate}

You now have access to all ${this.capitalizeFirst(params.tierName)} features.

Access your dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/dashboard

If you have any questions, please contact our support team at ${supportEmail}.

${companyName} - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  paymentFailed(params: PaymentFailedParams): EmailTemplate {
    const formattedAmount = this.formatCurrency(params.amount)
    const formattedRetry = params.nextRetry.toLocaleString()
    const providerName =
      params.provider === "stripe" ? "Credit Card" : "Bitcoin"

    const subject = "Payment Failed - Action Required"

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .button {
              display: inline-block;
              background: #dc2626;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .warning { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #f59e0b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Failed</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>We were unable to process your payment of <strong>${formattedAmount}</strong> using your ${providerName}.</p>

              <div class="warning">
                <h3>Payment Attempt ${params.attemptCount} of ${params.maxAttempts}</h3>
                <p>We will automatically retry your payment on <strong>${formattedRetry}</strong>.</p>
                ${
                  params.attemptCount >= params.maxAttempts
                    ? "<p><strong>This was our final attempt. Your subscription will be cancelled if payment is not resolved.</strong></p>"
                    : ""
                }
              </div>

              <p>To resolve this issue:</p>
              <ul>
                <li>Check that your payment method has sufficient funds</li>
                <li>Verify your payment information is up to date</li>
                <li>Update your payment method in your account settings</li>
              </ul>

              <p>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/account/billing" class="button">
                  Update Payment Method
                </a>
              </p>

              <p>If you continue to experience issues, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>KeyFate - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Payment Failed - Action Required

Hello ${params.userName},

We were unable to process your payment of ${formattedAmount} using your ${providerName}.

Payment Attempt ${params.attemptCount} of ${params.maxAttempts}
We will automatically retry your payment on ${formattedRetry}.

${
  params.attemptCount >= params.maxAttempts
    ? "This was our final attempt. Your subscription will be cancelled if payment is not resolved."
    : ""
}

To resolve this issue:
- Check that your payment method has sufficient funds
- Verify your payment information is up to date
- Update your payment method in your account settings

Update your payment method: ${process.env.NEXT_PUBLIC_SITE_URL}/account/billing

If you continue to experience issues, please contact our support team.

KeyFate - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  subscriptionCancelled(params: SubscriptionCancelledParams): EmailTemplate {
    const subject = "Subscription Cancelled"

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6b7280; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .button {
              display: inline-block;
              background: #2563eb;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Subscription Cancelled</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>Your subscription has been successfully cancelled. We're sorry to see you go!</p>

              <p>Your account will remain active until the end of your current billing period. After that, you'll be moved to our free plan.</p>

              <p>What happens next:</p>
              <ul>
                <li>You'll continue to have access to premium features until your billing period ends</li>
                <li>Your secrets will remain secure and accessible</li>
                <li>You can reactivate your subscription at any time</li>
              </ul>

              <p>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing" class="button">
                  Reactivate Subscription
                </a>
              </p>

              <p>We'd love to hear your feedback about how we can improve our service.</p>
            </div>
            <div class="footer">
              <p>KeyFate - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Subscription Cancelled

Hello ${params.userName},

Your subscription has been successfully cancelled. We're sorry to see you go!

Your account will remain active until the end of your current billing period. After that, you'll be moved to our free plan.

What happens next:
- You'll continue to have access to premium features until your billing period ends
- Your secrets will remain secure and accessible
- You can reactivate your subscription at any time

Reactivate your subscription: ${process.env.NEXT_PUBLIC_SITE_URL}/pricing

We'd love to hear your feedback about how we can improve our service.

KeyFate - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  trialWillEnd(params: TrialWillEndParams): EmailTemplate {
    const formattedDate = params.trialEndDate.toLocaleDateString()
    const subject = `Trial Ending in ${params.daysRemaining} Days`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .button {
              display: inline-block;
              background: #2563eb;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .highlight { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Trial Ending Soon</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>Your free trial is ending in <strong>${params.daysRemaining} days</strong> on ${formattedDate}.</p>

              <div class="highlight">
                <h3>Don't lose access to your premium features!</h3>
                <p>Subscribe now to continue enjoying all the benefits of our premium service.</p>
              </div>

              <p>With a premium subscription, you get:</p>
              <ul>
                <li>Unlimited secrets storage</li>
                <li>Advanced encryption options</li>
                <li>Priority support</li>
                <li>Custom check-in intervals</li>
              </ul>

              <p>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing" class="button">
                  Choose Your Plan
                </a>
              </p>

              <p>Questions? Our support team is here to help!</p>
            </div>
            <div class="footer">
              <p>KeyFate - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Trial Ending Soon

Hello ${params.userName},

Your free trial is ending in ${params.daysRemaining} days on ${formattedDate}.

Don't lose access to your premium features! Subscribe now to continue enjoying all the benefits of our premium service.

With a premium subscription, you get:
- Unlimited secrets storage
- Advanced encryption options
- Priority support
- Custom check-in intervals

Choose your plan: ${process.env.NEXT_PUBLIC_SITE_URL}/pricing

Questions? Our support team is here to help!

KeyFate - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  bitcoinPaymentConfirmation(
    params: BitcoinPaymentConfirmationParams,
  ): EmailTemplate {
    const subject = "Bitcoin Payment Confirmed"

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f97316; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .bitcoin { background: #fff7ed; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #f97316; }
            .button {
              display: inline-block;
              background: #2563eb;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Bitcoin Payment Confirmed</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>Your Bitcoin payment has been confirmed and your <strong>${this.capitalizeFirst(params.tierName)}</strong> subscription is now active!</p>

              <div class="bitcoin">
                <h3>Payment Details</h3>
                <ul>
                  <li><strong>Amount:</strong> ${params.amount} ${params.currency}</li>
                  <li><strong>Confirmations:</strong> ${params.confirmations}/6</li>
                  <li><strong>Plan:</strong> ${this.capitalizeFirst(params.tierName)}</li>
                  ${params.transactionId ? `<li><strong>Transaction ID:</strong> ${params.transactionId}</li>` : ""}
                </ul>
              </div>

              <p>Thank you for choosing Bitcoin! Your payment is secure and your subscription is fully activated.</p>

              <p>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="button">
                  Access Your Dashboard
                </a>
              </p>

              <p>If you have any questions about your Bitcoin payment or subscription, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>KeyFate - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Bitcoin Payment Confirmed

Hello ${params.userName},

Your Bitcoin payment has been confirmed and your ${this.capitalizeFirst(params.tierName)} subscription is now active!

Payment Details:
- Amount: ${params.amount} ${params.currency}
- Confirmations: ${params.confirmations}/6
- Plan: ${this.capitalizeFirst(params.tierName)}
${params.transactionId ? `- Transaction ID: ${params.transactionId}` : ""}

Thank you for choosing Bitcoin! Your payment is secure and your subscription is fully activated.

Access your dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/dashboard

If you have any questions about your Bitcoin payment or subscription, please contact our support team.

KeyFate - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  adminAlert(params: AdminAlertParams): EmailTemplate {
    const subject = `Admin Alert: ${params.type} (${params.severity.toUpperCase()})`
    const severityColor = this.getSeverityColor(params.severity)

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${severityColor}; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Admin Alert</h1>
              <p>Severity: ${params.severity.toUpperCase()}</p>
            </div>
            <div class="content">
              <h2>${params.type}</h2>
              <p><strong>Message:</strong> ${params.message}</p>
              <p><strong>Timestamp:</strong> ${params.timestamp.toISOString()}</p>

              <div class="details">
                <h3>Details</h3>
                <pre>${JSON.stringify(params.details, null, 2)}</pre>
              </div>

              <p>Please investigate this alert and take appropriate action.</p>
            </div>
            <div class="footer">
              <p>KeyFate - Admin Alerts</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Admin Alert: ${params.type} (${params.severity.toUpperCase()})

Message: ${params.message}
Timestamp: ${params.timestamp.toISOString()}
Severity: ${params.severity.toUpperCase()}

Details:
${JSON.stringify(params.details, null, 2)}

Please investigate this alert and take appropriate action.

KeyFate - Admin Alerts
    `

    return { subject, html, text }
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
    const subject = "Your Data Export is Ready"
    const hoursRemaining = Math.floor(
      (params.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60),
    )

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .warning { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .button {
              display: inline-block;
              background: #2563eb;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Your Data Export is Ready</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>Your personal data export has been generated and is ready to download.</p>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This download link will expire in <strong>${hoursRemaining} hours</strong>.
                You can download the file up to 3 times before it expires.
              </div>

              <a href="${params.downloadUrl}" class="button">Download My Data</a>

              <h3>What's Included</h3>
              <ul>
                <li>Your profile information</li>
                <li>All secrets and their metadata</li>
                <li>Check-in history</li>
                <li>Audit logs</li>
                <li>Subscription and payment history</li>
              </ul>

              <p><small>If you didn't request this export, please contact us immediately at ${this.getSupportEmail()}</small></p>
            </div>
            <div class="footer">
              <p>${this.getCompanyName()} - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Your Data Export is Ready

Hello ${params.userName},

Your personal data export has been generated and is ready to download.

Download Link: ${params.downloadUrl}

IMPORTANT: This link expires in ${hoursRemaining} hours and can be downloaded up to 3 times.

What's Included:
- Your profile information
- All secrets and their metadata
- Check-in history
- Audit logs
- Subscription and payment history

If you didn't request this export, please contact us immediately at ${this.getSupportEmail()}

${this.getCompanyName()} - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  accountDeletionConfirmation(params: {
    userName: string
    confirmationUrl: string
    scheduledDate: Date
  }): EmailTemplate {
    const subject = "Confirm Your Account Deletion Request"
    const daysUntilDeletion = Math.floor(
      (params.scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .warning { background: #fee2e2; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #dc2626; }
            .button {
              display: inline-block;
              background: #dc2626;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Account Deletion Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>We received a request to delete your account and all associated data.</p>
              
              <div class="warning">
                <h3>🛑 This Action is Permanent</h3>
                <p>Once confirmed, your account will be scheduled for deletion in <strong>${daysUntilDeletion} days</strong>.</p>
                <p><strong>What will be deleted:</strong></p>
                <ul>
                  <li>All your secrets and their encrypted content</li>
                  <li>All recipients and sharing configurations</li>
                  <li>Check-in history and audit logs</li>
                  <li>Your profile and account settings</li>
                </ul>
                <p><strong>What will be retained (anonymized):</strong></p>
                <ul>
                  <li>Payment records (required for legal/financial compliance)</li>
                </ul>
              </div>

              <p>If you're sure you want to proceed, click the button below to confirm:</p>

              <a href="${params.confirmationUrl}" class="button">Confirm Account Deletion</a>

              <p><strong>Changed your mind?</strong> Simply ignore this email or contact support to cancel the deletion.</p>

              <p><small>If you didn't request this deletion, please contact us immediately at ${this.getSupportEmail()}</small></p>
            </div>
            <div class="footer">
              <p>${this.getCompanyName()} - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Account Deletion Request

Hello ${params.userName},

We received a request to delete your account and all associated data.

⚠️  THIS ACTION IS PERMANENT

Once confirmed, your account will be scheduled for deletion in ${daysUntilDeletion} days.

What will be deleted:
- All your secrets and their encrypted content
- All recipients and sharing configurations
- Check-in history and audit logs
- Your profile and account settings

What will be retained (anonymized):
- Payment records (required for legal/financial compliance)

To confirm the deletion, visit:
${params.confirmationUrl}

Changed your mind? Simply ignore this email or contact support to cancel the deletion.

If you didn't request this deletion, please contact us immediately at ${this.getSupportEmail()}

${this.getCompanyName()} - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  accountDeletionGracePeriod(params: {
    userName: string
    daysRemaining: number
    cancelUrl: string
  }): EmailTemplate {
    const subject = `Account Deletion in ${params.daysRemaining} Days`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .warning { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #f59e0b; }
            .button {
              display: inline-block;
              background: #2563eb;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Account Deletion Reminder</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>This is a reminder that your account is scheduled for deletion in <strong>${params.daysRemaining} days</strong>.</p>
              
              <div class="warning">
                <p>Your account and all associated data will be permanently deleted unless you cancel this request.</p>
              </div>

              <p>If you've changed your mind, you can cancel the deletion:</p>

              <a href="${params.cancelUrl}" class="button">Cancel Deletion</a>

              <p>If you take no action, your account will be automatically deleted on the scheduled date.</p>
            </div>
            <div class="footer">
              <p>${this.getCompanyName()} - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Account Deletion Reminder

Hello ${params.userName},

This is a reminder that your account is scheduled for deletion in ${params.daysRemaining} days.

Your account and all associated data will be permanently deleted unless you cancel this request.

To cancel the deletion, visit:
${params.cancelUrl}

If you take no action, your account will be automatically deleted on the scheduled date.

${this.getCompanyName()} - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  accountDeletionComplete(params: { userName: string }): EmailTemplate {
    const subject = "Your Account Has Been Deleted"

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6b7280; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Deleted</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>Your account has been permanently deleted as requested.</p>
              <p>All your data has been removed from our systems in accordance with GDPR regulations.</p>
              <p>Thank you for using ${this.getCompanyName()}. If you ever need our services again, you're welcome to create a new account.</p>
              <p>If you have any questions, please contact us at ${this.getSupportEmail()}</p>
            </div>
            <div class="footer">
              <p>${this.getCompanyName()} - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Account Deleted

Hello ${params.userName},

Your account has been permanently deleted as requested.

All your data has been removed from our systems in accordance with GDPR regulations.

Thank you for using ${this.getCompanyName()}. If you ever need our services again, you're welcome to create a new account.

If you have any questions, please contact us at ${this.getSupportEmail()}

${this.getCompanyName()} - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
  }

  accountDeletionCancelled(params: { userName: string }): EmailTemplate {
    const subject = "Account Deletion Cancelled"

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .button {
              display: inline-block;
              background: #2563eb;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Account Deletion Cancelled</h1>
            </div>
            <div class="content">
              <h2>Hello ${params.userName},</h2>
              <p>Your ${this.getCompanyName()} account deletion request has been cancelled.</p>
              <p>Your account and all your data remain active and secure.</p>
              <p>If you did not cancel this request, please contact support immediately at ${this.getSupportEmail()}</p>
              <a href="${process.env.NEXTAUTH_URL || "https://keyfate.com"}/dashboard" class="button">Go to Dashboard</a>
            </div>
            <div class="footer">
              <p>${this.getCompanyName()} - Secure Secret Management</p>
              <p>© ${new Date().getFullYear()} All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
Account Deletion Cancelled

Hello ${params.userName},

Your ${this.getCompanyName()} account deletion request has been cancelled.

Your account and all your data remain active and secure.

If you did not cancel this request, please contact support immediately at ${this.getSupportEmail()}

Dashboard: ${process.env.NEXTAUTH_URL || "https://keyfate.com"}/dashboard

${this.getCompanyName()} - Secure Secret Management
© ${new Date().getFullYear()} All rights reserved.
    `

    return { subject, html, text }
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
