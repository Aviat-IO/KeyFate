/**
 * Admin Notification Service
 *
 * Sends critical alerts to support@aviat.io when email operations fail.
 * Implements severity classification and batching to prevent alert spam.
 */

import { sendEmail, type EmailResult } from "./email-service";

// Notification severity levels
export type NotificationSeverity = "critical" | "high" | "medium" | "low";

// Email types matching schema
type EmailType = "reminder" | "disclosure" | "admin_notification" | "verification";

// Admin notification data structure
export interface AdminNotificationData {
  emailType: EmailType;
  recipient: string;
  errorMessage: string;
  secretTitle?: string;
  timestamp?: Date;
  retryCount?: number;
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
  emailType: EmailType;
  retryCount?: number;
}): NotificationSeverity {
  const { emailType, retryCount = 0 } = data;

  // Critical: Disclosure emails are mission-critical
  if (emailType === "disclosure") {
    return "critical";
  }

  // High: Reminder emails with multiple retries
  if (emailType === "reminder" && retryCount > 3) {
    return "high";
  }

  // Medium: Reminder emails with few retries
  if (emailType === "reminder") {
    return "medium";
  }

  // Low: Verification and admin notification failures
  return "low";
}

/**
 * Format notification email content
 */
function formatNotificationContent(
  data: AdminNotificationData,
  severity: NotificationSeverity
): { subject: string; html: string; text: string } {
  const timestamp = data.timestamp || new Date();
  const retryCount = data.retryCount || 0;

  const subject = data.secretTitle
    ? `[${severity.toUpperCase()}] Email Delivery Failure - ${data.secretTitle}`
    : `[${severity.toUpperCase()}] Email Delivery Failure - ${data.emailType}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${getSeverityColor(severity)}; border-bottom: 2px solid ${getSeverityColor(severity)}; padding-bottom: 10px;">
        Email Delivery Failure - ${severity.toUpperCase()}
      </h2>

      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Severity:</strong> ${severity.toUpperCase()}</p>
        <p style="margin: 5px 0;"><strong>Email Type:</strong> ${data.emailType}</p>
        ${data.secretTitle ? `<p style="margin: 5px 0;"><strong>Secret:</strong> ${data.secretTitle}</p>` : ""}
        <p style="margin: 5px 0;"><strong>Recipient:</strong> ${data.recipient}</p>
        <p style="margin: 5px 0;"><strong>Retry Count:</strong> ${retryCount}</p>
        <p style="margin: 5px 0;"><strong>Timestamp:</strong> ${timestamp.toISOString()}</p>
      </div>

      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Error Message:</strong></p>
        <p style="margin: 10px 0 0 0; font-family: monospace; color: #721c24;">${data.errorMessage}</p>
      </div>

      ${getSeverityGuidance(severity)}

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        <p>This is an automated alert from the Dead Man's Switch email monitoring system.</p>
      </div>
    </div>
  `;

  const text = `
Email Delivery Failure - ${severity.toUpperCase()}

Severity: ${severity.toUpperCase()}
Email Type: ${data.emailType}
${data.secretTitle ? `Secret: ${data.secretTitle}\n` : ""}Recipient: ${data.recipient}
Retry Count: ${retryCount}
Timestamp: ${timestamp.toISOString()}

Error Message:
${data.errorMessage}

${getSeverityGuidanceText(severity)}

---
This is an automated alert from the Dead Man's Switch email monitoring system.
  `.trim();

  return { subject, html, text };
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case "critical":
      return "#dc3545";
    case "high":
      return "#fd7e14";
    case "medium":
      return "#ffc107";
    case "low":
      return "#17a2b8";
  }
}

/**
 * Get guidance HTML based on severity
 */
function getSeverityGuidance(severity: NotificationSeverity): string {
  switch (severity) {
    case "critical":
      return `
        <div style="background-color: #dc3545; color: #ffffff; padding: 15px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; color: #ffffff;"><strong>CRITICAL ACTION REQUIRED</strong></p>
          <p style="margin: 10px 0 0 0; color: #ffffff;">
            A disclosure email has failed. The user's secret will not be delivered to the intended recipient.
            Immediate investigation and manual intervention may be required.
          </p>
        </div>
      `;
    case "high":
      return `
        <div style="background-color: #fd7e14; color: #ffffff; padding: 15px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; color: #ffffff;"><strong>HIGH PRIORITY</strong></p>
          <p style="margin: 10px 0 0 0; color: #ffffff;">
            A reminder email has failed multiple times. Check email service configuration and user contact details.
          </p>
        </div>
      `;
    case "medium":
      return `
        <div style="background-color: #17a2b8; color: #ffffff; padding: 15px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; color: #ffffff;"><strong>MEDIUM PRIORITY</strong></p>
          <p style="margin: 10px 0 0 0; color: #ffffff;">
            A reminder email has failed. Monitor for additional failures. Automatic retries are in progress.
          </p>
        </div>
      `;
    case "low":
      return `
        <div style="background-color: #28a745; color: #ffffff; padding: 15px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; color: #ffffff;"><strong>LOW PRIORITY</strong></p>
          <p style="margin: 10px 0 0 0; color: #ffffff;">
            A verification or admin notification email has failed. No immediate action required.
          </p>
        </div>
      `;
  }
}

/**
 * Get guidance text for plain text emails
 */
function getSeverityGuidanceText(severity: NotificationSeverity): string {
  switch (severity) {
    case "critical":
      return "CRITICAL ACTION REQUIRED: A disclosure email has failed. The user's secret will not be delivered. Immediate investigation required.";
    case "high":
      return "HIGH PRIORITY: A reminder email has failed multiple times. Check email service configuration.";
    case "medium":
      return "MEDIUM PRIORITY: A reminder email has failed. Monitor for additional failures.";
    case "low":
      return "LOW PRIORITY: A verification or admin notification email has failed. No immediate action required.";
  }
}

/**
 * Send admin notification for email failures
 *
 * @param data - Notification data including error details and context
 * @returns Email result indicating success or failure
 */
export async function sendAdminNotification(
  data: AdminNotificationData
): Promise<EmailResult> {
  try {
    // Calculate severity level
    const severity = calculateSeverity({
      emailType: data.emailType,
      retryCount: data.retryCount,
    });

    // Format notification content
    const { subject, html, text } = formatNotificationContent(data, severity);

    // Get admin email from environment or use default
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || "support@aviat.io";

    // Send notification using existing email service
    const result = await sendEmail({
      to: adminEmail,
      subject,
      html,
      text,
      priority: severity === "critical" || severity === "high" ? "high" : "normal",
      headers:
        severity === "critical"
          ? {
              "X-Priority": "1",
              "X-MSMail-Priority": "High",
              "Importance": "high",
            }
          : undefined,
    });

    return result;
  } catch (error) {
    console.error("[AdminNotification] Failed to send admin notification:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      retryable: true,
    };
  }
}
