/**
 * Integration Test Suite: Complete Google OAuth Email Verification Flow
 * Task 1.2: Fix Google OAuth Email Verification in NextAuth
 *
 * This test suite verifies the complete end-to-end flow:
 * 1. User authentication with Google OAuth
 * 2. Email verification enforcement
 * 3. User creation/session management
 * 4. Error handling and security
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn, getSession } from 'next-auth/react';
import { authConfig } from '@/lib/auth-config';
import { googleOAuthFlow, handleOAuthCallback } from '@/lib/auth/oauth-service';

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn()
}));

describe('Complete Google OAuth Email Verification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  describe('Successful Verification Flow', () => {
    it('should complete full OAuth flow for user with verified email', async () => {
      // Step 1: Mock successful OAuth initiation
      vi.mocked(signIn).mockResolvedValue({
        ok: true,
        error: null,
        status: 200,
        url: '/auth/callback/google?code=auth_code&state=csrf_token'
      });

      // Step 2: Initiate OAuth flow
      const oauthResult = await googleOAuthFlow({ redirectTo: '/dashboard' });
      expect(oauthResult.success).toBe(true);

      // Step 3: Verify signIn was called with correct parameters
      expect(signIn).toHaveBeenCalledWith('google', {
        callbackUrl: '/dashboard',
        redirect: true,
        redirectTo: '/dashboard'
      });

      // Step 4: Mock successful session creation after callback
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'verified@gmail.com',
          name: 'Verified User',
          image: 'https://lh3.googleusercontent.com/photo.jpg'
        },
        expires: '2024-12-31T23:59:59.999Z'
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      // Step 5: Handle OAuth callback
      const callbackResult = await handleOAuthCallback();
      expect(callbackResult.success).toBe(true);
      expect(callbackResult.user?.email).toBe('verified@gmail.com');
    });

    it('should enforce email verification at the callback level', async () => {
      const { callbacks } = authConfig;

      // Simulate the actual NextAuth callback that happens during OAuth flow
      const account = {
        provider: 'google',
        type: 'oauth',
        providerAccountId: 'google-123',
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'Bearer',
        scope: 'openid profile email'
      };

      const verifiedProfile = {
        sub: 'google-123',
        email: 'verified@gmail.com',
        email_verified: true,
        name: 'Verified User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        given_name: 'Verified',
        family_name: 'User',
        locale: 'en'
      };

      // This is the critical test - our callback should allow verified users
      const signInResult = await callbacks.signIn({ account, profile: verifiedProfile });
      expect(signInResult).toBe(true);

      // Test session creation
      const mockToken = {
        sub: 'user-123',
        email: 'verified@gmail.com',
        name: 'Verified User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg'
      };

      const mockSession = {
        user: {
          email: 'verified@gmail.com',
          name: 'Verified User',
          image: 'https://lh3.googleusercontent.com/photo.jpg'
        },
        expires: '2024-12-31T23:59:59.999Z'
      };

      const sessionResult = await callbacks.session({
        session: mockSession,
        token: mockToken
      });

      expect(sessionResult.user.id).toBe('user-123');
    });
  });

  describe('Failed Verification Flow', () => {
    it('should block OAuth flow for user with unverified email', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth',
        providerAccountId: 'google-456',
        access_token: 'valid-token'
      };

      const unverifiedProfile = {
        sub: 'google-456',
        email: 'unverified@gmail.com',
        email_verified: false, // This should block the flow
        name: 'Unverified User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg'
      };

      // Critical test - our callback should reject unverified users
      const signInResult = await callbacks.signIn({ account, profile: unverifiedProfile });
      expect(signInResult).toBe(false);

      // When signIn callback returns false, NextAuth stops the flow
      // No session should be created
    });

    it('should handle OAuth error responses gracefully', async () => {
      // Mock OAuth error
      vi.mocked(signIn).mockResolvedValue({
        ok: false,
        error: 'AccessDenied',
        status: 403,
        url: null
      });

      const oauthResult = await googleOAuthFlow({ redirectTo: '/dashboard' });
      expect(oauthResult.success).toBe(false);
      expect(oauthResult.error).toBe('AccessDenied');
    });

    it('should handle malformed OAuth responses', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      // Test various malformed profiles
      const malformedProfiles = [
        null,
        undefined,
        {},
        { email_verified: true }, // Missing email
        { email: 'test@example.com' }, // Missing email_verified
        { email: '', email_verified: true }, // Empty email
        { email: 'test@example.com', email_verified: 'maybe' } // Invalid boolean
      ];

      for (const profile of malformedProfiles) {
        const result = await callbacks.signIn({ account, profile });
        expect(result).toBe(false);
      }
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle concurrent OAuth attempts safely', async () => {
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

      // Simulate multiple concurrent attempts
      const attempts = Array(5).fill(null).map(() =>
        callbacks.signIn({ account, profile })
      );

      const results = await Promise.all(attempts);

      // All should succeed consistently
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });

    it('should preserve JWT token information correctly', async () => {
      const { callbacks } = authConfig;

      const mockUser = {
        id: 'user-789',
        email: 'jwt@gmail.com',
        name: 'JWT User'
      };

      const mockAccount = {
        provider: 'google',
        type: 'oauth',
        access_token: 'google-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'google-refresh-token',
        id_token: 'google-id-token'
      };

      const jwtResult = await callbacks.jwt({
        token: {},
        user: mockUser,
        account: mockAccount
      });

      expect(jwtResult.id).toBe('user-789');
      expect(jwtResult.accessToken).toBe('google-access-token');
    });

    it('should handle session expiration correctly', async () => {
      // Mock expired session
      vi.mocked(getSession).mockResolvedValue(null);

      const callbackResult = await handleOAuthCallback();
      expect(callbackResult.success).toBe(false);
      expect(callbackResult.error).toBe('No valid session found');
    });

    it('should validate different email verification value types', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      // Test different value types for email_verified
      const testCases = [
        { email_verified: true, expected: true },
        { email_verified: false, expected: false },
        { email_verified: 'true', expected: true },
        { email_verified: 'false', expected: false },
        { email_verified: 'TRUE', expected: true },
        { email_verified: 'FALSE', expected: false },
        { email_verified: 1, expected: false }, // Numbers should be rejected
        { email_verified: 0, expected: false },
        { email_verified: null, expected: false },
        { email_verified: undefined, expected: false }
      ];

      for (const testCase of testCases) {
        const profile = {
          email: 'typetest@gmail.com',
          name: 'Type Test User',
          ...testCase
        };

        const result = await callbacks.signIn({ account, profile });
        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle Google Workspace accounts correctly', async () => {
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
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        given_name: 'Employee',
        family_name: 'User'
      };

      const result = await callbacks.signIn({ account, profile: workspaceProfile });
      expect(result).toBe(true);
    });

    it('should handle personal Gmail accounts correctly', async () => {
      const { callbacks } = authConfig;

      const account = {
        provider: 'google',
        type: 'oauth'
      };

      const gmailProfile = {
        email: 'personal@gmail.com',
        email_verified: true,
        name: 'Personal User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        given_name: 'Personal',
        family_name: 'User',
        locale: 'en-US'
      };

      const result = await callbacks.signIn({ account, profile: gmailProfile });
      expect(result).toBe(true);
    });

    it('should maintain backward compatibility with existing auth flows', async () => {
      const { callbacks } = authConfig;

      // Test credentials provider still works
      const credentialsAccount = {
        provider: 'credentials',
        type: 'credentials'
      };

      const credentialsResult = await callbacks.signIn({
        account: credentialsAccount,
        profile: {}
      });

      expect(credentialsResult).toBe(true);

      // Test unknown provider is rejected
      const unknownAccount = {
        provider: 'unknown',
        type: 'oauth'
      };

      const unknownResult = await callbacks.signIn({
        account: unknownAccount,
        profile: { email: 'test@example.com' }
      });

      expect(unknownResult).toBe(false);
    });
  });
});