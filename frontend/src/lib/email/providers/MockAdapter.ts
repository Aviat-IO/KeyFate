/**
 * Mock Email Provider
 *
 * Simulates email sending for testing and development.
 * Stores emails in memory and provides configurable failure scenarios.
 */
import type { EmailProvider, EmailData, EmailResult } from "./EmailProvider";

export class MockAdapter implements EmailProvider {
  private sentEmails: Array<EmailData & { messageId: string; timestamp: number }> = [];
  private simulateFailure = false;
  private simulateDelay = 0;
  private simulateRateLimit = false;

  async sendEmail(data: EmailData): Promise<EmailResult> {
    // Validate email data
    const validationError = this.validateEmailData(data);
    if (validationError) {
      return {
        success: false,
        error: validationError,
        provider: "mock",
        retryable: false,
      };
    }

    // Simulate network delay if configured
    if (this.simulateDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));
    }

    // Simulate rate limit if configured
    if (this.simulateRateLimit) {
      const retryAfter = 60; // 60 seconds
      return {
        success: false,
        error: "Mock rate limit exceeded",
        provider: "mock",
        retryable: true,
        retryAfter,
        rateLimitInfo: {
          limit: 100,
          remaining: 0,
          resetTime: Date.now() + retryAfter * 1000,
        },
      };
    }

    // Simulate failure if configured
    if (this.simulateFailure) {
      return {
        success: false,
        error: "Mock failure simulation",
        provider: "mock",
        retryable: true,
      };
    }

    // Generate mock message ID
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Store email in memory
    this.sentEmails.push({
      ...data,
      messageId,
      timestamp: Date.now(),
    });

    // Log to console in development mode
    if (process.env.NODE_ENV === "development") {
      console.log("Mock Email Sent:", {
        to: data.to,
        subject: data.subject,
        messageId,
        priority: data.priority || "normal",
      });
    }

    return {
      success: true,
      messageId,
      provider: "mock",
      trackingEnabled: data.trackDelivery ?? false,
    };
  }

  async validateConfig(): Promise<boolean> {
    // Mock adapter doesn't require configuration
    return true;
  }

  getProviderName(): string {
    return "mock";
  }

  /**
   * Get all emails sent during this session
   */
  getSentEmails(): Array<EmailData & { messageId: string; timestamp: number }> {
    return [...this.sentEmails];
  }

  /**
   * Clear all stored emails
   */
  clearSentEmails(): void {
    this.sentEmails = [];
  }

  /**
   * Configure failure simulation
   */
  setSimulateFailure(shouldFail: boolean): void {
    this.simulateFailure = shouldFail;
  }

  /**
   * Configure network delay simulation (in milliseconds)
   */
  setSimulateDelay(delayMs: number): void {
    this.simulateDelay = delayMs;
  }

  /**
   * Configure rate limit simulation
   */
  setSimulateRateLimit(shouldLimit: boolean): void {
    this.simulateRateLimit = shouldLimit;
  }

  /**
   * Validate email data
   */
  private validateEmailData(data: EmailData): string | null {
    if (!data.to || data.to.trim() === "") {
      return "Missing recipient email address";
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.to)) {
      return "Invalid email format";
    }

    if (!data.subject || data.subject.trim() === "") {
      return "Missing email subject";
    }

    if (!data.html || data.html.trim() === "") {
      return "Missing email content";
    }

    return null;
  }
}
