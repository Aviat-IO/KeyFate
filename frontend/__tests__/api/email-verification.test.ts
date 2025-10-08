import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Create mock database instance
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
}

// Mock the database
vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
  db: mockDb, // Keep for backward compatibility
}));

// Mock the schema
vi.mock('@/lib/db/schema', () => ({
  users: {
    email: 'email',
    id: 'id'
  },
  verificationTokens: {
    identifier: 'identifier',
    token: 'token',
    expires: 'expires'
  }
}));

// Mock rate limiting
vi.mock('@/lib/auth/rate-limiting', () => ({
  checkRateLimit: vi.fn()
}));

describe('Email Verification API Tests', () => {
  let mockCheckRateLimit: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { checkRateLimit } = await import('@/lib/auth/rate-limiting');
    mockCheckRateLimit = checkRateLimit as any;

    // Default rate limit allows requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Setup default mock chain
    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockInsert = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockResolvedValue([]);
    const mockUpdate = vi.fn().mockReturnThis();
    const mockSet = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockDelete = vi.fn().mockReturnThis();

    mockDb.select.mockImplementation(() => ({
      from: mockFrom.mockImplementation(() => ({
        where: mockWhere.mockImplementation(() => ({
          limit: mockLimit
        }))
      }))
    }));

    mockDb.insert.mockImplementation(() => ({
      values: mockValues
    }));

    mockDb.update.mockImplementation(() => ({
      set: mockSet.mockImplementation(() => ({
        where: mockWhere.mockImplementation(() => ({
          returning: mockReturning
        }))
      }))
    }));

    mockDb.delete.mockImplementation(() => ({
      where: mockWhere
    }));
  });

  describe('Verify Email NextAuth API', () => {
    it('should verify email with valid token', async () => {
      // Arrange: Mock valid verification token
      const mockVerificationToken = {
        identifier: 'user@example.com',
        token: 'valid-token-123',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // Future date
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      };

      // Mock database responses
      mockDb.select().from().where().limit.mockResolvedValueOnce([mockVerificationToken]);
      mockDb.update().set().where().returning.mockResolvedValueOnce([mockUser]);
      mockDb.delete().where.mockResolvedValueOnce(undefined);

      const request = new Request('http://localhost:3000/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-token-123',
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/verify-email-nextauth/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Debug logging
      if (response.status !== 200) {
        console.log('Unexpected response status:', response.status);
        console.log('Response body:', result);
      }

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.message).toBe('Email successfully verified');
    });

    it('should reject invalid token', async () => {
      // Arrange: Mock no verification token found
      mockDb.select().from().where().limit.mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'invalid-token',
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/verify-email-nextauth/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired verification token');
    });

    it('should reject expired token', async () => {
      // Arrange: Mock expired verification token
      const mockExpiredToken = {
        identifier: 'user@example.com',
        token: 'expired-token-123',
        expires: new Date(Date.now() - 24 * 60 * 60 * 1000) // Past date
      };

      mockDb.select().from().where().limit.mockResolvedValueOnce([mockExpiredToken]);
      mockDb.delete().where.mockResolvedValueOnce(undefined);

      const request = new Request('http://localhost:3000/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'expired-token-123',
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/verify-email-nextauth/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Verification token has expired');
    });

    it('should handle invalid request data', async () => {
      const request = new Request('http://localhost:3000/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing token and invalid email
          email: 'invalid-email'
        })
      });

      const { POST } = await import('@/app/api/auth/verify-email-nextauth/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid request data');
      expect(result.details).toBeDefined();
    });
  });

  describe('Resend Verification API', () => {
    it('should resend verification email successfully', async () => {
      // Mock user exists and is unverified
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: null
      };

      mockDb.select().from().where().limit.mockResolvedValueOnce([mockUser]);
      mockDb.delete().where.mockResolvedValueOnce(undefined);
      mockDb.insert().values.mockResolvedValueOnce(undefined);

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Verification email sent successfully');
    });

    it('should reject invalid email format', async () => {
      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });

    it('should handle user not found', async () => {
      // Mock user not found
      mockDb.select().from().where().limit.mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });

    it('should handle already verified user', async () => {
      // Mock user already verified
      const mockVerifiedUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      };

      mockDb.select().from().where().limit.mockResolvedValueOnce([mockVerifiedUser]);

      const request = new Request('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com'
        })
      });

      const { POST } = await import('@/app/api/auth/resend-verification/route');

      // Act
      const response = await POST(request as any);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already verified');
    });
  });
});