/**
 * Email Environment Variable Validation and Configuration
 *
 * Centralized validation for email-related environment variables with:
 * - Required vs optional variable distinction
 * - Environment-specific validation (production vs development)
 * - Clear error messages with remediation steps
 * - Configuration status reporting
 * - Security best practices validation
 */

import type { EmailProviderType } from "./email-factory";

/**
 * Email environment validation result
 */
export interface EmailEnvironmentValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  environment: "production" | "development" | "test";
  provider: EmailProviderType;
  missingRequired: string[];
  missingOptional: string[];
}

/**
 * Email configuration status for runtime checks
 */
export interface EmailConfigStatus {
  ready: boolean;
  provider: EmailProviderType;
  environment: string;
  hasRequiredVars: boolean;
  cronSecretValid: boolean;
  configuredVars: string[];
  missingVars: string[];
  defaults: Record<string, string>;
  remediation?: string;
}

/**
 * Validation result for specific checks
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  errors?: string[];
}

/**
 * Default values for optional environment variables
 */
export const EMAIL_ENV_DEFAULTS = {
  SENDGRID_SENDER_NAME: "Dead Man's Switch",
  ADMIN_ALERT_EMAIL: "support@aviat.io",
  EMAIL_PROVIDER: "mock", // Development default
} as const;

/**
 * Minimum recommended CRON_SECRET length for security
 */
const MIN_CRON_SECRET_LENGTH = 16;

/**
 * Get required environment variables for a specific provider
 */
export function getRequiredEmailVars(provider: EmailProviderType): string[] {
  const baseRequired = ["CRON_SECRET"];

  if (provider === "sendgrid") {
    return [...baseRequired, "SENDGRID_API_KEY", "SENDGRID_ADMIN_EMAIL"];
  }

  return baseRequired;
}

/**
 * Get optional environment variables for a specific provider
 */
export function getOptionalEmailVars(provider: EmailProviderType): string[] {
  const baseOptional = ["EMAIL_PROVIDER", "ADMIN_ALERT_EMAIL"];

  if (provider === "sendgrid") {
    return [...baseOptional, "SENDGRID_SENDER_NAME"];
  }

  return baseOptional;
}

/**
 * Validate CRON_SECRET environment variable
 *
 * Ensures CRON_SECRET is present and meets security requirements.
 */
export function validateCronSecret(): ValidationResult {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return {
      valid: false,
      error: "CRON_SECRET is required for cron job authentication",
    };
  }

  if (cronSecret.length < MIN_CRON_SECRET_LENGTH) {
    return {
      valid: true,
      warning:
        `CRON_SECRET is too short (minimum ${MIN_CRON_SECRET_LENGTH} characters recommended for security)`,
    };
  }

  return { valid: true };
}

/**
 * Validate email provider-specific environment variables
 */
export function validateEmailProviderVars(
  provider: EmailProviderType,
): ValidationResult {
  const errors: string[] = [];

  if (provider === "sendgrid") {
    const apiKey = process.env.SENDGRID_API_KEY?.trim();
    const adminEmail = process.env.SENDGRID_ADMIN_EMAIL?.trim();

    if (!apiKey) {
      errors.push("SENDGRID_API_KEY is required for SendGrid provider");
    }

    if (!adminEmail) {
      errors.push("SENDGRID_ADMIN_EMAIL is required for SendGrid provider");
    }
  }

  // Mock provider requires no additional variables

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive email environment validation
 *
 * Validates all email-related environment variables and returns
 * detailed results including errors, warnings, and missing variables.
 */
export function validateEmailEnvironment(): EmailEnvironmentValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  // Determine environment
  const nodeEnv = process.env.NODE_ENV || "development";
  const environment = (nodeEnv === "production"
    ? "production"
    : nodeEnv === "test"
    ? "test"
    : "development") as "production" | "development" | "test";

  // Determine provider
  const envProvider = process.env.EMAIL_PROVIDER?.toLowerCase() as
    | EmailProviderType
    | undefined;
  const isDevelopment = environment === "development";

  let provider: EmailProviderType;

  if (envProvider) {
    provider = envProvider;
  } else {
    provider = isDevelopment ? "mock" : "sendgrid";
    warnings.push(
      `EMAIL_PROVIDER not set, defaulting to ${provider}`,
    );
  }

  // Validate CRON_SECRET (always required)
  const cronResult = validateCronSecret();
  if (!cronResult.valid) {
    errors.push(cronResult.error!);
    missingRequired.push("CRON_SECRET");
  } else if (cronResult.warning) {
    warnings.push(cronResult.warning);
  }

  // Validate provider-specific variables
  const providerResult = validateEmailProviderVars(provider);
  if (!providerResult.valid && providerResult.errors) {
    errors.push(...providerResult.errors);

    // Track missing required vars
    providerResult.errors.forEach((error) => {
      if (error.includes("SENDGRID_API_KEY")) {
        missingRequired.push("SENDGRID_API_KEY");
      }
      if (error.includes("SENDGRID_ADMIN_EMAIL")) {
        missingRequired.push("SENDGRID_ADMIN_EMAIL");
      }
    });
  }

  // Check optional variables and warn about defaults
  if (provider === "sendgrid") {
    const senderName = process.env.SENDGRID_SENDER_NAME?.trim();
    if (!senderName) {
      warnings.push(
        `SENDGRID_SENDER_NAME not set, using default: ${EMAIL_ENV_DEFAULTS.SENDGRID_SENDER_NAME}`,
      );
      missingOptional.push("SENDGRID_SENDER_NAME");
    }
  }

  const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL?.trim();
  if (!adminAlertEmail) {
    warnings.push(
      `ADMIN_ALERT_EMAIL not set, using default: ${EMAIL_ENV_DEFAULTS.ADMIN_ALERT_EMAIL}`,
    );
    missingOptional.push("ADMIN_ALERT_EMAIL");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    environment,
    provider,
    missingRequired,
    missingOptional,
  };
}

