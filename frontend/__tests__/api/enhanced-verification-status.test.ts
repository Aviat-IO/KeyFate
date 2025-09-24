import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn()
  }
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth/config', () => ({
  authOptions: {}
}));

describe('Enhanced Verification Status API', () => {
  let mockDb: any;
  let mockGetServerSession: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { db } = await import('@/lib/db/drizzle');
    const { getServerSession } = await import('next-auth');

    mockDb = db as any;
    mockGetServerSession = getServerSession as any;

    // Setup default mock chain
    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([]);

    mockDb.select.mockImplementation(() => ({
      from: mockFrom.mockImplementation(() => ({
        where: mockWhere.mockImplementation(() => ({
          limit: mockLimit
        }))
      }))
    }));
  });

  describe('GET /api/auth/verification-status', () => {
    it('should return verification status for authenticated user', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com'
        }
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      };

      mockGetServerSession.mockResolvedValue(mockSession);
      mockDb.select().from().where().limit.mockResolvedValue([mockUser]);

      const request = new Request('http://localhost:3000/api/auth/verification-status');
      const { GET } = await import('@/app/api/auth/verification-status/route');

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('user@example.com');
    });

    it('should return unverified status for unverified user', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com'
        }
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: null
      };

      mockGetServerSession.mockResolvedValue(mockSession);
      mockDb.select().from().where().limit.mockResolvedValue([mockUser]);

      const request = new Request('http://localhost:3000/api/auth/verification-status');
      const { GET } = await import('@/app/api/auth/verification-status/route');

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(false);
      expect(result.user.emailVerified).toBe(null);
    });

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/auth/verification-status');
      const { GET } = await import('@/app/api/auth/verification-status/route');

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should return 404 when user not found in database', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com'
        }
      };

      mockGetServerSession.mockResolvedValue(mockSession);
      mockDb.select().from().where().limit.mockResolvedValue([]);

      const request = new Request('http://localhost:3000/api/auth/verification-status');
      const { GET } = await import('@/app/api/auth/verification-status/route');

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should include additional verification metadata', async () => {
      // This test will drive implementation of enhanced status information
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com'
        }
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date('2024-01-01'),
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2024-01-01')
      };

      mockGetServerSession.mockResolvedValue(mockSession);
      mockDb.select().from().where().limit.mockResolvedValue([mockUser]);

      const request = new Request('http://localhost:3000/api/auth/verification-status');
      const { GET } = await import('@/app/api/auth/verification-status/route');

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user.createdAt).toBeDefined();
      expect(result.verificationDate).toBeDefined();
      expect(result.accountAge).toBeGreaterThan(0);
    });

    it('should handle database connection errors gracefully', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com'
        }
      };

      mockGetServerSession.mockResolvedValue(mockSession);
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new Request('http://localhost:3000/api/auth/verification-status');
      const { GET } = await import('@/app/api/auth/verification-status/route');

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('unexpected error');
    });
  });
});