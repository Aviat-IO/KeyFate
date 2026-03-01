/**
 * Email Templates
 *
 * Professional email templates for verification, reminders, and secret disclosure
 * with consistent branding and responsive design.
 */

import { formatTimeRemaining } from "$lib/time-utils"
import { getTierConfig } from "$lib/constants/tiers"

/**
 * Get support email from environment variable with fallback
 * Centralized to ensure consistency across all email templates
 */
function getSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@keyfate.com"
}

// Template data interfaces
interface VerificationTemplateData {
  verificationUrl: string
  expirationHours: number
  userName?: string
  supportEmail?: string
}

interface ReminderTemplateData {
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
}

interface DisclosureTemplateData {
  contactName: string
  secretTitle: string
  senderName: string
  message: string
  secretContent: string
  disclosureReason?: "scheduled" | "manual"
  senderLastSeen?: Date
  secretCreatedAt?: Date
}

interface PasswordResetTemplateData {
  resetUrl: string
  userName?: string
  supportEmail?: string
}

interface OTPTemplateData {
  code: string
  expirationMinutes: number
  userName?: string
  supportEmail?: string
}

interface BaseTemplateData {
  title: string
  content: string
  footerText?: string
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Base email template with consistent branding
 * Uses table-based layout for maximum email client compatibility
 * Designed to avoid spam filters with clean, professional styling
 */
export function renderBaseTemplate(data: BaseTemplateData): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const currentYear = new Date().getFullYear()
  const supportEmail = getSupportEmail()

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 15px 0;
    }
    .info-box {
      background-color: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      border-radius: 4px;
      margin: 15px 0;
    }
    .notice-box {
      background-color: #fefce8;
      border-left: 4px solid #eab308;
      padding: 15px;
      border-radius: 4px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <!-- cspell:disable-next-line - cellspacing is valid HTML email attribute -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 20px;">
        <!-- cspell:disable-next-line - cellspacing is valid HTML email attribute -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding: 24px 24px 16px 24px; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 20px; font-weight: 600; color: #2563eb; margin-bottom: 8px;">${companyName}</div>
              <h1 style="margin: 0; font-size: 22px; color: #111827; font-weight: 600;">${data.title}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 24px;">
              ${data.content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; font-size: 12px; color: #6b7280; padding: 16px 24px 24px 24px; border-top: 1px solid #e5e7eb;">
              ${data.footerText || ""}
              <p style="margin: 8px 0;">Questions? Contact us at <a href="mailto:${supportEmail}" style="color: #2563eb;">${supportEmail}</a></p>
              <p style="margin: 8px 0; color: #9ca3af;">&copy; ${currentYear} ${companyName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `
${data.title}

${data.content
  .replace(/<[^>]*>/g, "")
  .replace(/\s+/g, " ")
  .trim()}

${data.footerText || ""}

Questions? Contact us at ${supportEmail}
© ${currentYear} ${companyName}. All rights reserved.
  `.trim()

  return {
    subject: data.title,
    html,
    text,
  }
}

/**
 * Email verification template
 */
export function renderVerificationTemplate(
  data: VerificationTemplateData,
): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const userName = data.userName || "there"

  const content = `
    <p>Hi ${userName},</p>
    
    <p>Thanks for signing up for ${companyName}. Please verify your email address to complete your account setup.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.verificationUrl}" class="button" style="color: #ffffff; text-decoration: none;">Verify Email Address</a>
    </div>

    <div class="info-box">
      <p style="margin: 0; color: #1e40af;"><strong>Note:</strong> This link expires in ${data.expirationHours} hours.</p>
    </div>

    <p style="font-size: 13px; color: #6b7280;">
      Or copy this link: <a href="${data.verificationUrl}" style="color: #2563eb; word-break: break-all;">${data.verificationUrl}</a>
    </p>

    <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
      If you didn't create an account with ${companyName}, you can safely ignore this email.
    </p>
  `

  const baseTemplate = renderBaseTemplate({
    title: "Verify Your Email",
    content,
  })

  return {
    subject: `${companyName}: Please verify your email address`,
    html: baseTemplate.html,
    text: baseTemplate.text,
  }
}

/**
 * Reminder email template with urgency levels
 */
export function renderReminderTemplate(
  data: ReminderTemplateData,
): EmailTemplate {
  // Use softer, less spam-triggering labels and colors
  const urgencyConfig = {
    low: { bgColor: "#f0f9ff", textColor: "#1e40af", borderColor: "#3b82f6", label: "Reminder" },
    medium: { bgColor: "#f0f9ff", textColor: "#1e40af", borderColor: "#3b82f6", label: "Reminder" },
    high: { bgColor: "#fef3c7", textColor: "#92400e", borderColor: "#f59e0b", label: "Action needed" },
    critical: { bgColor: "#fef2f2", textColor: "#991b1b", borderColor: "#ef4444", label: "Action needed" },
  }

  const urgency = urgencyConfig[data.urgencyLevel || "medium"]
  const timeText = formatTimeRemaining(data.daysRemaining)

  // Avoid spam trigger words in subject line
  const subject = `KeyFate: Check-in for "${data.secretTitle}" - ${timeText} remaining`

  const content = `
    <p>Hi ${data.userName},</p>

    <p>This is a scheduled reminder for your KeyFate secret.</p>

    <div style="background: ${urgency.bgColor}; border-left: 4px solid ${urgency.borderColor}; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: ${urgency.textColor}; font-weight: 600;">
        ${urgency.label}: Check-in required
      </p>
      <p style="margin: 0; color: ${urgency.textColor};">
        Your secret "${data.secretTitle}" requires a check-in within <strong>${timeText}</strong>.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.checkInUrl}" class="button" style="color: #ffffff;">Check In Now</a>
    </div>

    <p style="color: #666; font-size: 14px;">
      If you don't check in before the deadline, your secret will be shared with your designated contacts as configured.
    </p>

    <p style="font-size: 13px; color: #888;">Direct link: <a href="${data.checkInUrl}" style="color: #2563eb;">${data.checkInUrl}</a></p>
  `

  const baseTemplate = renderBaseTemplate({
    title: "Check-in Reminder",
    content,
  })

  return {
    subject,
    html: baseTemplate.html,
    text: baseTemplate.text,
  }
}

/**
 * Secret disclosure email template
 * Sends the server's secret share to the recipient when triggered
 */
export function renderDisclosureTemplate(
  data: DisclosureTemplateData,
): EmailTemplate {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://keyfate.com"
  const decryptUrl = `${siteUrl}/decrypt`
  const lastSeenText = data.senderLastSeen
    ? data.senderLastSeen.toLocaleDateString()
    : "recently"

  const reasonText =
    data.disclosureReason === "manual"
      ? `${data.senderName} has chosen to share this information with you.`
      : `${data.senderName} has not checked in as scheduled (last activity: ${lastSeenText}).`

  const subject = `KeyFate: Message from ${data.senderName} - ${data.secretTitle}`

  const content = `
    <p>Dear ${data.contactName},</p>

    <p>${data.senderName} has entrusted you with confidential information through KeyFate, a secure information sharing platform.</p>

    <div class="info-box">
      <p style="margin: 0; color: #1e40af;">${reasonText}</p>
    </div>

    <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${data.secretTitle}</p>
      <p style="margin: 0;"><strong>From:</strong> ${data.senderName}</p>
    </div>

    <div style="background: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px;">Your Secret Share</h3>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">This is the second share needed to reconstruct the complete message.</p>
      <div style="background: #f3f4f6; padding: 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; color: #374151;">
${data.secretContent}
      </div>
    </div>

    <div class="info-box">
      <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;">How to Reconstruct</h4>
      <ol style="margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; color: #374151;">
        <li>Locate the first share from ${data.senderName}${data.secretCreatedAt ? ` (shared around ${data.secretCreatedAt.toLocaleDateString()})` : ""}</li>
        <li>Copy the share above</li>
        <li>Visit <a href="${decryptUrl}" style="color: #2563eb;">${decryptUrl}</a> to combine both shares</li>
      </ol>
    </div>

    <div class="notice-box">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Please keep this information secure.</strong> Store both shares safely and do not share with unauthorized parties.
      </p>
    </div>
  `

  const baseTemplate = renderBaseTemplate({
    title: "Confidential Message",
    content,
  })

  return {
    subject,
    html: baseTemplate.html,
    text: baseTemplate.text,
  }
}

/**
 * OTP authentication email template
 */
export function renderOTPTemplate(data: OTPTemplateData): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const userName = data.userName || "there"

  const content = `
    <p>Hi ${userName},</p>
    
    <p>Here's your sign-in code for ${companyName}:</p>

    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e40af; background: #f0f9ff; padding: 16px 24px; border-radius: 8px; border: 1px solid #bfdbfe;">
        ${data.code}
      </div>
    </div>

    <div class="info-box">
      <p style="margin: 0; font-size: 14px; color: #1e40af;">
        This code expires in <strong>${data.expirationMinutes} minutes</strong> and can only be used once.
      </p>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
      If you didn't request this code, you can safely ignore this email. Your account is secure.
    </p>
  `

  const baseTemplate = renderBaseTemplate({
    title: "Your Sign-in Code",
    content,
  })

  return {
    subject: `${companyName}: Your sign-in code is ${data.code}`,
    html: baseTemplate.html,
    text: baseTemplate.text,
  }
}

