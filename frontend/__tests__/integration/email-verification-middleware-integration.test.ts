/**
 * Integration Test Suite: Email Verification Middleware Integration
 * Task 1.3: Integration testing between middleware and authentication system
 *
 * This test suite verifies that:
 * 1. Email verification middleware integrates properly with NextAuth
 * 2. Google OAuth verified users can access protected routes
 * 3. Credentials users can access protected routes after auto-verification
 * 4. Unverified users get redirected to verification flow
 * 5. End-to-end user experience flows work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserById } from '@/lib/auth/users';

// Mock dependencies
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}));

vi.mock('@/lib/auth/users', () => ({
  getUserById: vi.fn()
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    redirect: vi.fn(),
    next: vi.fn()
  }
}));

const mockGetToken = getToken as any;
const mockGetUserById = getUserById as any;

describe('Email Verification Middleware Integration Tests', () => {
  let mockRequest: NextRequest;
  let mockRedirectResponse: any;
  let mockNextResponse: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedirectResponse = { type: 'redirect' };
    mockNextResponse = { type: 'next' };

    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue(mockRedirectResponse),
      next: vi.fn().mockReturnValue(mockNextResponse)
    };

    Object.assign(NextResponse, mockNextResponseMethods);

    mockRequest = {
      nextUrl: {
        pathname: '/dashboard',
        href: 'http://localhost:3000/dashboard',
        clone: () => ({
          pathname: '/auth/verify-email',
          searchParams: {
            set: vi.fn()
          }
        })
      }
    } as unknown as NextRequest;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Google OAuth Integration', () => {
    it('should allow Google OAuth users with verified emails to access protected routes', async () => {
      // Arrange - Simulate Google OAuth verified user
      const mockToken = {
        sub: 'google-oauth-user',
        email: 'verified@gmail.com',
        name: 'Google User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User exists in database with verified email (set during OAuth sign-in)
      const mockUser = {
        id: 'google-oauth-user',
        email: 'verified@gmail.com',
        name: 'Google User',
        emailVerified: new Date('2024-01-01'), // Verified during Google OAuth
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/secrets';

      // Import middleware after mocking
      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should allow access
      expect(mockGetToken).toHaveBeenCalled();
      expect(mockGetUserById).toHaveBeenCalledWith('google-oauth-user');
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    it('should redirect Google OAuth users if email verification is missing from database', async () => {
      // Arrange - Google OAuth user but verification missing in database
      const mockToken = {
        sub: 'google-oauth-unverified',
        email: 'unverified@gmail.com',
        name: 'Unverified Google User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User exists but without verification (edge case)
      const mockUser = {
        id: 'google-oauth-unverified',
        email: 'unverified@gmail.com',
        name: 'Unverified Google User',
        emailVerified: null, // Missing verification
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should redirect to verification
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });
  });

  describe('Credentials Authentication Integration', () => {
    it('should allow credentials users with auto-verified emails to access protected routes', async () => {
      // Arrange - Credentials user with auto-verification
      const mockToken = {
        sub: 'credentials-user',
        email: 'user@example.com',
        name: 'Credentials User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User with auto-verification (set during registration)
      const mockUser = {
        id: 'credentials-user',
        email: 'user@example.com',
        name: 'Credentials User',
        emailVerified: new Date('2024-01-01'), // Auto-verified during registration
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/profile';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should allow access
      expect(mockGetUserById).toHaveBeenCalledWith('credentials-user');
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });
  });

  describe('Mixed Authentication Scenarios', () => {
    it('should handle transition from Google OAuth to credentials authentication', async () => {
      // Arrange - User who previously used Google OAuth, now using credentials
      const mockToken = {
        sub: 'mixed-auth-user',
        email: 'mixed@example.com',
        name: 'Mixed Auth User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User with existing verification from Google OAuth
      const mockUser = {
        id: 'mixed-auth-user',
        email: 'mixed@example.com',
        name: 'Mixed Auth User',
        emailVerified: new Date('2024-01-01'), // From previous Google OAuth
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/secrets/create';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should maintain verification status
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // Arrange - Database connection failure
      const mockToken = {
        sub: 'db-error-user',
        email: 'error@example.com',
        name: 'Error User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // Database error
      mockGetUserById.mockRejectedValue(new Error('Database connection lost'));

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should fail safely with redirect to login
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    it('should handle missing user records gracefully', async () => {
      // Arrange - User token valid but user not in database
      const mockToken = {
        sub: 'missing-user',
        email: 'missing@example.com',
        name: 'Missing User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User not found in database
      mockGetUserById.mockResolvedValue(null);

      mockRequest.nextUrl.pathname = '/secrets';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should redirect to login
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });
  });

  describe('Route Protection Integration', () => {
    it('should protect multiple route types with email verification', async () => {
      const protectedRoutes = [
        '/dashboard',
        '/secrets',
        '/secrets/create',
        '/secrets/123',
        '/profile',
        '/settings'
      ];

      for (const route of protectedRoutes) {
        // Reset mocks for each iteration
        vi.clearAllMocks();

        // Arrange - Unverified user
        const mockToken = {
          sub: 'unverified-user',
          email: 'unverified@example.com',
          name: 'Unverified User'
        };
        mockGetToken.mockResolvedValue(mockToken);

        const mockUser = {
          id: 'unverified-user',
          email: 'unverified@example.com',
          name: 'Unverified User',
          emailVerified: null, // Not verified
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mockGetUserById.mockResolvedValue(mockUser);

        mockRequest.nextUrl.pathname = route;

        const { middleware } = await import('@/middleware');

        // Act
        const result = await middleware(mockRequest);

        // Assert - Should redirect all protected routes
        expect(NextResponse.redirect).toHaveBeenCalled();
        expect(result).toBe(mockRedirectResponse);
      }
    });

    it('should allow access to verification page for authenticated users', async () => {
      // Arrange - User trying to access verification page
      const mockToken = {
        sub: 'user-on-verify-page',
        email: 'user@example.com',
        name: 'User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      mockRequest.nextUrl.pathname = '/auth/verify-email';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should allow access to verification page
      expect(mockGetUserById).not.toHaveBeenCalled(); // No need to check DB for public route
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });
  });

  describe('Performance Considerations', () => {
    it('should not make database calls for public routes', async () => {
      const publicRoutes = [
        '/',
        '/auth/login',
        '/auth/signup',
        '/auth/error',
        '/auth/verify-email',
        '/sign-in'
      ];

      for (const route of publicRoutes) {
        // Reset mocks for each iteration
        vi.clearAllMocks();

        const mockToken = {
          sub: 'authenticated-user',
          email: 'user@example.com',
          name: 'User'
        };
        mockGetToken.mockResolvedValue(mockToken);

        mockRequest.nextUrl.pathname = route;

        const { middleware } = await import('@/middleware');

        // Act
        await middleware(mockRequest);

        // Assert - Should not check database for public routes
        expect(mockGetUserById).not.toHaveBeenCalled();
      }
    });

    it('should not make database calls for unauthenticated users', async () => {
      // Arrange - No token
      mockGetToken.mockResolvedValue(null);
      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      await middleware(mockRequest);

      // Assert - Should not check database for unauthenticated users
      expect(mockGetUserById).not.toHaveBeenCalled();
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain existing authentication behavior for verified users', async () => {
      // Arrange - Standard authenticated and verified user
      const mockToken = {
        sub: 'legacy-user',
        email: 'legacy@example.com',
        name: 'Legacy User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      const mockUser = {
        id: 'legacy-user',
        email: 'legacy@example.com',
        name: 'Legacy User',
        emailVerified: new Date('2023-01-01'), // Previously verified
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should work exactly as before for verified users
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    it('should maintain existing behavior for auth routes', async () => {
      // Arrange - Authenticated user on auth route
      const mockToken = {
        sub: 'user-on-auth-route',
        email: 'user@example.com',
        name: 'User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      mockRequest.nextUrl.pathname = '/auth/login';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - Should redirect to dashboard (existing behavior)
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });
  });
});