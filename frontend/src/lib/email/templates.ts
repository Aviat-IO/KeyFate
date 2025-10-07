/**
 * Email Templates
 *
 * Professional email templates for verification, reminders, and secret disclosure
 * with consistent branding and responsive design.
 */

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

/**
 * Format time remaining for display
 * Converts fractional days to hours when less than 1 day
 */
function formatTimeRemaining(daysRemaining: number): string {
  if (daysRemaining === 0) {
    return "today";
  }

  if (daysRemaining < 1) {
    // Convert to hours and round down
    const hours = Math.floor(daysRemaining * 24);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  // Round down to whole days
  const days = Math.floor(daysRemaining);
  return days === 1 ? "1 day" : `${days} days`;
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
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .container {
      background-color: #ffffff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    .content {
      margin-bottom: 30px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #666;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
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
  <div class="container">
    <div class="header">
      <div class="logo">${companyName}</div>
      <h1>${data.title}</h1>
    </div>
    <div class="content">
      ${data.content}
    </div>
    <div class="footer">
      ${data.footerText || ""}
      <p>&copy; ${currentYear} ${companyName}. All rights reserved.</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
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
    `${urgency.label}: Check-in required in ${timeText} - ${data.secretTitle}`;

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
 */
export function renderDisclosureTemplate(
  data: DisclosureTemplateData,
): EmailTemplate {
  const lastSeenText = data.senderLastSeen
    ? data.senderLastSeen.toLocaleDateString()
    : "some time ago";

  const reasonText = data.disclosureReason === "manual"
    ? `${data.senderName} has manually shared this information with you.`
    : `${data.senderName} has not checked in as scheduled (last seen: ${lastSeenText}).`;

  const subject =
    `Confidential Message from ${data.senderName} - ${data.secretTitle}`;

  const content = `
    <div style="border: 3px solid #dc3545; background-color: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h1 style="margin: 0 0 15px 0; color: #dc3545;">Confidential Message</h1>
      <p style="margin: 0; font-weight: bold; font-size: 16px;">
        This email contains sensitive information. Please handle with care.
      </p>
    </div>

    <p>Dear ${data.contactName},</p>

    <p>${reasonText}</p>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0;">${data.secretTitle}</h3>
      <p><strong>From:</strong> ${data.senderName}</p>
      ${
    data.senderLastSeen
      ? `<p><strong>Last seen:</strong> ${lastSeenText}</p>`
      : ""
  }
    </div>

    <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <h4 style="margin: 0 0 10px 0;">Personal Message:</h4>
      <p style="margin: 0; font-style: italic;">"${data.message}"</p>
    </div>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
      <h4 style="margin: 0 0 15px 0;">Confidential Content:</h4>
      <div style="background: white; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-word;">
${data.secretContent}
      </div>
    </div>

    <div style="background-color: #dc3545; color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0;">
      <p style="margin: 0; color: #ffffff;"><strong>IMPORTANT SECURITY NOTICE</strong></p>
      <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #ffffff;">
        <li>This information is confidential and intended only for you</li>
        <li>Please store this information securely</li>
        <li>Do not share this content with unauthorized persons</li>
        <li>Consider printing a copy and storing it safely offline</li>
      </ul>
    </div>

    <p>If you have any questions about this disclosure or need assistance, please contact our support team.</p>
  `;

  const baseTemplate = renderBaseTemplate({
    title: "Confidential Information Disclosure",
    content,
    footerText:
      "This disclosure was automated according to the sender's instructions.",
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