/**
 * Password reset email template
 */
export function renderPasswordResetTemplate(
  data: PasswordResetTemplateData,
): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const userName = data.userName || "there"

  const content = `
    <p>Hi ${userName},</p>
    
    <p>We received a request to reset your ${companyName} password. Click the button below to create a new password:</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.resetUrl}" class="button" style="color: #ffffff; text-decoration: none;">Reset Password</a>
    </div>

    <div class="info-box">
      <p style="margin: 0; font-size: 14px; color: #1e40af;">
        This link expires in <strong>1 hour</strong> and can only be used once.
      </p>
    </div>

    <p style="font-size: 13px; color: #6b7280;">
      Or copy this link: <a href="${data.resetUrl}" style="color: #2563eb; word-break: break-all;">${data.resetUrl}</a>
    </p>

    <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
      If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
  `

  const baseTemplate = renderBaseTemplate({
    title: "Reset Your Password",
    content,
  })

  return {
    subject: `${companyName}: Reset your password`,
    html: baseTemplate.html,
    text: baseTemplate.text,
  }
}

/**
 * Validate template data
 */
export function validateTemplateData(
  templateType:
    | "verification"
    | "reminder"
    | "disclosure"
    | "password-reset"
    | "otp",
  data: any,
): ValidationResult {
  const errors: string[] = []

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  switch (templateType) {
    case "verification":
      if (!data.verificationUrl) {
        errors.push("verificationUrl is required")
      }
      if (!data.expirationHours || typeof data.expirationHours !== "number") {
        errors.push("expirationHours is required and must be a number")
      }
      if (data.supportEmail && !emailRegex.test(data.supportEmail)) {
        errors.push("Invalid email format in supportEmail")
      }
      break

    case "reminder":
      if (!data.userName) {
        errors.push("userName is required")
      }
      if (!data.secretTitle) {
        errors.push("secretTitle is required")
      }
      if (typeof data.daysRemaining !== "number") {
        errors.push("daysRemaining is required and must be a number")
      }
      if (!data.checkInUrl) {
        errors.push("checkInUrl is required")
      }
      break

    case "disclosure":
      if (!data.contactName) {
        errors.push("contactName is required")
      }
      if (!data.secretTitle) {
        errors.push("secretTitle is required")
      }
      if (!data.senderName) {
        errors.push("senderName is required")
      }
      if (!data.message) {
        errors.push("message is required")
      }
      if (!data.secretContent) {
        errors.push("secretContent is required")
      }
      break

    case "password-reset":
      if (!data.resetUrl) {
        errors.push("resetUrl is required")
      }
      if (data.supportEmail && !emailRegex.test(data.supportEmail)) {
        errors.push("Invalid email format in supportEmail")
      }
      break

    case "otp":
      if (!data.code) {
        errors.push("code is required")
      }
      if (data.code && !/^\d{8}$/.test(data.code)) {
        errors.push("code must be an 8-digit number")
      }
      if (
        !data.expirationMinutes ||
        typeof data.expirationMinutes !== "number"
      ) {
        errors.push("expirationMinutes is required and must be a number")
      }
      if (data.supportEmail && !emailRegex.test(data.supportEmail)) {
        errors.push("Invalid email format in supportEmail")
      }
      break

    default:
      errors.push(`Unknown template type: ${templateType}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// Billing & Subscription Templates
// (Merged from $lib/services/email-templates.ts)
// ============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getTierFeaturesHtml(tierName: string): string {
  const tierConfig = getTierConfig(tierName as "free" | "pro")
  if (!tierConfig || !tierConfig.features) {
    return "<li>All features included</li>"
  }
  const supportEmail = getSupportEmail()
  return tierConfig.features
    .map((feature: string) =>
      feature.replace(/support@keyfate\.com/g, supportEmail),
    )
    .map((feature: string) => `<li>${feature}</li>`)
    .join("")
}

export function renderSubscriptionConfirmationTemplate(params: {
  userName: string
  tierName: string
  provider: "stripe" | "btcpay"
  amount: number
  interval: string
  nextBillingDate: Date
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const formattedAmount = formatCurrency(params.amount)
  const formattedDate = params.nextBillingDate.toLocaleDateString()
  const providerName = params.provider === "stripe" ? "Credit Card" : "Bitcoin"

  const content = `
    <p>Hi ${params.userName},</p>
    <p>Thank you for subscribing to <strong>${companyName} ${capitalizeFirst(params.tierName)}</strong>. Your subscription is now active.</p>
    <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${capitalizeFirst(params.tierName)}</p>
      <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${formattedAmount}/${params.interval}</p>
      <p style="margin: 0 0 8px 0;"><strong>Payment Method:</strong> ${providerName}</p>
      <p style="margin: 0;"><strong>Next Billing:</strong> ${formattedDate}</p>
    </div>
    <p>Your ${capitalizeFirst(params.tierName)} features include:</p>
    <ul style="color: #374151;">${getTierFeaturesHtml(params.tierName)}</ul>
    <p style="text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="button" style="color: #ffffff; text-decoration: none;">Go to Dashboard</a>
    </p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Subscription Confirmed", content })
  return { subject: `${companyName}: Your subscription is confirmed`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderPaymentFailedTemplate(params: {
  userName: string
  amount: number
  provider: "stripe" | "btcpay"
  attemptCount: number
  maxAttempts: number
  nextRetry: Date
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const formattedAmount = formatCurrency(params.amount)
  const formattedRetry = params.nextRetry.toLocaleString()
  const providerName = params.provider === "stripe" ? "Credit Card" : "Bitcoin"

  const content = `
    <p>Hi ${params.userName},</p>
    <p>We were unable to process your payment of <strong>${formattedAmount}</strong> using your ${providerName}.</p>
    <div class="notice-box">
      <p style="margin: 0 0 8px 0; color: #92400e;"><strong>Attempt ${params.attemptCount} of ${params.maxAttempts}</strong></p>
      <p style="margin: 0; color: #92400e;">We'll retry automatically on ${formattedRetry}.</p>
      ${params.attemptCount >= params.maxAttempts ? '<p style="margin: 8px 0 0 0; color: #92400e;"><strong>Note:</strong> This was our final automatic attempt.</p>' : ""}
    </div>
    <p>To resolve this:</p>
    <ul style="color: #374151;">
      <li>Ensure your payment method has sufficient funds</li>
      <li>Verify your payment details are current</li>
      <li>Update your payment method if needed</li>
    </ul>
    <p style="text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/settings/subscription" class="button" style="color: #ffffff; text-decoration: none;">Update Payment Method</a>
    </p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Payment Update Needed", content })
  return { subject: `${companyName}: Payment update needed`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderSubscriptionCancelledTemplate(params: {
  userName: string
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
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
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing" class="button" style="color: #ffffff; text-decoration: none;">View Plans</a>
    </p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Subscription Cancelled", content })
  return { subject: `${companyName}: Your subscription has been cancelled`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderTrialWillEndTemplate(params: {
  userName: string
  daysRemaining: number
  trialEndDate: Date
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const formattedDate = params.trialEndDate.toLocaleDateString()
  const content = `
    <p>Hi ${params.userName},</p>
    <p>Your free trial ends in <strong>${params.daysRemaining} days</strong> (${formattedDate}).</p>
    <div class="info-box">
      <p style="margin: 0; color: #1e40af;">Subscribe now to keep access to all your premium features.</p>
    </div>
    <ul style="color: #374151;">
      <li>Unlimited secrets storage</li>
      <li>Advanced encryption options</li>
      <li>Priority support</li>
      <li>Custom check-in intervals</li>
    </ul>
    <p style="text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing" class="button" style="color: #ffffff; text-decoration: none;">Choose Your Plan</a>
    </p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Trial Ending Soon", content })
  return { subject: `${companyName}: Your trial ends in ${params.daysRemaining} days`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderBitcoinPaymentConfirmationTemplate(params: {
  userName: string
  amount: number
  currency: string
  tierName: string
  confirmations: number
  transactionId?: string
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const content = `
    <p>Hi ${params.userName},</p>
    <p>Your Bitcoin payment has been confirmed and your <strong>${capitalizeFirst(params.tierName)}</strong> subscription is now active.</p>
    <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${params.amount} ${params.currency}</p>
      <p style="margin: 0 0 8px 0;"><strong>Confirmations:</strong> ${params.confirmations}/6</p>
      <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${capitalizeFirst(params.tierName)}</p>
      ${params.transactionId ? `<p style="margin: 0; font-size: 12px; color: #6b7280;"><strong>TX:</strong> ${params.transactionId}</p>` : ""}
    </div>
    <p style="text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="button" style="color: #ffffff; text-decoration: none;">Go to Dashboard</a>
    </p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Bitcoin Payment Confirmed", content })
  return { subject: `${companyName}: Bitcoin payment confirmed`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderAdminAlertTemplate(params: {
  type: string
  severity: "low" | "medium" | "high" | "critical"
  message: string
  details: Record<string, unknown>
  timestamp: Date
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const content = `
    <p><strong>Type:</strong> ${params.type}</p>
    <p><strong>Severity:</strong> ${params.severity}</p>
    <p><strong>Time:</strong> ${params.timestamp.toISOString()}</p>
    <div class="info-box">
      <p style="margin: 0; color: #1e40af;">${params.message}</p>
    </div>
    <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600;">Details</p>
      <pre style="margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${JSON.stringify(params.details, null, 2)}</pre>
    </div>
  `
  const baseTemplate = renderBaseTemplate({ title: `Admin Alert: ${params.type}`, content })
  return { subject: `${companyName} Admin: ${params.type} [${params.severity}]`, html: baseTemplate.html, text: baseTemplate.text }
}

// ============================================================================
// GDPR Email Templates
// (Merged from $lib/services/email-templates.ts)
// ============================================================================

export function renderDataExportReadyTemplate(params: {
  userName: string
  downloadUrl: string
  expiresAt: Date
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const hoursRemaining = Math.floor((params.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
  const content = `
    <p>Hi ${params.userName},</p>
    <p>Your personal data export is ready to download.</p>
    <div class="notice-box">
      <p style="margin: 0; color: #92400e;">This link expires in <strong>${hoursRemaining} hours</strong> and can be downloaded up to 3 times.</p>
    </div>
    <p style="text-align: center;">
      <a href="${params.downloadUrl}" class="button" style="color: #ffffff; text-decoration: none;">Download My Data</a>
    </p>
    <p><strong>What's included:</strong></p>
    <ul style="color: #374151;">
      <li>Your profile information</li>
      <li>All secrets and their metadata</li>
      <li>Check-in history</li>
      <li>Audit logs</li>
      <li>Subscription and payment history</li>
    </ul>
    <p style="font-size: 13px; color: #6b7280;">If you didn't request this export, please contact us at ${getSupportEmail()}</p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Your Data Export is Ready", content })
  return { subject: `${companyName}: Your data export is ready`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderAccountDeletionConfirmationTemplate(params: {
  userName: string
  confirmationUrl: string
  scheduledDate: Date
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const daysUntilDeletion = Math.floor((params.scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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
      <a href="${params.confirmationUrl}" class="button" style="color: #ffffff; text-decoration: none;">Confirm Account Deletion</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      <strong>Changed your mind?</strong> Simply ignore this email. Your account will remain active.<br>
      <strong>Didn't request this?</strong> Contact us at ${getSupportEmail()}
    </p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Account Deletion Request", content })
  return { subject: `${companyName}: Confirm your account deletion request`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderAccountDeletionGracePeriodTemplate(params: {
  userName: string
  daysRemaining: number
  cancelUrl: string
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const content = `
    <p>Hi ${params.userName},</p>
    <p>This is a reminder that your account is scheduled for deletion in <strong>${params.daysRemaining} days</strong>.</p>
    <div class="notice-box">
      <p style="margin: 0; color: #92400e;">Your account and all data will be permanently deleted unless you cancel.</p>
    </div>
    <p>Changed your mind?</p>
    <p style="text-align: center;">
      <a href="${params.cancelUrl}" class="button" style="color: #ffffff; text-decoration: none;">Cancel Deletion</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">If you take no action, deletion will proceed automatically on the scheduled date.</p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Account Deletion Reminder", content })
  return { subject: `${companyName}: Account deletion in ${params.daysRemaining} days`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderAccountDeletionCompleteTemplate(params: {
  userName: string
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const content = `
    <p>Hi ${params.userName},</p>
    <p>Your account has been permanently deleted as requested.</p>
    <div class="info-box">
      <p style="margin: 0; color: #1e40af;">All your data has been removed from our systems in accordance with GDPR regulations.</p>
    </div>
    <p>Thank you for using ${companyName}. If you ever need our services again, you're welcome to create a new account.</p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Account Deleted", content })
  return { subject: `${companyName}: Your account has been deleted`, html: baseTemplate.html, text: baseTemplate.text }
}

export function renderAccountDeletionCancelledTemplate(params: {
  userName: string
}): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const dashboardUrl = `${process.env.NEXTAUTH_URL || "https://keyfate.com"}/dashboard`
  const content = `
    <p>Hi ${params.userName},</p>
    <p>Your account deletion request has been cancelled.</p>
    <div class="info-box">
      <p style="margin: 0; color: #1e40af;">Your account and all your data remain active and secure.</p>
    </div>
    <p style="text-align: center;">
      <a href="${dashboardUrl}" class="button" style="color: #ffffff; text-decoration: none;">Go to Dashboard</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">If you didn't cancel this request, please contact us at ${getSupportEmail()}</p>
  `
  const baseTemplate = renderBaseTemplate({ title: "Account Deletion Cancelled", content })
  return { subject: `${companyName}: Account deletion cancelled`, html: baseTemplate.html, text: baseTemplate.text }
}
