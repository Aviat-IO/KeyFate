/**
 * Email Templates
 *
 * Professional email templates for verification, reminders, and secret disclosure
 * with consistent branding and responsive design.
 */

import { formatTimeRemaining } from "@/lib/time-utils";

// Template data interfaces
interface VerificationTemplateData {
  verificationUrl: string;
  expirationHours: number;
  userName?: string;
  supportEmail?: string;
}

interface ReminderTemplateData {
  userName: string;
  secretTitle: string;
  daysRemaining: number;
  checkInUrl: string;
  urgencyLevel?: "low" | "medium" | "high" | "critical";
}



interface DisclosureTemplateData {
  contactName: string;
  secretTitle: string;
  senderName: string;
  message: string;
  secretContent: string;
  disclosureReason?: "scheduled" | "manual";
  senderLastSeen?: Date;
}

interface BaseTemplateData {
  title: string;
  content: string;
  footerText?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Base email template with consistent branding
 * Uses table-based layout for maximum email client compatibility
 */
export function renderBaseTemplate(data: BaseTemplateData): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "Dead Man's Switch";
  const currentYear = new Date().getFullYear();

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
</html>`;

  const text = `
${data.title}

${data.content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()}

${data.footerText || ""}

© ${currentYear} ${companyName}. All rights reserved.
This is an automated message. Please do not reply to this email.
  `.trim();

  return {
    subject: data.title,
    html,
    text,
  };
}

/**
 * Email verification template
 */
export function renderVerificationTemplate(
  data: VerificationTemplateData,
): EmailTemplate {
  const companyName = process.env.NEXT_PUBLIC_COMPANY || "Dead Man's Switch";
  const userName = data.userName || "there";
  const supportEmail = data.supportEmail || "support@example.com";

  const content = `
    <p>Welcome ${userName}!</p>
    <p>Please click the button below to verify your email address and complete your account setup:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
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
  `;

  const baseTemplate = renderBaseTemplate({
    title: `Verify your email address - ${companyName}`,
    content,
    footerText:
      `If you have any questions, please contact us at ${supportEmail}`,
  });

  return {
    subject: `Verify your email address - ${companyName}`,
    html: baseTemplate.html,
    text: baseTemplate.text,
  };
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
  };

  const urgency = urgencyConfig[data.urgencyLevel || "medium"];
  const timeText = formatTimeRemaining(data.daysRemaining);

  const subject =
    `${urgency.label}: Check-in required within ${timeText} - ${data.secretTitle}`;

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
      <p style="margin: 0;"><strong>Time remaining:</strong> ${timeText}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.checkInUrl}" class="button" style="color: #ffffff;">Check In Now</a>
    </div>

    <p>If you don't check in on time, your secret will be disclosed to your designated contacts as scheduled.</p>

    <p>You can also copy and paste this link:</p>
    <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${data.checkInUrl}
    </p>
  `;

  const baseTemplate = renderBaseTemplate({
    title: "Check-in Reminder",
    content,
  });

  return {
    subject,
    html: baseTemplate.html,
    text: baseTemplate.text,
  };
}

/**
 * Secret disclosure email template
 * Sends the server's secret share to the recipient when triggered
 */
export function renderDisclosureTemplate(
  data: DisclosureTemplateData,
): EmailTemplate {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    "support@example.com";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://keyfate.com";
  const decryptUrl = `${siteUrl}/decrypt`;
  const lastSeenText = data.senderLastSeen
    ? data.senderLastSeen.toLocaleDateString()
    : "some time ago";

  const reasonText = data.disclosureReason === "manual"
    ? `${data.senderName} has manually shared this information with you.`
    : `${data.senderName} has not checked in as scheduled (last seen: ${lastSeenText}).`;

  const subject =
    `Confidential Message from ${data.senderName} - ${data.secretTitle}`;

  const content = `
    <div style="background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 10px 0; color: #dc3545;">Confidential Information</h2>
      <p style="margin: 0;">This email contains a secret share from ${data.senderName}.</p>
    </div>

    <p>Dear ${data.contactName},</p>

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
        <li>You should have already received the <strong>first share</strong> from ${data.senderName}</li>
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
  `;

  const baseTemplate = renderBaseTemplate({
    title: "Confidential Information Disclosure",
    content,
    footerText: `Need help? Contact us at ${supportEmail}`,
  });

  return {
    subject,
    html: baseTemplate.html,
    text: baseTemplate.text,
  };
}

/**
 * Validate template data
 */
export function validateTemplateData(
  templateType: "verification" | "reminder" | "disclosure",
  data: any,
): ValidationResult {
  const errors: string[] = [];

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  switch (templateType) {
    case "verification":
      if (!data.verificationUrl) {
        errors.push("verificationUrl is required");
      }
      if (!data.expirationHours || typeof data.expirationHours !== "number") {
        errors.push("expirationHours is required and must be a number");
      }
      if (data.supportEmail && !emailRegex.test(data.supportEmail)) {
        errors.push("Invalid email format in supportEmail");
      }
      break;

    case "reminder":
      if (!data.userName) {
        errors.push("userName is required");
      }
      if (!data.secretTitle) {
        errors.push("secretTitle is required");
      }
      if (typeof data.daysRemaining !== "number") {
        errors.push("daysRemaining is required and must be a number");
      }
      if (!data.checkInUrl) {
        errors.push("checkInUrl is required");
      }
      break;

    case "disclosure":
      if (!data.contactName) {
        errors.push("contactName is required");
      }
      if (!data.secretTitle) {
        errors.push("secretTitle is required");
      }
      if (!data.senderName) {
        errors.push("senderName is required");
      }
      if (!data.message) {
        errors.push("message is required");
      }
      if (!data.secretContent) {
        errors.push("secretContent is required");
      }
      break;

    default:
      errors.push(`Unknown template type: ${templateType}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
