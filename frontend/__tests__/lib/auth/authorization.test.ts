/**
 * Authorization Module Unit Tests
 *
 * Test-Driven Development approach for application-level authorization
 * Tests written BEFORE implementation to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('next-auth/next');
vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn()
}));
vi.mock('@/lib/auth-config', () => ({
  authConfig: {}
}));
vi.mock('@/lib/db/schema', () => ({
  secrets: {},
  checkInTokens: {}
}));

import { validateSecretOwnership, validateUserAccess, withAuthorization, getUserFromSession } from '@/lib/auth/authorization';
import { getServerSession } from 'next-auth/next';
import { getDatabase } from '@/lib/db/drizzle';
import { secrets } from '@/lib/db/schema';

const mockGetServerSession = vi.mocked(getServerSession);
const mockGetDatabase = vi.mocked(getDatabase);

describe('Authorization Module - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserFromSession', () => {
    it('should return user from valid session', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User'
        }
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const user = await getUserFromSession();

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com'
      });
    });

    it('should return null when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const user = await getUserFromSession();

      expect(user).toBeNull();
    });

    it('should return null when session missing user data', async () => {
      mockGetServerSession.mockResolvedValue({ user: null } as any);

      const user = await getUserFromSession();

      expect(user).toBeNull();
    });

    it('should return null when session missing user id', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any);

      const user = await getUserFromSession();

      expect(user).toBeNull();
    });
  });

  describe('validateSecretOwnership', () => {
    it('should return true when user owns the secret', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'secret-123', userId: 'user-123' }])
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const isOwner = await validateSecretOwnership('secret-123', 'user-123');

      expect(isOwner).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(secrets);
    });

    it('should return false when user does not own the secret', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const isOwner = await validateSecretOwnership('secret-123', 'user-456');

      expect(isOwner).toBe(false);
    });

    it('should return false when secret does not exist', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const isOwner = await validateSecretOwnership('nonexistent-secret', 'user-123');

      expect(isOwner).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const isOwner = await validateSecretOwnership('secret-123', 'user-123');

      expect(isOwner).toBe(false);
    });
  });

  describe('validateUserAccess', () => {
    it('should return true when user has access to check-in token', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'token-123' }])
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const hasAccess = await validateUserAccess('token-123', 'user-123');

      expect(hasAccess).toBe(true);
    });

    it('should return false when user does not have access', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const hasAccess = await validateUserAccess('token-123', 'user-456');

      expect(hasAccess).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const hasAccess = await validateUserAccess('token-123', 'user-123');

      expect(hasAccess).toBe(false);
    });
  });

  describe('withAuthorization - Higher-Order Function', () => {
    it('should execute handler when user is authorized', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'secret-123', userId: 'user-123' }])
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const mockHandler = vi.fn().mockResolvedValue({ success: true });

      const authorizedHandler = withAuthorization(mockHandler, {
        validateOwnership: true,
        resourceIdParam: 'secretId'
      });

      const mockRequest = {} as any;
      const mockParams = { secretId: 'secret-123' };

      const result = await authorizedHandler(mockRequest, mockParams);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockParams, mockSession.user);
      expect(result).toEqual({ success: true });
    });

    it('should return 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const mockHandler = vi.fn();

      const authorizedHandler = withAuthorization(mockHandler, {
        validateOwnership: true,
        resourceIdParam: 'secretId'
      });

      const mockRequest = {} as any;
      const mockParams = { secretId: 'secret-123' };

      const result = await authorizedHandler(mockRequest, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toHaveProperty('status', 401);
    });

    it('should return 403 when user not authorized', async () => {
      const mockSession = {
        user: { id: 'user-456', email: 'other@example.com' }
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]) // User does not own the secret
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const mockHandler = vi.fn();

      const authorizedHandler = withAuthorization(mockHandler, {
        validateOwnership: true,
        resourceIdParam: 'secretId'
      });

      const mockRequest = {} as any;
      const mockParams = { secretId: 'secret-123' };

      const result = await authorizedHandler(mockRequest, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toHaveProperty('status', 403);
    });

    it('should work without ownership validation', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' }
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const mockHandler = vi.fn().mockResolvedValue({ success: true });

      const authorizedHandler = withAuthorization(mockHandler, {
        validateOwnership: false
      });

      const mockRequest = {} as any;
      const mockParams = {};

      const result = await authorizedHandler(mockRequest, mockParams);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockParams, mockSession.user);
      expect(result).toEqual({ success: true });
    });

    it('should log authorization failures for security monitoring', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockSession = {
        user: { id: 'user-456', email: 'attacker@example.com' }
      };

      mockGetServerSession.mockResolvedValue(mockSession as any);

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };

      mockGetDatabase.mockResolvedValue(mockDb as any);

      const mockHandler = vi.fn();

      const authorizedHandler = withAuthorization(mockHandler, {
        validateOwnership: true,
        resourceIdParam: 'secretId'
      });

      const mockRequest = {} as any;
      const mockParams = { secretId: 'secret-123' };

      await authorizedHandler(mockRequest, mockParams);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Authorization] Unauthorized access attempt'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });
});