/**
 * Get comprehensive email configuration status
 *
 * Returns detailed status of email configuration for runtime checks
 * and debugging. Useful for health checks and startup validation.
 */
export function getEmailConfigurationStatus(): EmailConfigStatus {
  const validation = validateEmailEnvironment();
  const provider = validation.provider;

  // Collect configured variables
  const configuredVars: string[] = [];
  const requiredVars = getRequiredEmailVars(provider);
  const allVars = [
    ...requiredVars,
    ...getOptionalEmailVars(provider),
  ];

  allVars.forEach((varName) => {
    const value = process.env[varName]?.trim();
    if (value) {
      configuredVars.push(varName);
    }
  });

  // Collect defaults being used
  const defaults: Record<string, string> = {};
  validation.missingOptional.forEach((varName) => {
    if (varName === "SENDGRID_SENDER_NAME") {
      defaults[varName] = EMAIL_ENV_DEFAULTS.SENDGRID_SENDER_NAME;
    } else if (varName === "ADMIN_ALERT_EMAIL") {
      defaults[varName] = EMAIL_ENV_DEFAULTS.ADMIN_ALERT_EMAIL;
    }
  });

  // Generate remediation message if not ready
  let remediation: string | undefined;
  if (!validation.valid) {
    const missingVarsList = validation.missingRequired.join(", ");
    remediation =
      `Email configuration incomplete. Missing required variables: ${missingVarsList}. ` +
      `Please set these environment variables and restart the application. ` +
      `See docs/email-environment-setup.md for configuration guide.`;
  }

  return {
    ready: validation.valid,
    provider: validation.provider,
    environment: validation.environment,
    hasRequiredVars: validation.missingRequired.length === 0,
    cronSecretValid: !validation.missingRequired.includes("CRON_SECRET"),
    configuredVars,
    missingVars: validation.missingRequired,
    defaults,
    remediation,
  };
}

/**
 * Validate email configuration at application startup
 *
 * Throws detailed error if configuration is invalid in production.
 * Logs warnings in development.
 */
export function validateEmailConfigAtStartup(): void {
  const validation = validateEmailEnvironment();
  const isProduction = validation.environment === "production";

  // Log warnings
  if (validation.warnings.length > 0) {
    console.warn(
      "[EmailConfig] Configuration warnings:",
      validation.warnings,
    );
  }

  // Handle errors
  if (!validation.valid) {
    const errorMessage = [
      "[EmailConfig] Email configuration validation failed:",
      ...validation.errors.map((err) => `  - ${err}`),
      "",
      `Environment: ${validation.environment}`,
      `Provider: ${validation.provider}`,
      "",
      "Required variables:",
      ...getRequiredEmailVars(validation.provider).map((v) => `  - ${v}`),
      "",
      "See docs/email-environment-setup.md for configuration guide.",
    ].join("\n");

    if (isProduction) {
      throw new Error(errorMessage);
    } else {
      console.error(errorMessage);
    }
  } else {
    console.log(
      `[EmailConfig] Email configuration valid (${validation.provider} provider)`,
    );
  }
}
