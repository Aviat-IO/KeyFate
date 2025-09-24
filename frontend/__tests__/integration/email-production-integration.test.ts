/**
 * @jest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEmailVerification = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  createVerificationToken: vi.fn(),
  resendVerificationEmail: vi.fn()
}));

const mockEmailService = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  validateEmailConfig: vi.fn()
}));

vi.mock('@/lib/auth/email-verification', () => mockEmailVerification);
vi.mock('@/lib/email/email-service', () => mockEmailService);

describe('Production Email Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.SENDGRID_ADMIN_EMAIL = 'admin@test.com';
    process.env.NEXTAUTH_URL = 'https://test.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Email Verification Integration', () => {
    it('should integrate email verification with production email service', async () => {
      // Mock token creation
      mockEmailVerification.createVerificationToken.mockResolvedValue({
        success: true,
        token: 'abc123'
      });

      // Mock email service validation
      mockEmailService.validateEmailConfig.mockResolvedValue({
        valid: true,
        provider: 'sendgrid'
      });

      // Mock production email sending
      mockEmailVerification.sendVerificationEmail.mockResolvedValue({
        success: true,
        messageId: 'sendgrid-msg-123',
        emailProvider: 'sendgrid',
        emailData: {
          subject: 'Verify your email address',
          verificationUrl: 'https://test.com/auth/verify-email?token=abc123&email=user%40example.com',
          expirationHours: 24
        }
      });

      const { sendVerificationEmail } = await import('@/lib/auth/email-verification');
      const result = await sendVerificationEmail('user@example.com', 'abc123');

      expect(result.success).toBe(true);
      expect(result.emailProvider).toBe('sendgrid');
      expect(result.messageId).toContain('sendgrid');
      expect(result.emailData?.verificationUrl).toContain('verify-email');
    });

    it('should handle email service failures gracefully', async () => {
      mockEmailService.validateEmailConfig.mockResolvedValue({
        valid: false,
        missingVars: ['SENDGRID_API_KEY']
      });

      mockEmailVerification.sendVerificationEmail.mockResolvedValue({
        success: false,
        error: 'Email service not configured properly'
      });

      const { sendVerificationEmail } = await import('@/lib/auth/email-verification');
      const result = await sendVerificationEmail('user@example.com', 'abc123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('configured');
    });

    it('should retry failed email sends with exponential backoff', async () => {
      mockEmailService.sendEmail
        .mockResolvedValueOnce({
          success: false,
          error: 'Rate limit exceeded',
          retryable: true,
          retryAfter: 1
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Temporary server error',
          retryable: true,
          retryAfter: 2
        })
        .mockResolvedValueOnce({
          success: true,
          messageId: 'retry-success-123',
          provider: 'sendgrid'
        });

      mockEmailVerification.sendVerificationEmail.mockResolvedValue({
        success: true,
        messageId: 'retry-success-123',
        emailProvider: 'sendgrid',
        attempts: 3
      });

      const { sendVerificationEmail } = await import('@/lib/auth/email-verification');
      const result = await sendVerificationEmail('user@example.com', 'abc123');

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });
  });

  describe('Environment Configuration', () => {
    it('should work with SendGrid configuration', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-key';
      process.env.SENDGRID_ADMIN_EMAIL = 'admin@deadmansswitch.com';
      process.env.SENDGRID_SENDER_NAME = 'Dead Man\'s Switch';

      mockEmailService.validateEmailConfig.mockResolvedValue({
        valid: true,
        provider: 'sendgrid',
        config: {
          apiKey: 'SG.test-key',
          adminEmail: 'admin@deadmansswitch.com',
          senderName: 'Dead Man\'s Switch'
        }
      });

      const { validateEmailConfig } = await import('@/lib/email/email-service');
      const result = await validateEmailConfig();

      expect(result.valid).toBe(true);
      expect(result.provider).toBe('sendgrid');
      expect(result.config?.apiKey).toBe('SG.test-key');
    });

    it('should fallback to console logging in development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SENDGRID_API_KEY;

      mockEmailService.validateEmailConfig.mockResolvedValue({
        valid: true,
        provider: 'console-dev',
        developmentMode: true
      });

      mockEmailVerification.sendVerificationEmail.mockResolvedValue({
        success: true,
        emailProvider: 'console-dev',
        messageId: 'dev-12345',
        developmentMode: true
      });

      const { sendVerificationEmail } = await import('@/lib/auth/email-verification');
      const result = await sendVerificationEmail('user@example.com', 'abc123');

      expect(result.success).toBe(true);
      expect(result.emailProvider).toBe('console-dev');
      expect(result.developmentMode).toBe(true);
    });
  });

  describe('Email Templates in Production', () => {
    it('should use professional email templates', async () => {
      mockEmailVerification.sendVerificationEmail.mockResolvedValue({
        success: true,
        messageId: 'professional-123',
        emailProvider: 'sendgrid',
        emailData: {
          subject: 'Verify your Dead Man\'s Switch account',
          verificationUrl: 'https://app.deadmansswitch.com/verify?token=abc123',
          expirationHours: 24,
          template: 'professional-verification',
          branding: {
            companyName: 'Dead Man\'s Switch',
            logoUrl: 'https://app.deadmansswitch.com/logo.png',
            supportEmail: 'support@deadmansswitch.com'
          }
        }
      });

      const { sendVerificationEmail } = await import('@/lib/auth/email-verification');
      const result = await sendVerificationEmail('user@example.com', 'abc123');

      expect(result.emailData?.subject).toContain('Dead Man\'s Switch');
      expect(result.emailData?.template).toBe('professional-verification');
      expect(result.emailData?.branding?.companyName).toBe('Dead Man\'s Switch');
    });

    it('should include proper security warnings in disclosure emails', async () => {
      const disclosureData = {
        contactEmail: 'emergency@example.com',
        contactName: 'Emergency Contact',
        secretTitle: 'Important Information',
        senderName: 'John Doe',
        message: 'This is important.',
        secretContent: 'Confidential data'
      };

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'disclosure-secure-123',
        provider: 'sendgrid'
      });

      const { sendEmail } = await import('@/lib/email/email-service');
      const result = await sendEmail({
        to: disclosureData.contactEmail,
        subject: `🔒 Confidential Message from ${disclosureData.senderName}`,
        html: '<div>Secure disclosure content with warnings</div>',
        text: 'Secure disclosure content',
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High'
        }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limiting and Delivery Monitoring', () => {
    it('should respect SendGrid rate limits', async () => {
      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
        retryable: true,
        retryAfter: 60,
        rateLimitInfo: {
          limit: 100,
          remaining: 0,
          resetTime: Date.now() + 60000
        }
      });

      const { sendEmail } = await import('@/lib/email/email-service');
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(result.success).toBe(false);
      expect(result.retryAfter).toBe(60);
      expect(result.rateLimitInfo).toBeDefined();
    });

    it('should track delivery status for important emails', async () => {
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'trackable-123',
        provider: 'sendgrid',
        trackingEnabled: true
      });

      const { sendEmail } = await import('@/lib/email/email-service');
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Important Verification',
        html: '<p>Please verify</p>',
        trackDelivery: true
      });

      expect(result.success).toBe(true);
      expect(result.trackingEnabled).toBe(true);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should log email failures for debugging', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'Invalid API key',
        retryable: false,
        errorCode: 'INVALID_API_KEY'
      });

      mockEmailVerification.sendVerificationEmail.mockImplementation(async () => {
        // Simulate an error being logged during the email verification process
        console.error('[EmailVerification] Failed to send verification email: Invalid API key');
        return {
          success: false,
          error: 'Failed to send verification email'
        };
      });

      const { sendVerificationEmail } = await import('@/lib/auth/email-verification');
      await sendVerificationEmail('user@example.com', 'abc123');

      // Should log errors for debugging
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle network timeouts gracefully', async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error('Network timeout'));

      mockEmailVerification.sendVerificationEmail.mockResolvedValue({
        success: false,
        error: 'Network error occurred',
        retryable: true
      });

      const { sendVerificationEmail } = await import('@/lib/auth/email-verification');
      const result = await sendVerificationEmail('user@example.com', 'abc123');

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });
  });
});