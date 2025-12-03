/**
 * Email Templates
 *
 * Professional email templates for verification, reminders, and secret disclosure
 * with consistent branding and responsive design.
 */

import { formatTimeRemaining } from "@/lib/time-utils"

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
 * Convert reminder type to human-readable text
 */
function getReminderTypeText(
  reminderType?:
    | "1_hour"
    | "12_hours"
    | "24_hours"
    | "3_days"
    | "7_days"
    | "25_percent"
    | "50_percent",
): string | null {
  if (!reminderType) return null

  const typeMap: Record<string, string> = {
    "1_hour": "1 hour before deadline",
    "12_hours": "12 hours before deadline",
    "24_hours": "24 hours before deadline",
    "3_days": "3 days before deadline",
    "7_days": "7 days before deadline",
    "25_percent": "75% time elapsed",
    "50_percent": "halfway to deadline",
  }

  return typeMap[reminderType] || null
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
  const reminderTypeText = getReminderTypeText(data.reminderType)

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

    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Secret:</strong> ${data.secretTitle}</p>
      <p style="margin: 0;"><strong>Time remaining:</strong> ${timeText}</p>${
        reminderTypeText
          ? `
      <p style="margin: 8px 0 0 0; font-size: 13px; color: #666;">Reminder type: ${reminderTypeText}</p>`
          : ""
      }
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
