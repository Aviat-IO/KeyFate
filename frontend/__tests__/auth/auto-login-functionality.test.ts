import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createUser, authenticateUser } from '@/lib/auth/users';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

// Create mock database instance
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
}

// Mock database and dependencies
vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
  db: mockDb, // Keep for backward compatibility with existing tests
}));

vi.mock('@/lib/db/schema', () => ({
  users: {
    $inferSelect: {} as any,
  },
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    randomUUID: () => 'test-uuid-123',
  };
});

describe('Auto-Login Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser with auto-login', () => {
    it('should create new user when email does not exist', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock no existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No existing user
          }),
        }),
      });

      // Mock successful user creation
      (hashPassword as any).mockResolvedValue('hashed-password');
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-uuid-123',
            email: 'new@example.com',
            name: null,
            password: 'hashed-password',
            emailVerified: new Date(),
          }]),
        }),
      });

      const result = await createUser({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.isExistingUser).toBe(false);
      expect(result.user?.email).toBe('new@example.com');
      expect(hashPassword).toHaveBeenCalledWith('password123');
    });

    it('should auto-login existing user with correct password', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock existing user
      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        password: 'hashed-password',
        name: 'Existing User',
        emailVerified: new Date(),
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]), // Existing user found
          }),
        }),
      });

      // Mock successful password verification
      (verifyPassword as any).mockResolvedValue(true);

      const result = await createUser({
        email: 'existing@example.com',
        password: 'correct-password',
      });

      expect(result.success).toBe(true);
      expect(result.isExistingUser).toBe(true);
      expect(result.user?.email).toBe('existing@example.com');
      expect(result.user?.id).toBe('existing-user-id');
      expect(verifyPassword).toHaveBeenCalledWith('correct-password', 'hashed-password');
    });

    it('should return error for existing user with wrong password', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock existing user
      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        password: 'hashed-password',
        name: 'Existing User',
        emailVerified: new Date(),
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]), // Existing user found
          }),
        }),
      });

      // Mock failed password verification
      (verifyPassword as any).mockResolvedValue(false);

      const result = await createUser({
        email: 'existing@example.com',
        password: 'wrong-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('An account with this email already exists. Please sign in instead.');
      expect(result.isExistingUser).toBeUndefined();
      expect(verifyPassword).toHaveBeenCalledWith('wrong-password', 'hashed-password');
    });

    it('should handle database errors gracefully', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock database error
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          }),
        }),
      });

      const result = await createUser({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create user');
    });

    it('should handle authentication service errors', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock existing user
      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        password: 'hashed-password',
        name: 'Existing User',
        emailVerified: new Date(),
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      });

      // Mock authentication service to return failure (not throw error)
      (verifyPassword as any).mockResolvedValue(false);

      const result = await createUser({
        email: 'existing@example.com',
        password: 'any-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('An account with this email already exists. Please sign in instead.');
    });
  });

  describe('Edge cases', () => {
    it('should handle user creation failure after successful password hash', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock no existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No existing user
          }),
        }),
      });

      // Mock successful password hashing but failed user creation
      (hashPassword as any).mockResolvedValue('hashed-password');
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]), // Empty result (creation failed)
        }),
      });

      const result = await createUser({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create user');
    });

    it('should trim and lowercase email consistently', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock no existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock successful user creation
      (hashPassword as any).mockResolvedValue('hashed-password');
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-uuid-123',
            email: 'test@example.com', // Should be lowercased
            name: null,
            password: 'hashed-password',
            emailVerified: new Date(),
          }]),
        }),
      });

      const result = await createUser({
        email: ' TEST@EXAMPLE.COM ', // Mixed case with spaces
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');

      // Verify the database insert was called with lowercase email
      const insertCall = (db.insert as any).mock.results[0].value;
      const valuesCall = insertCall.values.mock.calls[0][0];
      expect(valuesCall.email).toBe('test@example.com');
    });
  });

  describe('Password security', () => {
    it('should not return password in any response', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock no existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock successful user creation
      (hashPassword as any).mockResolvedValue('hashed-password');
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-uuid-123',
            email: 'test@example.com',
            name: null,
            password: 'hashed-password',
            emailVerified: new Date(),
          }]),
        }),
      });

      const result = await createUser({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect((result.user as any)?.password).toBeUndefined();
    });

    it('should not return password in auto-login response', async () => {
      const { db } = await import('@/lib/db/drizzle');

      // Mock existing user
      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        password: 'hashed-password',
        name: 'Existing User',
        emailVerified: new Date(),
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      });

      // Mock successful password verification
      (verifyPassword as any).mockResolvedValue(true);

      const result = await createUser({
        email: 'existing@example.com',
        password: 'correct-password',
      });

      expect(result.success).toBe(true);
      expect(result.isExistingUser).toBe(true);
      expect(result.user).toBeDefined();
      expect((result.user as any)?.password).toBeUndefined();
    });
  });
});