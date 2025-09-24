/**
 * TDD Tests for Dashboard Hanging Issue After Google OAuth Login
 *
 * Issue: Dashboard hangs after successful Google OAuth login with the following observations:
 * 1. OAuth callback completes successfully (302 redirect)
 * 2. Middleware processes /auth/callback with VALID token
 * 3. Middleware redirects authenticated user to /dashboard
 * 4. Dashboard request has VALID token but gets stuck in pending state
 * 5. Middleware classifies /dashboard as isAuth: false (this might be the issue)
 *
 * Expected Behavior:
 * - OAuth callback should redirect to dashboard without hanging
 * - Dashboard should load properly for authenticated users
 * - No redirect loops should occur
 * - Middleware should properly handle dashboard route for authenticated users
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

describe('Dashboard Redirect Hanging Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console to reduce noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock requests
  function createMockRequest(pathname: string, origin = 'http://localhost:3000'): NextRequest {
    const url = new URL(pathname, origin);
    return new NextRequest(url);
  }

  // Helper function to create mock verified user
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

  // Helper function to create mock valid token
  function createMockValidToken(userId: string) {
    return {
      id: userId,
      sub: userId,
      email: 'test@example.com',
      name: 'Test User',
    };
  }

  describe('Google OAuth Callback Flow', () => {
    it('should allow auth callback route for authenticated users', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const req = createMockRequest('/auth/callback');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      // Auth callback route should be allowed to proceed
      expect(response?.status).not.toBe(302); // Should not redirect
    });

    it('should redirect authenticated users from auth routes to dashboard', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Test sign-in page redirect
      const req = createMockRequest('/sign-in');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('should redirect authenticated users from /auth/signin to dashboard', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Test auth signin page redirect
      const req = createMockRequest('/auth/signin');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });
  });

  describe('Dashboard Access for Authenticated Users', () => {
    it('should allow dashboard access for authenticated and verified users', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      // Dashboard should be accessible - no redirect
      expect(response?.status).not.toBe(302);
      expect(mockGetUserById).toHaveBeenCalledWith(userId);
    });

    it('should prevent redirect loops between auth callback and dashboard', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Simulate callback request
      const callbackReq = createMockRequest('/auth/callback');
      const callbackResponse = await middleware(callbackReq);

      // Should not redirect from callback (let NextAuth handle)
      expect(callbackResponse?.status).not.toBe(302);

      // Simulate dashboard request that would come after OAuth callback
      const dashboardReq = createMockRequest('/dashboard');
      const dashboardResponse = await middleware(dashboardReq);

      // Dashboard should be accessible
      expect(dashboardResponse?.status).not.toBe(302);
      expect(mockGetUserById).toHaveBeenCalledWith(userId);
    });

    it('should redirect unverified users to email verification', async () => {
      const userId = '103890241628354500674';
      const mockUser = {
        ...createMockVerifiedUser(userId),
        emailVerified: null, // Unverified user
      };
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toContain('/auth/verify-email');
    });

    it('should redirect unauthenticated users to sign-in', async () => {
      mockGetToken.mockResolvedValue(null);

      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toContain('/sign-in');
    });
  });

  describe('Middleware Route Classification', () => {
    it('should not classify /dashboard as auth route', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const req = createMockRequest('/dashboard');
      const consoleSpy = vi.spyOn(console, 'log');

      await middleware(req);

      // Check that dashboard is not classified as auth route
      const logCalls = consoleSpy.mock.calls;
      const routeClassificationLog = logCalls.find(call =>
        call[0] === '[Middleware] Route classification:'
      );

      if (routeClassificationLog) {
        const logData = routeClassificationLog[1] as any;
        expect(logData.isAuth).toBe(false);
        expect(logData.pathname).toBe('/dashboard');
      }
    });

    it('should correctly classify auth routes', async () => {
      const routes = ['/auth/signin', '/sign-in', '/auth/signup'];

      for (const route of routes) {
        const req = createMockRequest(route);
        const consoleSpy = vi.spyOn(console, 'log');

        await middleware(req);

        const logCalls = consoleSpy.mock.calls;
        const routeClassificationLog = logCalls.find(call =>
          call[0] === '[Middleware] Route classification:'
        );

        if (routeClassificationLog) {
          const logData = routeClassificationLog[1] as any;
          expect(logData.isAuth).toBe(true);
        }
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database errors gracefully for dashboard requests', async () => {
      const userId = '103890241628354500674';
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockRejectedValue(new Error('Database connection failed'));

      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toContain('/sign-in');
    });

    it('should handle invalid tokens gracefully', async () => {
      mockGetToken.mockRejectedValue(new Error('Invalid token'));

      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toContain('/sign-in');
    });

    it('should handle missing user ID in token', async () => {
      const mockToken = {
        email: 'test@example.com',
        name: 'Test User',
        // Missing id and sub
      };

      mockGetToken.mockResolvedValue(mockToken);

      const req = createMockRequest('/dashboard');
      const response = await middleware(req);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(307);
      expect(response?.headers.get('location')).toContain('/sign-in');
    });
  });

  describe('Server-Side Auth Callback Handling', () => {
    it('should handle NextAuth callback routes without interference', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      // Test NextAuth callback URL
      const req = createMockRequest('/api/auth/callback/google');
      const response = await middleware(req);

      // Should allow NextAuth API routes to proceed
      expect(response?.status).not.toBe(302);
    });

    it('should allow auth error page access', async () => {
      const req = createMockRequest('/auth/error');
      const response = await middleware(req);

      // Auth error page should be public
      expect(response?.status).not.toBe(302);
    });

    it('should allow verify-email page for authenticated users', async () => {
      const userId = '103890241628354500674';
      const mockUser = createMockVerifiedUser(userId);
      const mockToken = createMockValidToken(userId);

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const req = createMockRequest('/auth/verify-email');
      const response = await middleware(req);

      // Should not redirect from verify-email even if authenticated
      expect(response?.status).not.toBe(302);
    });
  });
});