import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/verification-status/route';
import { POST as verifyEmailPOST } from '@/app/api/auth/verify-email/route';
import { POST as resendVerificationPOST } from '@/app/api/auth/resend-verification/route';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db/drizzle';
import { users, verificationTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Create mock database instance
const mockDbInstance = {
  select: vi.fn(),
  delete: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}

// Mock database
vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDbInstance)),
  db: mockDbInstance, // Keep for backward compatibility
}));

// Mock auth config
vi.mock('@/lib/auth/config', () => ({
  authOptions: {},
}));

const mockGetServerSession = vi.mocked(getServerSession);
const mockDb = mockDbInstance as any;

describe('Email Verification NextAuth Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain for database operations
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockReturnThis();

    mockDb.select.mockReturnValue({
      from: mockFrom,
    } as any);

    mockFrom.mockReturnValue({
      where: mockWhere,
    } as any);

    mockWhere.mockReturnValue({
      limit: mockLimit,
    } as any);

    mockDb.insert.mockReturnValue({
      values: mockValues,
    } as any);

    mockDb.delete.mockReturnValue({
      where: mockWhere,
    } as any);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: mockWhere,
    } as any);
  });

  describe('GET /api/auth/verification-status', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/auth/verification-status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        success: false,
        error: 'Not authenticated'
      });
    });

    it('should return verification status for authenticated user', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: new Date('2023-01-01')
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      // Mock database query chain
      const mockLimit = vi.fn().mockResolvedValue([mockUser]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest('http://localhost/api/auth/verification-status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        isVerified: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: '2023-01-01T00:00:00.000Z'
        }
      });
    });

    it('should return unverified status for user without email verification', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: null
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const mockLimit = vi.fn().mockResolvedValue([mockUser]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest('http://localhost/api/auth/verification-status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        isVerified: false,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: null
        }
      });
    });

    it('should return 404 when user is not found in database', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest('http://localhost/api/auth/verification-status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        success: false,
        error: 'User not found'
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const mockLimit = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest('http://localhost/api/auth/verification-status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'An unexpected error occurred while checking verification status'
      });
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email token and update user verification status', async () => {
      const mockToken = {
        identifier: 'test@example.com',
        token: 'valid-token-123',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: null
      };

      // Mock token verification
      const mockLimitTokens = vi.fn().mockResolvedValue([mockToken]);
      const mockWhereTokens = vi.fn().mockReturnValue({ limit: mockLimitTokens });
      const mockFromTokens = vi.fn().mockReturnValue({ where: mockWhereTokens });

      // Mock user lookup
      const mockLimitUsers = vi.fn().mockResolvedValue([mockUser]);
      const mockWhereUsers = vi.fn().mockReturnValue({ limit: mockLimitUsers });
      const mockFromUsers = vi.fn().mockReturnValue({ where: mockWhereUsers });

      mockDb.select
        .mockReturnValueOnce({ from: mockFromTokens } as any)
        .mockReturnValueOnce({ from: mockFromUsers } as any);

      // Mock token deletion
      const mockWhereDelete = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: mockWhereDelete } as any);

      // Mock user update
      const mockSet = vi.fn().mockReturnThis();
      const mockWhereUpdate = vi.fn().mockResolvedValue(undefined);
      mockDb.update.mockReturnValue({
        set: mockSet,
        where: mockWhereUpdate
      } as any);

      const request = new NextRequest('http://localhost/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'valid-token-123'
        })
      });

      const response = await verifyEmailPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        verified: true,
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      });
    });

    it('should return 400 for invalid email format', async () => {
      const request = new NextRequest('http://localhost/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          token: 'some-token'
        })
      });

      const response = await verifyEmailPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Email and token are required');
    });

    it('should return 400 for missing token', async () => {
      const request = new NextRequest('http://localhost/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com'
        })
      });

      const response = await verifyEmailPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Email and token are required');
    });

    it('should return 400 for expired token', async () => {
      const expiredToken = {
        identifier: 'test@example.com',
        token: 'expired-token-123',
        expires: new Date(Date.now() - 1000) // Expired
      };

      const mockLimit = vi.fn().mockResolvedValue([expiredToken]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest('http://localhost/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'expired-token-123'
        })
      });

      const response = await verifyEmailPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: 'Verification token has expired'
      });
    });

    it('should return 400 for invalid token', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest('http://localhost/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'invalid-token'
        })
      });

      const response = await verifyEmailPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: 'Invalid or expired verification token'
      });
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should work without Supabase dependencies', async () => {
      const request = new NextRequest('http://localhost/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com'
        })
      });

      const response = await resendVerificationPOST(request);

      // This route should continue to work as it uses the email-verification service
      // which has been confirmed to use Drizzle ORM, not Supabase
      expect(response.status).toBeLessThan(500);
    });
  });
});