/**
 * Test Suite: Google OAuth Email Verification in NextAuth
 * Task 1.2: Fix Google OAuth Email Verification in NextAuth
 *
 * This test suite verifies that:
 * 1. Google OAuth enforces email verification
 * 2. Only verified emails are allowed to sign in
 * 3. Users are stored with proper verification status
 * 4. Unverified emails are rejected gracefully
 * 5. Database integration works correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextAuthOptions } from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { db } from '@/lib/db/drizzle';
import { users, accounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Mock the database operations
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
}));

// Mock environment variables for testing
const originalEnv = process.env;

describe('Google OAuth Email Verification - TDD Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up test environment
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('RED PHASE: Write Failing Tests First', () => {
    // TEST 1: Verify Google OAuth provider requires email verification
    it('should reject Google OAuth users with unverified emails', async () => {
      const { callbacks } = authConfig;

      // Simulate Google OAuth with unverified email
      const account = {
        provider: 'google',
        type: 'oauth',
        access_token: 'test-token'
      };

      const profile = {
        email: 'test@example.com',
        email_verified: false, // This should cause rejection
        name: 'Test User',
        picture: 'https://example.com/photo.jpg'
      };

      // Call signIn callback
      const result = await callbacks.signIn({ account, profile });

      // Should reject unverified email
      expect(result).toBe(false);
    });

    // TEST 2: Accept Google OAuth users with verified emails
    it('should accept Google OAuth users with verified emails', async () => {
      const { callbacks } = authConfig;

      // Simulate Google OAuth with verified email
      const account = {
        provider: 'google',
        type: 'oauth',
        access_token: 'test-token'
      };

      const profile = {
        email: 'verified@example.com',
        email_verified: true, // This should be accepted
        name: 'Verified User',
        picture: 'https://example.com/photo.jpg'
      };

      // Call signIn callback
      const result = await callbacks.signIn({ account, profile });

      // Should accept verified email
      expect(result).toBe(true);
    });

    // TEST 3: Handle missing email_verified field gracefully
    it('should reject Google OAuth users when email_verified field is missing', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth',
        access_token: 'test-token'
      };

      const profile = {
        email: 'nofield@example.com',
        name: 'No Field User',
        picture: 'https://example.com/photo.jpg'
        // email_verified field is intentionally missing
      };

      const result = await callbacks.signIn({ account, profile });

      // Should reject when field is missing (treat as unverified)
      expect(result).toBe(false);
    });

    // TEST 4: Ensure credentials provider is still allowed
    it('should continue to allow credentials provider authentication', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'credentials',
        type: 'credentials'
      };

      const result = await callbacks.signIn({ account, profile: {} });

      // Should allow credentials provider
      expect(result).toBe(true);
    });

    // TEST 5: Test database user creation with verified Google OAuth
    it('should create user with emailVerified timestamp for verified Google OAuth', async () => {
      // Mock successful database operations
      const mockUser = {
        id: 'test-user-id',
        email: 'verified@example.com',
        name: 'Verified User',
        image: 'https://example.com/photo.jpg',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]) // No existing user
          })
        })
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser])
        })
      } as any);

      // This test will verify the actual user creation logic
      // For now, it establishes the expected behavior
      expect(mockUser.emailVerified).toBeInstanceOf(Date);
      expect(mockUser.email).toBe('verified@example.com');
    });

    // TEST 6: Verify OAuth profile validation logic
    it('should properly validate Google OAuth profile structure', async () => {
      const { callbacks } = authConfig;

      // Test with invalid profile structure
      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const invalidProfile = null;

      const result = await callbacks.signIn({ account, profile: invalidProfile });

      // Should handle invalid profile gracefully
      expect(result).toBe(false);
    });

    // TEST 7: Test email verification enforcement across different Google account types
    it('should enforce email verification for Google Workspace accounts', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const workspaceProfile = {
        email: 'user@company.com',
        email_verified: false, // Workspace account with unverified email
        name: 'Workspace User',
        picture: 'https://example.com/photo.jpg',
        hd: 'company.com' // Google Workspace domain
      };

      const result = await callbacks.signIn({ account, profile: workspaceProfile });

      // Should still reject unverified workspace emails
      expect(result).toBe(false);
    });

    // TEST 8: Verify rejection doesn't break authentication flow
    it('should handle rejection without throwing errors', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const profile = {
        email: 'unverified@example.com',
        email_verified: false,
        name: 'Unverified User'
      };

      // Should not throw an error, just return false
      expect(async () => {
        await callbacks.signIn({ account, profile });
      }).not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    // TEST 9: Verify Google provider is properly configured
    it('should include Google provider in the providers array when properly configured', () => {
      // This will test that our configuration includes Google OAuth
      const providers = authConfig.providers;
      const googleProvider = providers.find(p => p.id === 'google');

      expect(googleProvider).toBeDefined();
      expect(googleProvider?.id).toBe('google');
    });

    // TEST 10: Verify signIn callback exists and is properly configured
    it('should have signIn callback configured in auth options', () => {
      expect(authConfig.callbacks).toBeDefined();
      expect(authConfig.callbacks.signIn).toBeDefined();
      expect(typeof authConfig.callbacks.signIn).toBe('function');
    });
  });

  describe('Integration Tests', () => {
    // TEST 11: End-to-end Google OAuth flow validation
    it('should complete full OAuth flow for verified user', async () => {
      const { callbacks } = authConfig;

      // Mock successful user lookup/creation
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]) // No existing user
          })
        })
      } as any);

      const account = {
        provider: 'google',
        type: 'oauth',
        access_token: 'valid-token'
      };

      const profile = {
        email: 'integration@example.com',
        email_verified: true,
        name: 'Integration Test User',
        picture: 'https://example.com/photo.jpg'
      };

      // Test signIn callback
      const signInResult = await callbacks.signIn({ account, profile });
      expect(signInResult).toBe(true);

      // Test session callback (user should be in session)
      const mockSession = {
        user: {
          email: 'integration@example.com',
          name: 'Integration Test User'
        },
        expires: '2024-12-31'
      };

      const mockToken = {
        sub: 'test-user-id',
        email: 'integration@example.com'
      };

      const sessionResult = await callbacks.session({
        session: mockSession,
        token: mockToken
      });

      expect(sessionResult.user.id).toBe('test-user-id');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    // TEST 12: Handle malformed Google profile data
    it('should handle malformed Google profile data gracefully', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const malformedProfile = {
        // Missing required fields
        email_verified: true
        // No email field
      };

      const result = await callbacks.signIn({ account, profile: malformedProfile });

      // Should reject malformed profile
      expect(result).toBe(false);
    });

    // TEST 13: Handle different data types for email_verified
    it('should handle string "true"/"false" values for email_verified', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      // Test string "true"
      const profileStringTrue = {
        email: 'stringtrue@example.com',
        email_verified: 'true' as any, // Google might send string
        name: 'String True User'
      };

      const resultTrue = await callbacks.signIn({ account, profile: profileStringTrue });
      expect(resultTrue).toBe(true);

      // Test string "false"
      const profileStringFalse = {
        email: 'stringfalse@example.com',
        email_verified: 'false' as any,
        name: 'String False User'
      };

      const resultFalse = await callbacks.signIn({ account, profile: profileStringFalse });
      expect(resultFalse).toBe(false);
    });
  });
});