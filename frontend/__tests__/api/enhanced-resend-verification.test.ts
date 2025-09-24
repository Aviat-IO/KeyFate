import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth/email-verification', () => ({
  resendVerificationEmail: vi.fn()
}));

vi.mock('@/lib/auth/rate-limiting', () => ({
  checkRateLimit: vi.fn()
}));

describe('Enhanced Resend Verification API', () => {
  let mockResendVerificationEmail: any;
  let mockCheckRateLimit: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { resendVerificationEmail } = await import('@/lib/auth/email-verification');
    const { checkRateLimit } = await import('@/lib/auth/rate-limiting');

    mockResendVerificationEmail = resendVerificationEmail as any;
    mockCheckRateLimit = checkRateLimit as any;

    // Default rate limit allows requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetTime: new Date(Date.now() + 60 * 60 * 1000)
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email when rate limit allows', async () => {
      // Arrange
      mockResendVerificationEmail.mockResolvedValue({
        success: true
      });

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as NextRequest);
      const result = await response.json();

      // Assert
      expect(mockCheckRateLimit).toHaveBeenCalledWith('resend-verification', 'user@example.com');
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('user@example.com');
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Verification email sent successfully');
    });

    it('should block resend when rate limit exceeded', async () => {
      // Arrange
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 1800, // 30 minutes
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      });

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as NextRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(429);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many resend attempts');
      expect(result.retryAfter).toBe(1800);
      expect(response.headers.get('Retry-After')).toBe('1800');
      expect(mockResendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should include rate limit headers in responses', async () => {
      // Arrange
      mockResendVerificationEmail.mockResolvedValue({
        success: true
      });

      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 1,
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      });

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as NextRequest);

      // Assert
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('1');
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should handle email service failures gracefully', async () => {
      // Arrange
      mockResendVerificationEmail.mockResolvedValue({
        success: false,
        error: 'Email service temporarily unavailable'
      });

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as NextRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service temporarily unavailable');
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        '',
        'invalid-email',
        'user@',
        '@example.com',
        'user space@example.com',
        'user..double@example.com'
      ];

      for (const email of invalidEmails) {
        const request = new Request('http://localhost:3000/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const { POST } = await import('@/app/api/auth/resend-verification/route');

        // Act
        const response = await POST(request as NextRequest);
        const result = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid email address');
        expect(result.details).toBeDefined();
      }
    });

    it('should handle missing email field', async () => {
      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as NextRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });

    it('should log resend attempts for security monitoring', async () => {
      // Arrange
      mockResendVerificationEmail.mockResolvedValue({
        success: true
      });

      const consoleSpy = vi.spyOn(console, 'log');

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      await POST(request as NextRequest);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ResendVerification] Verification email sent for: user@example.com')
      );

      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as NextRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid request format');
    });

    it('should normalize email case for consistent rate limiting', async () => {
      // Arrange
      mockResendVerificationEmail.mockResolvedValue({
        success: true
      });

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'USER@EXAMPLE.COM'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      await POST(request as NextRequest);

      // Assert
      expect(mockCheckRateLimit).toHaveBeenCalledWith('resend-verification', 'user@example.com');
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('USER@EXAMPLE.COM');
    });
  });
});