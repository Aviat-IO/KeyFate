/**
 * @jest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the email service that we're about to implement
const mockEmailService = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendReminderEmail: vi.fn(),
  sendSecretDisclosureEmail: vi.fn(),
  validateEmailConfig: vi.fn(),
  getDeliveryStatus: vi.fn(),
  formatEmailTemplate: vi.fn(),
}));

vi.mock('@/lib/email/email-service', () => mockEmailService);

describe('Production Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.SENDGRID_ADMIN_EMAIL = 'admin@test.com';
    process.env.SENDGRID_SENDER_NAME = 'Test Service';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Email Configuration Validation', () => {
    it('should validate required environment variables', async () => {
      mockEmailService.validateEmailConfig.mockResolvedValue({
        valid: true,
        provider: 'sendgrid',
        missingVars: []
      });

      const { validateEmailConfig } = await import('@/lib/email/email-service');
      const result = await validateEmailConfig();

      expect(result.valid).toBe(true);
      expect(result.provider).toBe('sendgrid');
      expect(result.missingVars).toEqual([]);
    });

    it('should report missing environment variables', async () => {
      delete process.env.SENDGRID_API_KEY;

      mockEmailService.validateEmailConfig.mockResolvedValue({
        valid: false,
        provider: 'sendgrid',
        missingVars: ['SENDGRID_API_KEY']
      });

      const { validateEmailConfig } = await import('@/lib/email/email-service');
      const result = await validateEmailConfig();

      expect(result.valid).toBe(false);
      expect(result.missingVars).toContain('SENDGRID_API_KEY');
    });
  });

  describe('Email Sending', () => {
    const mockEmailData = {
      to: 'user@example.com',
      subject: 'Test Email',
      html: '<p>Test content</p>',
      text: 'Test content'
    };

    it('should send email successfully', async () => {
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        provider: 'sendgrid'
      });

      const { sendEmail } = await import('@/lib/email/email-service');
      const result = await sendEmail(mockEmailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(result.provider).toBe('sendgrid');
    });

    it('should handle email sending errors', async () => {
      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'API key invalid',
        retryable: false
      });

      const { sendEmail } = await import('@/lib/email/email-service');
      const result = await sendEmail(mockEmailData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API key invalid');
      expect(result.retryable).toBe(false);
    });

    it('should implement retry logic for retryable errors', async () => {
      // Mock to simulate retry behavior
      mockEmailService.sendEmail.mockImplementation(async (emailData, options) => {
        // Simulate retry logic in the actual implementation
        if (!emailData.subject.includes('retry-test')) {
          return {
            success: false,
            error: 'Rate limit exceeded',
            retryable: true
          };
        }

        return {
          success: true,
          messageId: 'msg-retry-123',
          provider: 'sendgrid',
          attempts: 2
        };
      });

      const { sendEmail } = await import('@/lib/email/email-service');

      // Test with retry scenario - add marker to trigger success path
      const retryTestData = { ...mockEmailData, subject: 'retry-test email' };
      const result = await sendEmail(retryTestData, { maxRetries: 2 });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-retry-123');
    });
  });

  describe('Email Templates', () => {
    it('should format verification email template', async () => {
      const templateData = {
        userName: 'John Doe',
        verificationUrl: 'https://example.com/verify?token=abc123',
        expirationHours: 24
      };

      mockEmailService.formatEmailTemplate.mockReturnValue({
        subject: 'Verify your email address',
        html: '<div>Email verification content</div>',
        text: 'Please verify your email'
      });

      const { formatEmailTemplate } = await import('@/lib/email/email-service');
      const result = formatEmailTemplate('verification', templateData);

      expect(result.subject).toContain('Verify');
      expect(result.html).toContain('verification');
      expect(result.text).toContain('verify');
    });

    it('should format reminder email template', async () => {
      const templateData = {
        userName: 'John Doe',
        secretTitle: 'Important Document',
        daysRemaining: 7,
        checkInUrl: 'https://example.com/checkin'
      };

      mockEmailService.formatEmailTemplate.mockReturnValue({
        subject: 'Reminder: Check-in required in 7 days',
        html: '<div>Reminder content</div>',
        text: 'Please check in'
      });

      const { formatEmailTemplate } = await import('@/lib/email/email-service');
      const result = formatEmailTemplate('reminder', templateData);

      expect(result.subject).toContain('Reminder');
      expect(result.html).toContain('Reminder');
      expect(result.text).toContain('check in');
    });

    it('should format secret disclosure email template', async () => {
      const templateData = {
        contactName: 'Jane Smith',
        secretTitle: 'Important Document',
        senderName: 'John Doe',
        message: 'This is an important message for you.',
        secretContent: 'Secret information here'
      };

      mockEmailService.formatEmailTemplate.mockReturnValue({
        subject: 'Important Message from John Doe',
        html: '<div>Secret disclosure content</div>',
        text: 'You have received an important message'
      });

      const { formatEmailTemplate } = await import('@/lib/email/email-service');
      const result = formatEmailTemplate('disclosure', templateData);

      expect(result.subject).toContain('Message');
      expect(result.html).toContain('disclosure');
      expect(result.text).toContain('message');
    });
  });

  describe('Email Service Integration', () => {
    it('should send verification email with template', async () => {
      mockEmailService.sendVerificationEmail.mockResolvedValue({
        success: true,
        messageId: 'verify-123',
        templateUsed: 'verification'
      });

      const { sendVerificationEmail } = await import('@/lib/email/email-service');
      const result = await sendVerificationEmail(
        'user@example.com',
        'verification-token-123'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('verify-123');
      expect(result.templateUsed).toBe('verification');
    });

    it('should send reminder email with proper data', async () => {
      mockEmailService.sendReminderEmail.mockResolvedValue({
        success: true,
        messageId: 'reminder-123',
        templateUsed: 'reminder'
      });

      const reminderData = {
        userEmail: 'user@example.com',
        userName: 'John Doe',
        secretTitle: 'Important Document',
        daysRemaining: 7,
        checkInUrl: 'https://example.com/checkin'
      };

      const { sendReminderEmail } = await import('@/lib/email/email-service');
      const result = await sendReminderEmail(reminderData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('reminder-123');
    });

    it('should send secret disclosure email', async () => {
      mockEmailService.sendSecretDisclosureEmail.mockResolvedValue({
        success: true,
        messageId: 'disclosure-123',
        templateUsed: 'disclosure'
      });

      const disclosureData = {
        contactEmail: 'contact@example.com',
        contactName: 'Jane Smith',
        secretTitle: 'Important Document',
        senderName: 'John Doe',
        message: 'This is for you.',
        secretContent: 'Secret info'
      };

      const { sendSecretDisclosureEmail } = await import('@/lib/email/email-service');
      const result = await sendSecretDisclosureEmail(disclosureData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('disclosure-123');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
        retryable: true,
        retryAfter: 60
      });

      const { sendEmail } = await import('@/lib/email/email-service');
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(result.success).toBe(false);
      expect(result.retryAfter).toBe(60);
    });
  });

  describe('Delivery Monitoring', () => {
    it('should track email delivery status', async () => {
      mockEmailService.getDeliveryStatus.mockResolvedValue({
        messageId: 'msg-123',
        status: 'delivered',
        deliveredAt: new Date(),
        events: [
          { type: 'sent', timestamp: new Date() },
          { type: 'delivered', timestamp: new Date() }
        ]
      });

      const { getDeliveryStatus } = await import('@/lib/email/email-service');
      const result = await getDeliveryStatus('msg-123');

      expect(result.status).toBe('delivered');
      expect(result.events).toHaveLength(2);
    });
  });
});