/**
 * TDD Tests for User Verification Service
 *
 * Tests the ensureUserExists and verifyUserExists functions
 * to ensure proper user creation and verification logic.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ensureUserExists, verifyUserExists } from '@/lib/auth/user-verification';

// Mock the database
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    returning: vi.fn()
  }
}));

vi.mock('@/lib/db/schema', () => ({
  users: {
    id: 'id',
    email: 'email'
  }
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn()
}));

import { db } from '@/lib/db/drizzle';

describe('User Verification Service', () => {
  const mockUserId = '103890241628354500674';
  const mockUserEmail = 'test@example.com';
  const mockUserName = 'Test User';

  const mockSession = {
    user: {
      id: mockUserId,
      email: mockUserEmail,
      name: mockUserName,
      image: null
    }
  };

  const mockDbUser = {
    id: mockUserId,
    email: mockUserEmail.toLowerCase(),
    name: mockUserName,
    image: null,
    emailVerified: new Date(),
    password: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureUserExists', () => {
    test('should return existing user when found by ID', async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([mockDbUser]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      (db.select as any).mockImplementation(mockSelect);

      // Act
      const result = await ensureUserExists(mockSession as any);

      // Assert
      expect(result.exists).toBe(true);
      expect(result.user).toEqual(mockDbUser);
      expect(result.created).toBeUndefined();
    });

    test('should create new user when not found', async () => {
      // Arrange
      // Mock user not found (empty array)
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      (db.select as any).mockImplementation(mockSelect);

      // Mock successful user creation
      const mockReturning = vi.fn().mockResolvedValue([mockDbUser]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      (db.insert as any).mockImplementation(mockInsert);

      // Act
      const result = await ensureUserExists(mockSession as any);

      // Assert
      expect(result.exists).toBe(false);
      expect(result.user).toEqual(mockDbUser);
      expect(result.created).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
    });

    test('should normalize email to lowercase', async () => {
      // Arrange
      const sessionWithCapsEmail = {
        user: {
          id: mockUserId,
          email: 'Test@EXAMPLE.COM',
          name: mockUserName
        }
      };

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      (db.select as any).mockImplementation(mockSelect);

      const mockReturning = vi.fn().mockResolvedValue([{
        ...mockDbUser,
        email: 'test@example.com'
      }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      (db.insert as any).mockImplementation(mockInsert);

      // Act
      const result = await ensureUserExists(sessionWithCapsEmail as any);

      // Assert
      expect(result.created).toBe(true);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    test('should throw error for invalid session', async () => {
      // Arrange
      const invalidSession = {
        user: {
          // Missing ID and email
          name: mockUserName
        }
      };

      // Act & Assert
      await expect(ensureUserExists(invalidSession as any))
        .rejects
        .toThrow('Invalid session: missing user ID or email');
    });

    test('should handle database errors gracefully', async () => {
      // Arrange
      const mockLimit = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      (db.select as any).mockImplementation(mockSelect);

      // Act & Assert
      await expect(ensureUserExists(mockSession as any))
        .rejects
        .toThrow('Failed to verify or create user');
    });
  });

  describe('verifyUserExists', () => {
    test('should return true when user exists', async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([mockDbUser]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      (db.select as any).mockImplementation(mockSelect);

      // Act
      const result = await verifyUserExists(mockUserId);

      // Assert
      expect(result.exists).toBe(true);
      expect(result.user).toEqual(mockDbUser);
    });

    test('should return false when user does not exist', async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      (db.select as any).mockImplementation(mockSelect);

      // Act
      const result = await verifyUserExists(mockUserId);

      // Assert
      expect(result.exists).toBe(false);
      expect(result.user).toBeUndefined();
    });

    test('should throw error for empty user ID', async () => {
      // Act & Assert
      await expect(verifyUserExists(''))
        .rejects
        .toThrow('User ID is required');
    });
  });
});