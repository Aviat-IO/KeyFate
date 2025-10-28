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
 */
export function renderBaseTemplate(data: BaseTemplateData): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"
  const currentYear = new Date().getFullYear()

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f9f9f9;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 15px 0;
    }
    .urgent {
      background-color: #dc3545;
      color: #ffffff;
      border: 2px solid #dc3545;
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    .warning {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <!-- Wrapper table for centering and max-width constraint -->
  <!-- cspell:disable-next-line - cellspacing is valid HTML email attribute -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 20px;">
        <!-- Main content table with max-width -->
        <!-- cspell:disable-next-line - cellspacing is valid HTML email attribute -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding: 30px 30px 20px 30px; border-bottom: 2px solid #e0e0e0;">
              <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px;">${companyName}</div>
              <h1 style="margin: 0; font-size: 28px; color: #333;">${data.title}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              ${data.content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; font-size: 12px; color: #666; padding: 20px 30px 30px 30px; border-top: 1px solid #e0e0e0;">
              ${data.footerText || ""}
              <p style="margin: 10px 0;">&copy; ${currentYear} ${companyName}. All rights reserved.</p>
              <p style="margin: 10px 0;">This is an automated message. Please do not reply to this email.</p>
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

© ${currentYear} ${companyName}. All rights reserved.
This is an automated message. Please do not reply to this email.
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
  const supportEmail = data.supportEmail || getSupportEmail()

  const content = `
    <p>Welcome ${userName}!</p>
    <p>Please click the button below to verify your email address and complete your account setup:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.verificationUrl}" class="button" style="color: #ffffff; text-decoration: none;">Verify Email Address</a>
    </div>

    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${data.verificationUrl}
    </p>

    <div class="warning">
      <p><strong>This verification link expires in ${data.expirationHours} hours.</strong></p>
    </div>

    <p>If you didn't create an account with ${companyName}, you can safely ignore this email.</p>

    <p>Need help? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
  `

  const baseTemplate = renderBaseTemplate({
    title: `Verify your email address`,
    content,
    footerText: `If you have any questions, please contact us at ${supportEmail}`,
  })

  return {
    subject: `Verify your email address`,
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
  const urgencyConfig = {
    low: { bgColor: "#2563eb", textColor: "#ffffff", label: "Scheduled" },
    medium: { bgColor: "#2563eb", textColor: "#ffffff", label: "Important" },
    high: { bgColor: "#dc3545", textColor: "#ffffff", label: "URGENT" },
    critical: { bgColor: "#dc3545", textColor: "#ffffff", label: "CRITICAL" },
  }

  const urgency = urgencyConfig[data.urgencyLevel || "medium"]
  const timeText = formatTimeRemaining(data.daysRemaining)
  const reminderTypeText = getReminderTypeText(data.reminderType)

  const subject = `${urgency.label}: Check-in required within ${timeText} - ${data.secretTitle}`

  const content = `
    <div style="background-color: ${urgency.bgColor}; color: ${urgency.textColor}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; color: ${urgency.textColor};">Check-in Reminder</h2>
      <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: ${urgency.textColor};">
        You need to check in for "${data.secretTitle}" within ${timeText}
      </p>
      ${
        data.urgencyLevel === "critical" || data.urgencyLevel === "high"
          ? `
      <p style="margin: 10px 0 0 0; font-size: 15px; color: ${urgency.textColor};"><strong>Time is running out!</strong></p>
      <p style="margin: 5px 0 0 0; color: ${urgency.textColor};">Please check in immediately to prevent automatic disclosure.</p>
      `
          : ""
      }
    </div>

    <p>Hi ${data.userName},</p>

    <p>This is a ${urgency.label.toLowerCase()} reminder that you need to check in for your secret:</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0;">${data.secretTitle}</h3>
      <p style="margin: 0;"><strong>Time remaining:</strong> ${timeText}</p>${
        reminderTypeText
          ? `
      <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Reminder: ${reminderTypeText}</p>`
          : ""
      }
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.checkInUrl}" class="button" style="color: #ffffff;">Check In Now</a>
    </div>

    <p>If you don't check in on time, your secret will be disclosed to your designated contacts as scheduled.</p>

    <p>You can also copy and paste this link:</p>
    <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${data.checkInUrl}
    </p>
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
  const supportEmail = getSupportEmail()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://keyfate.com"
  const decryptUrl = `${siteUrl}/decrypt`
  const lastSeenText = data.senderLastSeen
    ? data.senderLastSeen.toLocaleDateString()
    : "some time ago"

  const reasonText =
    data.disclosureReason === "manual"
      ? `${data.senderName} has manually shared this information with you.`
      : `${data.senderName} has not checked in as scheduled (last seen: ${lastSeenText}).`

  const subject = `Confidential Message from ${data.senderName} - ${data.secretTitle}`

  const content = `
    <div style="background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 10px 0; color: #dc3545;">Confidential Information</h2>
      <p style="margin: 0;">This email contains a secret share from ${data.senderName}.</p>
    </div>

    <p>Dear ${data.contactName},</p>

    <p>KeyFate is a secure dead man's switch platform that helps people share sensitive information with trusted recipients in case of emergency. ${data.senderName} trusted you with this confidential information.</p>

    <p>${reasonText}</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Secret:</strong> ${data.secretTitle}</p>
      <p style="margin: 0;"><strong>From:</strong> ${data.senderName}</p>
    </div>

    <div style="background: white; border: 2px solid #2563eb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: #2563eb;">Your Secret Share</h3>
      <p style="margin: 0 0 15px 0;">This is the <strong>second share</strong> you need to reconstruct the secret.</p>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-word;">
${data.secretContent}
      </div>
    </div>

    <div style="background: #e8f4f8; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
      <h4 style="margin: 0 0 10px 0; color: #2563eb;">How to Reconstruct the Secret</h4>
      <ol style="margin: 10px 0; padding-left: 20px;">
        <li>You should have already received the <strong>first share</strong> from ${data.senderName}${data.secretCreatedAt ? ` (sent approximately ${data.secretCreatedAt.toLocaleDateString()})` : ""}</li>
        <li>Copy the share above (the second share)</li>
        <li>Visit <a href="${decryptUrl}" style="color: #2563eb;">${decryptUrl}</a> and combine both shares using our decryption tool</li>
        <li>You need 2 shares total to reconstruct the complete secret</li>
      </ol>
    </div>

    <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0;">
      <p style="margin: 0 0 5px 0; font-weight: bold;">Security Reminder</p>
      <ul style="margin: 5px 0 0 0; padding-left: 20px;">
        <li>Store both shares securely</li>
        <li>Do not share with unauthorized persons</li>
        <li>Consider keeping an offline backup</li>
      </ul>
    </div>
  `

  const baseTemplate = renderBaseTemplate({
    title: "Confidential Information Disclosure",
    content,
    footerText: `Need help? Contact us at ${supportEmail}`,
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
  const supportEmail = data.supportEmail || getSupportEmail()

  const content = `
    <p>Hi ${userName},</p>
    <p>Your verification code for signing in to ${companyName} is:</p>

    <div style="text-align: center; margin: 30px 0;">
      <div style="display: inline-block; font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #f0f7ff; padding: 20px 30px; border-radius: 8px; border: 2px solid #2563eb;">
        ${data.code}
      </div>
    </div>

    <div class="warning">
      <p><strong>This code expires in ${data.expirationMinutes} minutes.</strong></p>
      <p>For security, this code can only be used once.</p>
    </div>

    <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0;">
      <p style="margin: 0 0 5px 0; font-weight: bold;">Security Notice</p>
      <ul style="margin: 5px 0 0 0; padding-left: 20px;">
        <li>Never share this code with anyone</li>
        <li>KeyFate staff will never ask you for this code</li>
        <li>If you didn't request this code, please ignore this email</li>
      </ul>
    </div>

    <p style="font-size: 12px; color: #666; margin-top: 30px;">Having trouble signing in? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
  `

  const baseTemplate = renderBaseTemplate({
    title: `Your sign-in code`,
    content,
    footerText: `If you didn't request this code, you can safely ignore this email.`,
  })

  return {
    subject: `Your ${companyName} sign-in code: ${data.code}`,
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
  const supportEmail = data.supportEmail || getSupportEmail()

  const content = `
    <p>Hi ${userName},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.resetUrl}" class="button" style="color: #ffffff; text-decoration: none;">Reset Password</a>
    </div>

    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${data.resetUrl}
    </p>

    <div class="warning">
      <p><strong>This reset link expires in 1 hour.</strong></p>
      <p>For security, this link can only be used once.</p>
    </div>

    <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0;">
      <p style="margin: 0 0 5px 0; font-weight: bold;">Security Notice</p>
      <p style="margin: 5px 0;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    </div>

    <p>Need help? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
  `

  const baseTemplate = renderBaseTemplate({
    title: `Reset your password`,
    content,
    footerText: `If you have any questions, please contact us at ${supportEmail}`,
  })

  return {
    subject: `Reset your password`,
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
