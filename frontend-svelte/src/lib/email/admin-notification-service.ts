/**
 * Admin Notification Service
 *
 * Sends critical alerts to support@keyfate.com when email operations fail.
 * Implements severity classification and batching to prevent alert spam.
 */

import { sendEmail, type EmailResult } from "./email-service"

// Notification severity levels
export type NotificationSeverity = "critical" | "high" | "medium" | "low"

// Email types matching schema
type EmailType =
  | "reminder"
  | "disclosure"
  | "admin_notification"
  | "verification"

// Admin notification data structure
export interface AdminNotificationData {
  emailType: EmailType
  recipient: string
  errorMessage: string
  secretTitle?: string
  timestamp?: Date
  retryCount?: number
}

/**
 * Calculate severity level based on email type and retry count
 *
 * Severity Levels:
 * - Critical: Disclosure emails failing (user won't receive their secret)
 * - High: Reminder emails failing repeatedly (>3 retries)
 * - Medium: Reminder emails failing (first occurrence)
 * - Low: Verification/admin_notification emails failing
 */
export function calculateSeverity(data: {
  emailType: EmailType
  retryCount?: number
}): NotificationSeverity {
  const { emailType, retryCount = 0 } = data

  // Critical: Disclosure emails are mission-critical
  if (emailType === "disclosure") {
    return "critical"
  }

  // High: Reminder emails with multiple retries
  if (emailType === "reminder" && retryCount > 3) {
    return "high"
  }

  // Medium: Reminder emails with few retries
  if (emailType === "reminder") {
    return "medium"
  }

  // Low: Verification and admin notification failures
  return "low"
}

/**
 * Format notification email content
 * Uses clean, professional styling consistent with other system emails
 */
function formatNotificationContent(
  data: AdminNotificationData,
  severity: NotificationSeverity,
): { subject: string; html: string; text: string } {
  const timestamp = data.timestamp || new Date()
  const retryCount = data.retryCount || 0
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "KeyFate"

  const subject = data.secretTitle
    ? `${companyName} Admin: Email delivery issue - ${data.secretTitle} [${severity}]`
    : `${companyName} Admin: Email delivery issue - ${data.emailType} [${severity}]`

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td style="text-align: center; padding: 24px; border-bottom: 1px solid #e5e7eb;">
                  <div style="font-size: 20px; font-weight: 600; color: #2563eb;">${companyName}</div>
                  <h1 style="margin: 8px 0 0 0; font-size: 18px; color: #111827;">Email Delivery Issue</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px;">
                  <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                    <p style="margin: 0 0 8px 0;"><strong>Severity:</strong> ${severity}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Type:</strong> ${data.emailType}</p>
                    ${data.secretTitle ? `<p style="margin: 0 0 8px 0;"><strong>Secret:</strong> ${data.secretTitle}</p>` : ""}
                    <p style="margin: 0 0 8px 0;"><strong>Recipient:</strong> ${data.recipient}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Retries:</strong> ${retryCount}</p>
                    <p style="margin: 0;"><strong>Time:</strong> ${timestamp.toISOString()}</p>
                  </div>

                  <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
                    <p style="margin: 0 0 4px 0; font-weight: 600; color: #991b1b;">Error</p>
                    <p style="margin: 0; font-family: monospace; font-size: 13px; color: #7f1d1d;">${data.errorMessage}</p>
                  </div>

                  ${getSeverityGuidance(severity)}
                </td>
              </tr>
              <tr>
                <td style="text-align: center; font-size: 12px; color: #6b7280; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0;">Automated alert from ${companyName} monitoring</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const text = `
${companyName} Admin: Email Delivery Issue [${severity}]

Severity: ${severity}
Type: ${data.emailType}
${data.secretTitle ? `Secret: ${data.secretTitle}\n` : ""}Recipient: ${data.recipient}
Retries: ${retryCount}
Time: ${timestamp.toISOString()}

Error: ${data.errorMessage}

${getSeverityGuidanceText(severity)}

---
Automated alert from ${companyName} monitoring
  `.trim()

  return { subject, html, text }
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case "critical":
      return "#dc3545"
    case "high":
      return "#fd7e14"
    case "medium":
      return "#ffc107"
    case "low":
      return "#17a2b8"
  }
}

/**
 * Get guidance HTML based on severity
 * Uses softer, more professional styling
 */
function getSeverityGuidance(severity: NotificationSeverity): string {
  const configs = {
    critical: {
      bg: "#fef2f2",
      border: "#ef4444",
      text: "#991b1b",
      title: "Action needed",
      message: "A disclosure email has failed. The recipient may not receive their secret. Please investigate promptly.",
    },
    high: {
      bg: "#fff7ed",
      border: "#f97316",
      text: "#9a3412",
      title: "High priority",
      message: "A reminder email has failed multiple times. Please check email service configuration.",
    },
    medium: {
      bg: "#f0f9ff",
      border: "#3b82f6",
      text: "#1e40af",
      title: "Medium priority",
      message: "A reminder email has failed. Automatic retries are in progress. Monitor for additional failures.",
    },
    low: {
      bg: "#f0fdf4",
      border: "#22c55e",
      text: "#166534",
      title: "Low priority",
      message: "A verification or notification email has failed. No immediate action required.",
    },
  }

  const config = configs[severity]

  return `
    <div style="background: ${config.bg}; border-left: 4px solid ${config.border}; padding: 12px 16px; border-radius: 4px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: ${config.text};">${config.title}</p>
      <p style="margin: 0; font-size: 14px; color: ${config.text};">${config.message}</p>
    </div>
  `
}

/**
 * Get guidance text for plain text emails
 */
function getSeverityGuidanceText(severity: NotificationSeverity): string {
  switch (severity) {
    case "critical":
      return "Action needed: A disclosure email has failed. The recipient may not receive their secret. Please investigate promptly."
    case "high":
      return "High priority: A reminder email has failed multiple times. Please check email service configuration."
    case "medium":
      return "Medium priority: A reminder email has failed. Automatic retries are in progress."
    case "low":
      return "Low priority: A verification or notification email has failed. No immediate action required."
  }
}

/**
 * Send admin notification for email failures
 *
 * @param data - Notification data including error details and context
 * @returns Email result indicating success or failure
 */
export async function sendAdminNotification(
  data: AdminNotificationData,
): Promise<EmailResult> {
  try {
    // Calculate severity level
    const severity = calculateSeverity({
      emailType: data.emailType,
      retryCount: data.retryCount,
    })

    // Format notification content
    const { subject, html, text } = formatNotificationContent(data, severity)

    // Get admin email from environment or use default
    const adminEmail =
      process.env.ADMIN_ALERT_EMAIL ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
      "support@keyfate.com"

    // Send notification using existing email service
    const result = await sendEmail({
      to: adminEmail,
      subject,
      html,
      text,
      priority:
        severity === "critical" || severity === "high" ? "high" : "normal",
      headers:
        severity === "critical"
          ? {
              "X-Priority": "1",
              "X-MSMail-Priority": "High",
              Importance: "high",
            }
          : undefined,
    })

    return result
  } catch (error) {
    console.error(
      "[AdminNotification] Failed to send admin notification:",
      error,
    )

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      retryable: true,
    }
  }
}
