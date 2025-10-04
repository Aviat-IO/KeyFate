/**
 * Email Provider Interface
 *
 * Defines the contract that all email providers must implement.
 * This abstraction allows swapping between SendGrid, Mock, and future providers.
 */

/**
 * Email data structure for sending emails
 */
export interface EmailData {
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

/**
 * Result of email sending operation
 */
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

/**
 * Email Provider Interface
 *
 * All email providers must implement this interface to ensure
 * consistent behavior and easy provider swapping.
 */
export interface EmailProvider {
  /**
   * Send an email using the provider's infrastructure
   *
   * @param data - Email data including recipient, subject, and content
   * @returns Promise resolving to email sending result
   */
  sendEmail(data: EmailData): Promise<EmailResult>;

  /**
   * Validate provider configuration
   *
   * Checks that all required environment variables and settings
   * are properly configured for this provider.
   *
   * @returns Promise resolving to boolean indicating valid configuration
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get the provider name
   *
   * Used for logging, debugging, and result attribution.
   *
   * @returns Provider name (e.g., "sendgrid", "mock")
   */
  getProviderName(): string;
}
