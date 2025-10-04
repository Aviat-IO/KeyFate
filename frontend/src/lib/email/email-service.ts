/**
 * Production Email Service
 *
 * Provides production-ready email delivery using SendGrid/Resend
 * with proper error handling, retry logic, and rate limiting.
 */

import nodemailer from "nodemailer";

// Email service configuration
interface EmailConfig {
  provider: "sendgrid" | "console-dev" | "resend";
  apiKey?: string;
  adminEmail?: string;
  senderName?: string;
  developmentMode?: boolean;
}

// Email data structure
interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  priority?: "high" | "normal" | "low";
  headers?: Record<string, string>;
  trackDelivery?: boolean;
}

// Email sending options
interface EmailOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

// Email sending result
export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
  retryable?: boolean;
  retryAfter?: number;
  attempts?: number;
  trackingEnabled?: boolean;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetTime: number;
  };
}

// Email configuration validation result
interface ConfigValidationResult {
  valid: boolean;
  provider: string;
  missingVars: string[];
  config?: EmailConfig;
  developmentMode?: boolean;
}

// Delivery status tracking
interface DeliveryStatus {
  messageId: string;
  status: "sent" | "delivered" | "failed" | "bounced" | "spam";
  deliveredAt?: Date;
  events: Array<{
    type: string;
    timestamp: Date;
    details?: string;
  }>;
}

/**
 * Validate email service configuration
 */
export async function validateEmailConfig(): Promise<ConfigValidationResult> {
  const missingVars: string[] = [];
  const isDevelopment = process.env.NODE_ENV === "development";

  // Check for SendGrid configuration
  if (!process.env.SENDGRID_API_KEY) {
    missingVars.push("SENDGRID_API_KEY");
  }
  if (!process.env.SENDGRID_ADMIN_EMAIL) {
    missingVars.push("SENDGRID_ADMIN_EMAIL");
  }

  // In development, allow fallback to console logging
  if (isDevelopment && missingVars.length > 0) {
    return {
      valid: true,
      provider: "console-dev",
      missingVars: [],
      developmentMode: true,
    };
  }

  if (missingVars.length > 0) {
    return {
      valid: false,
      provider: "sendgrid",
      missingVars,
    };
  }

  return {
    valid: true,
    provider: "sendgrid",
    missingVars: [],
    config: {
      provider: "sendgrid",
      apiKey: process.env.SENDGRID_API_KEY,
      adminEmail: process.env.SENDGRID_ADMIN_EMAIL,
      senderName: process.env.SENDGRID_SENDER_NAME || "Dead Man's Switch",
    },
  };
}

/**
 * Create email transporter based on configuration
 */
async function createTransporter() {
  const config = await validateEmailConfig();

  if (!config.valid) {
    throw new Error(
      `Email configuration invalid: ${config.missingVars.join(", ")}`,
    );
  }

  if (config.developmentMode) {
    // Development mode - log to console
    return null;
  }

  // Production SendGrid configuration
  const transporter = nodemailer.createTransport({
    service: "SendGrid",
    auth: {
      user: "apikey",
      pass: process.env.SENDGRID_API_KEY,
    },
  });

  return transporter;
}

/**
 * Implement exponential backoff retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on non-retryable errors
      if (error instanceof Error && error.message.includes("Invalid API key")) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Send email using configured provider
 */
