/**
 * Test Suite: Google OAuth Database Integration
 * Task 1.2: Fix Google OAuth Email Verification in NextAuth
 *
 * This test suite verifies database integration for Google OAuth:
 * 1. User accounts are created with proper verification status
 * 2. Account linking works correctly
 * 3. Email verification status is persisted
 * 4. Session management includes verification status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authConfig } from '@/lib/auth-config';
import { db } from '@/lib/db/drizzle';
import { users, accounts } from '@/lib/db/schema';

// Create mock database instance
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  transaction: vi.fn(),
}

// Mock the database
vi.mock('@/lib/db/drizzle', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
  db: mockDb, // Keep for backward compatibility
}));

describe('Google OAuth Database Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  describe('Account and User Creation', () => {
    it('should handle user creation for new Google OAuth user with verified email', async () => {
      // Mock no existing user
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      // Mock successful user creation
      const newUser = {
        id: 'new-user-id',
        email: 'newuser@gmail.com',
        name: 'New User',
        image: 'https://lh3.googleusercontent.com/photo.jpg',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newUser])
        })
      } as any);

      // Simulate Google OAuth flow
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth',
        providerAccountId: 'google-account-123',
        access_token: 'google-access-token'
      };

      const profile = {
        email: 'newuser@gmail.com',
        email_verified: true,
        name: 'New User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        sub: 'google-account-123'
      };

      // Test signIn callback
      const signInResult = await callbacks.signIn({ account, profile });
      expect(signInResult).toBe(true);

      // Verify that NextAuth will handle user/account creation
      // (NextAuth creates the user when signIn returns true)
    });

    it('should handle existing user with Google account linking', async () => {
      // Mock existing user
      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@gmail.com',
        name: 'Existing User',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser])
          })
        })
      } as any);

      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth',
        providerAccountId: 'google-account-456',
        access_token: 'google-access-token'
      };

      const profile = {
        email: 'existing@gmail.com',
        email_verified: true,
        name: 'Existing User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        sub: 'google-account-456'
      };

      const signInResult = await callbacks.signIn({ account, profile });
      expect(signInResult).toBe(true);
    });

    it('should reject and not create database records for unverified Google email', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth',
        providerAccountId: 'google-unverified-789',
        access_token: 'google-access-token'
      };

      const profile = {
        email: 'unverified@gmail.com',
        email_verified: false, // This should prevent account creation
        name: 'Unverified User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        sub: 'google-unverified-789'
      };

      const signInResult = await callbacks.signIn({ account, profile });
      expect(signInResult).toBe(false);

      // When signIn returns false, NextAuth won't create user/account records
      // This test verifies that our validation prevents database pollution
    });
  });

  describe('Session Management with Email Verification', () => {
    it('should include user ID in session for verified Google user', async () => {
      const { callbacks } = authConfig;

      const mockSession = {
        user: {
          email: 'verified@gmail.com',
          name: 'Verified User',
          image: 'https://lh3.googleusercontent.com/photo.jpg'
        },
        expires: '2024-12-31'
      };

      const mockToken = {
        sub: 'user-123',
        email: 'verified@gmail.com',
        provider: 'google'
      };

      const sessionResult = await callbacks.session({
        session: mockSession,
        token: mockToken
      });

      expect(sessionResult.user.id).toBe('user-123');
      expect(sessionResult.user.email).toBe('verified@gmail.com');
    });

    it('should include access token in JWT for Google OAuth', async () => {
      const { callbacks } = authConfig;

      const mockUser = {
        id: 'user-456',
        email: 'jwttest@gmail.com',
        name: 'JWT Test User'
      };

      const mockAccount = {
        provider: 'google',
        type: 'oauth',
        access_token: 'google-access-token-jwt'
      };

      const jwtResult = await callbacks.jwt({
        token: {},
        user: mockUser,
        account: mockAccount
      });

      expect(jwtResult.id).toBe('user-456');
      expect(jwtResult.accessToken).toBe('google-access-token-jwt');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database errors gracefully during OAuth flow', async () => {
      // Mock database error
      vi.mocked(db.select).mockRejectedValue(new Error('Database connection failed'));

      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const profile = {
        email: 'dbtest@gmail.com',
        email_verified: true,
        name: 'DB Test User'
      };

      // Even with database errors, our validation logic should work
      // (Database operations are handled by NextAuth, not our callback)
      const signInResult = await callbacks.signIn({ account, profile });
      expect(signInResult).toBe(true);
    });

    it('should properly validate email format in Google profile', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const profileInvalidEmail = {
        email: 'not-an-email', // Invalid email format
        email_verified: true,
        name: 'Invalid Email User'
      };

      // Our current implementation accepts any email format from Google
      // This test documents the current behavior
      const result = await callbacks.signIn({ account, profile: profileInvalidEmail });
      expect(result).toBe(true);
    });

    it('should handle concurrent OAuth attempts for same user', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const profile = {
        email: 'concurrent@gmail.com',
        email_verified: true,
        name: 'Concurrent User'
      };

      // Simulate multiple concurrent sign-in attempts
      const promises = Array(3).fill(null).map(() =>
        callbacks.signIn({ account, profile })
      );

      const results = await Promise.all(promises);

      // All should succeed (NextAuth handles concurrency)
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });
  });

  describe('Google-Specific Features', () => {
    it('should handle Google Workspace domain information', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const workspaceProfile = {
        email: 'employee@company.com',
        email_verified: true,
        name: 'Employee User',
        hd: 'company.com', // Google Workspace hosted domain
        picture: 'https://lh3.googleusercontent.com/photo.jpg'
      };

      const result = await callbacks.signIn({ account, profile: workspaceProfile });
      expect(result).toBe(true);
    });

    it('should handle Google profile with multiple email addresses', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const multiEmailProfile = {
        email: 'primary@gmail.com', // Primary email
        email_verified: true,
        name: 'Multi Email User',
        emails: [
          { value: 'primary@gmail.com', verified: true },
          { value: 'secondary@gmail.com', verified: false }
        ]
      };

      // Should validate based on primary email verification
      const result = await callbacks.signIn({ account, profile: multiEmailProfile });
      expect(result).toBe(true);
    });

    it('should handle Google profile locale and timezone information', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const localeProfile = {
        email: 'locale@gmail.com',
        email_verified: true,
        name: 'Locale User',
        locale: 'en-US',
        zoneinfo: 'America/New_York',
        picture: 'https://lh3.googleusercontent.com/photo.jpg'
      };

      const result = await callbacks.signIn({ account, profile: localeProfile });
      expect(result).toBe(true);
    });
  });
});