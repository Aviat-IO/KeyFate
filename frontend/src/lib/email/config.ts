/**
 * Email Service Configuration
 *
 * Centralized configuration for different email providers
 * with environment-specific settings and fallbacks.
 */

export interface EmailProviderConfig {
  provider: "sendgrid" | "resend" | "console-dev" | "smtp"
  apiKey?: string
  host?: string
  port?: number
  secure?: boolean
  auth?: {
    user: string
    pass: string
  }
  from: {
    name: string
    email: string
  }
  replyTo?: string
  rateLimits?: {
    perSecond: number
    perHour: number
    perDay: number
  }
}

/**
 * Environment-specific email configurations
 */
export const EMAIL_CONFIGS: Record<string, EmailProviderConfig> = {
  // Production SendGrid configuration
  production_sendgrid: {
    provider: "sendgrid",
    apiKey: process.env.SENDGRID_API_KEY,
    from: {
      name: process.env.SENDGRID_SENDER_NAME || "Dead Man's Switch",
      email: process.env.SENDGRID_ADMIN_EMAIL || "noreply@deadmansswitch.com",
    },
    replyTo: process.env.SENDGRID_ADMIN_EMAIL,
    rateLimits: {
      perSecond: 1,
      perHour: 100,
      perDay: 2000,
    },
  },

  // Resend configuration (alternative)
  production_resend: {
    provider: "resend",
    apiKey: process.env.RESEND_API_KEY,
    from: {
      name: process.env.RESEND_SENDER_NAME || "Dead Man's Switch",
      email: process.env.RESEND_SENDER_EMAIL || "noreply@deadmansswitch.com",
    },
    rateLimits: {
      perSecond: 2,
      perHour: 100,
      perDay: 2000,
    },
  },

  // Development console logging
  development: {
    provider: "console-dev",
    from: {
      name: "Dead Man's Switch (Dev)",
      email: "dev@localhost",
    },
  },

  // Generic SMTP configuration
  smtp: {
    provider: "smtp",
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
    from: {
      name: process.env.SMTP_SENDER_NAME || "Dead Man's Switch",
      email: process.env.SMTP_SENDER_EMAIL || "",
    },
    rateLimits: {
      perSecond: 1,
      perHour: 50,
      perDay: 500,
    },
  },
}

/**
 * Get email configuration based on environment and provider preference
 */
export function getEmailConfig(): EmailProviderConfig {
  const env = process.env.NODE_ENV || "development"
  const provider = process.env.EMAIL_PROVIDER || "sendgrid"

  // Development mode
  if (env === "development") {
    // Check if SendGrid is configured for development testing
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_ADMIN_EMAIL) {
      return EMAIL_CONFIGS.production_sendgrid
    }
    return EMAIL_CONFIGS.development
  }

  // Production mode
  const configKey = `production_${provider}`

  if (EMAIL_CONFIGS[configKey]) {
    const config = EMAIL_CONFIGS[configKey]

    // Validate required fields
    if (config.provider === "sendgrid" && !config.apiKey) {
      throw new Error("SENDGRID_API_KEY is required for SendGrid provider")
    }

    if (config.provider === "resend" && !config.apiKey) {
      throw new Error("RESEND_API_KEY is required for Resend provider")
    }

    return config
  }

  // Fallback to SMTP if specific provider config not found
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return EMAIL_CONFIGS.smtp
  }

  // Last resort - development mode
  console.warn(
    "[EmailConfig] No email provider configured, falling back to console logging",
  )
  return EMAIL_CONFIGS.development
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(config: EmailProviderConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!config.from.email) {
    errors.push("Sender email is required")
  }

  if (!config.from.name) {
    errors.push("Sender name is required")
  }

  switch (config.provider) {
    case "sendgrid":
      if (!config.apiKey) {
        errors.push("SendGrid API key is required")
      }
      break

    case "resend":
      if (!config.apiKey) {
        errors.push("Resend API key is required")
      }
      break

    case "smtp":
      if (!config.host) {
        errors.push("SMTP host is required")
      }
      if (!config.auth?.user || !config.auth?.pass) {
        errors.push("SMTP authentication credentials are required")
      }
      break

    case "console-dev":
      // No validation needed for development console logging
      break

    default:
      errors.push(`Unknown email provider: ${config.provider}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Email template configuration
 */
export const EMAIL_TEMPLATE_CONFIG = {
  verification: {
    subject: "Verify your email address",
    expirationHours: 24,
    priority: "normal" as const,
  },
  reminder: {
    subjectPrefix: {
      low: "Reminder",
      medium: "Important",
      high: "URGENT",
      critical: "CRITICAL",
    },
    priority: {
      low: "normal" as const,
      medium: "normal" as const,
      high: "high" as const,
      critical: "high" as const,
    },
  },
  disclosure: {
    subjectPrefix: "Confidential Message",
    priority: "high" as const,
    securityHeaders: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
  },
} as const

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  verification: {
    maxPerHour: 5,
    maxPerDay: 20,
  },
  reminder: {
    maxPerHour: 10,
    maxPerDay: 100,
  },
  disclosure: {
    maxPerHour: 5,
    maxPerDay: 50,
  },
} as const