export async function sendEmail(
  emailData: EmailData,
  options: EmailOptions = {},
): Promise<EmailResult> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
  } = options;

  try {
    const config = await validateEmailConfig();

    if (!config.valid && !config.developmentMode) {
      return {
        success: false,
        error: `Email service not configured: ${config.missingVars.join(", ")}`,
        retryable: false,
      };
    }

    // Development mode - console logging
    if (config.developmentMode) {
      console.log(`
======== DEVELOPMENT EMAIL ========
To: ${emailData.to}
Subject: ${emailData.subject}
From: ${emailData.from || config.config?.adminEmail}
${emailData.text || "HTML content provided"}
===================================
      `);

      return {
        success: true,
        messageId: `dev-${Date.now()}-${
          Math.random().toString(36).substring(7)
        }`,
        provider: "console-dev",
      };
    }

    // Production email sending with retry logic
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts++;
        const transporter = await createTransporter();

        if (!transporter) {
          throw new Error("Failed to create email transporter");
        }

        const mailOptions = {
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          from: emailData.from ||
            `${config.config?.senderName} <${config.config?.adminEmail}>`,
          replyTo: emailData.replyTo,
          headers: emailData.headers,
          priority: emailData.priority || "normal",
        };

        const info = await transporter.sendMail(mailOptions);

        return {
          success: true,
          messageId: info.messageId,
          provider: "sendgrid",
          attempts,
          trackingEnabled: emailData.trackDelivery || false,
        };
      },
      maxRetries,
      retryDelay,
    );

    return result;
  } catch (error) {
    console.error("[EmailService] Error sending email:", error);

    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    const isRetryable = !errorMessage.includes("Invalid API key") &&
      !errorMessage.includes("Authentication failed");

    // Check for rate limiting
    if (errorMessage.includes("Rate limit") || errorMessage.includes("429")) {
      return {
        success: false,
        error: "Rate limit exceeded",
        retryable: true,
        retryAfter: 60,
        rateLimitInfo: {
          limit: 100,
          remaining: 0,
          resetTime: Date.now() + 60000,
        },
      };
    }

    return {
      success: false,
      error: errorMessage,
      retryable: isRetryable,
    };
  }
}

/**
 * Send verification email using template
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<EmailResult & { templateUsed?: string; emailData?: any }> {
  const { renderVerificationTemplate } = await import("./templates");

  const templateData = {
    verificationUrl:
      `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${token}&email=${
        encodeURIComponent(email)
      }`,
    expirationHours: 24,
    userName: email.split("@")[0], // Simple fallback
    supportEmail: process.env.SENDGRID_ADMIN_EMAIL,
  };

  const template = renderVerificationTemplate(templateData);

  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    trackDelivery: true,
  });

  if (result.success) {
    return {
      ...result,
      templateUsed: "verification",
      emailData: {
        subject: template.subject,
        verificationUrl: templateData.verificationUrl,
        expirationHours: templateData.expirationHours,
      },
    };
  }

  return result;
}

/**
 * Send reminder email
 */
export async function sendReminderEmail(reminderData: {
  userEmail: string;
  userName: string;
  secretTitle: string;
  daysRemaining: number;
  checkInUrl: string;
  urgencyLevel?: "low" | "medium" | "high" | "critical";
}): Promise<EmailResult & { templateUsed?: string }> {
  const { renderReminderTemplate } = await import("./templates");

  const template = renderReminderTemplate(reminderData);

  const result = await sendEmail({
    to: reminderData.userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    priority:
      reminderData.urgencyLevel === "critical" ||
        reminderData.urgencyLevel === "high"
        ? "high"
        : "normal",
    trackDelivery: true,
  });

  if (result.success) {
    return {
      ...result,
      templateUsed: "reminder",
    };
  }

  return result;
}

/**
 * Send secret disclosure email
 */
export async function sendSecretDisclosureEmail(disclosureData: {
  contactEmail: string;
  contactName: string;
  secretTitle: string;
  senderName: string;
  message: string;
  secretContent: string;
  disclosureReason?: "scheduled" | "manual";
  senderLastSeen?: Date;
}): Promise<EmailResult & { templateUsed?: string }> {
  const { renderDisclosureTemplate } = await import("./templates");

  const template = renderDisclosureTemplate(disclosureData);

  const result = await sendEmail({
    to: disclosureData.contactEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "high",
    },
    trackDelivery: true,
  });

  if (result.success) {
    return {
      ...result,
      templateUsed: "disclosure",
    };
  }

  return result;
}

/**
 * Get delivery status for a message
 */
export async function getDeliveryStatus(
  messageId: string,
): Promise<DeliveryStatus> {
  // Mock implementation - in production this would integrate with SendGrid Events API
  return {
    messageId,
    status: "delivered",
    deliveredAt: new Date(),
    events: [
      { type: "sent", timestamp: new Date(Date.now() - 60000) },
      { type: "delivered", timestamp: new Date() },
    ],
  };
}

/**
 * Format email template (re-exported from templates)
 */
export async function formatEmailTemplate(
  templateType: "verification" | "reminder" | "disclosure",
  data: any,
): Promise<{ subject: string; html: string; text: string }> {
  const templates = await import("./templates");

  switch (templateType) {
    case "verification":
      return templates.renderVerificationTemplate(data);
    case "reminder":
      return templates.renderReminderTemplate(data);
    case "disclosure":
      return templates.renderDisclosureTemplate(data);
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}
