/**
 * Integration Tests for OAuth to Dashboard Flow Fix
 *
 * This test verifies that the OAuth callback conflict fix resolves
 * the dashboard hanging issue by ensuring proper flow from OAuth
 * callback to dashboard without conflicts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { middleware } from '../src/middleware';
import { getUserById } from '../src/lib/auth/users';

// Mock dependencies
vi.mock('next-auth/jwt');
vi.mock('../src/lib/auth/users');

const mockGetToken = getToken as any;
const mockGetUserById = getUserById as any;

describe('OAuth to Dashboard Integration Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockRequest(pathname: string, origin = 'http://localhost:3000'): NextRequest {
    const url = new URL(pathname, origin);
    return new NextRequest(url);
  }

  function createMockVerifiedUser(id: string) {
    return {
      id,
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: new Date(),
      image: null,
      password: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function createMockValidToken(userId: string) {
    return {
      id: userId,
      sub: userId,
      email: 'test@example.com',
      name: 'Test User',
    };
  }

  describe('OAuth Callback Flow Without Conflicts', () => {
    it('should handle NextAuth Google OAuth callback without custom route interference', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Simulate NextAuth OAuth callback URL
      const req = createMockRequest('/api/auth/callback/google?code=authorization_code&state=csrf_token');
      const response = await middleware(req);

      // NextAuth API routes should be allowed to proceed without middleware interference
      expect(response?.status).not.toBe(307); // Should not redirect
      expect(mockGetUserById).not.toHaveBeenCalled(); // Should not hit database for API routes
    });

    it('should properly redirect to dashboard after OAuth completion', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Simulate direct dashboard access after OAuth (normal flow)
      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      // Dashboard should be accessible for verified users
      expect(response?.status).not.toBe(307); // Should not redirect
      expect(mockGetUserById).toHaveBeenCalledWith(userId);
    });

    it('should not have any routes that conflict with NextAuth callbacks', async () => {
      // Test all potential conflicting routes
      const potentialConflicts = [
        '/auth/callback/google',
        '/auth/callback/credentials',
        '/auth/callback'
      ];

      for (const path of potentialConflicts) {
        const req = createMockRequest(path);
        const response = await middleware(req);

        // These should either be:
        // 1. Allowed to proceed (for /auth/callback/* which NextAuth doesn't use)
        // 2. Treated as public routes
        if (path === '/auth/callback') {
          // This specific route should not exist as a custom route anymore
          // It would be handled by middleware as a non-existent route
          expect(response?.status).not.toBe(200); // Should not return a successful response
        }
      }
    });
  });

  describe('Dashboard Hanging Prevention', () => {
    it('should prevent infinite redirect loops between callback and dashboard', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Test multiple sequential requests to simulate the hanging scenario
      const requests = [
        '/api/auth/callback/google', // OAuth callback
        '/dashboard',                // Dashboard after OAuth
        '/dashboard',                // Subsequent dashboard access
      ];

      for (const path of requests) {
        const req = createMockRequest(path);
        const response = await middleware(req);

        if (path.startsWith('/api/auth/')) {
          // API routes should proceed
          expect(response?.status).not.toBe(307);
        } else if (path === '/dashboard') {
          // Dashboard should be accessible
          expect(response?.status).not.toBe(307);
        }
      }
    });

    it('should handle session validation properly without hanging', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Simulate rapid requests that might cause hanging
      const promises = Array.from({ length: 5 }, () => {
        const req = createMockRequest('/dashboard');
        return middleware(req);
      });

      const responses = await Promise.all(promises);

      // All requests should resolve without hanging
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response?.status).not.toBe(307); // Should not redirect
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle OAuth errors gracefully without hanging', async () => {
      // Simulate OAuth error callback
      const req = createMockRequest('/api/auth/callback/google?error=access_denied');
      const response = await middleware(req);

      // Should allow NextAuth to handle the error
      expect(response?.status).not.toBe(307);
    });

    it('should handle malformed OAuth callback URLs', async () => {
      const malformedUrls = [
        '/api/auth/callback/google?',
        '/api/auth/callback/google?code=',
        '/api/auth/callback/google?state=invalid',
      ];

      for (const path of malformedUrls) {
        const req = createMockRequest(path);
        const response = await middleware(req);

        // Should allow NextAuth to handle malformed requests
        expect(response?.status).not.toBe(307);
      }
    });

    it('should handle token validation failures during dashboard access', async () => {
      mockGetToken.mockRejectedValue(new Error('Token validation failed'));

      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      // Should redirect to sign-in on token validation failure
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toContain('/sign-in');
    });
  });
});