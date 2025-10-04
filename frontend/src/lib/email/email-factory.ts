/**
 * Email Provider Factory
 *
 * Factory pattern implementation for creating email provider instances
 * based on environment configuration. Supports SendGrid and Mock providers.
 */

import type { EmailProvider } from "./providers/EmailProvider";
import { SendGridAdapter } from "./providers/SendGridAdapter";
import { MockAdapter } from "./providers/MockAdapter";

/**
 * Supported email provider types
 */
export type EmailProviderType = "sendgrid" | "mock";

/**
 * Email provider factory function
 *
 * Creates and returns the appropriate email provider instance based on
 * the EMAIL_PROVIDER environment variable. Defaults to "mock" in development
 * and "sendgrid" in production if not specified.
 *
 * @returns Configured email provider instance
 * @throws Error if EMAIL_PROVIDER value is not supported
 */
export function getEmailProvider(): EmailProvider {
  // Read provider from environment, with smart defaults
  const envProvider = process.env.EMAIL_PROVIDER?.toLowerCase() as
    | EmailProviderType
    | undefined;
  const isDevelopment = process.env.NODE_ENV === "development";

  // Determine provider with fallback logic
  const providerType: EmailProviderType = envProvider ||
    (isDevelopment ? "mock" : "sendgrid");

  switch (providerType) {
    case "sendgrid":
      return new SendGridAdapter();

    case "mock":
      return new MockAdapter();

    default:
      throw new Error(
        `Unsupported email provider: ${providerType}. Supported providers: sendgrid, mock`,
      );
  }
}

/**
 * Validate EMAIL_PROVIDER environment variable
 *
 * Checks if the configured provider is supported without instantiating it.
 *
 * @returns Object with validation status and any error messages
 */
export function validateEmailProviderConfig(): {
  valid: boolean;
  provider: EmailProviderType;
  errors: string[];
} {
  const errors: string[] = [];
  const envProvider = process.env.EMAIL_PROVIDER?.toLowerCase();
  const isDevelopment = process.env.NODE_ENV === "development";

  // Determine provider
  const provider: EmailProviderType = (envProvider as EmailProviderType) ||
    (isDevelopment ? "mock" : "sendgrid");

  // Validate provider type
  const supportedProviders: EmailProviderType[] = ["sendgrid", "mock"];
  if (!supportedProviders.includes(provider)) {
    errors.push(
      `Unsupported EMAIL_PROVIDER: ${provider}. Supported: ${
        supportedProviders.join(", ")
      }`,
    );
  }

  // Provider-specific validation
  if (provider === "sendgrid") {
    if (!process.env.SENDGRID_API_KEY) {
      errors.push("SENDGRID_API_KEY environment variable is required");
    }
    if (!process.env.SENDGRID_ADMIN_EMAIL) {
      errors.push("SENDGRID_ADMIN_EMAIL environment variable is required");
    }
  }

  return {
    valid: errors.length === 0,
    provider,
    errors,
  };
}
