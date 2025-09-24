/**
 * Test Suite: API Route Protection
 * Task 1.3: Verify API routes are properly protected by email verification middleware
 *
 * This test suite verifies that API routes (like /api/secrets) are properly
 * protected by the middleware and require email verification.
 *
 * CRITICAL: API routes are currently excluded from middleware by the matcher config!
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserById } from '@/lib/auth/users';

// Mock NextAuth JWT
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}));

// Mock user database functions
vi.mock('@/lib/auth/users', () => ({
  getUserById: vi.fn()
}));

// Mock Next.js server functions
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    redirect: vi.fn(),
    next: vi.fn(),
    json: vi.fn()
  }
}));

const mockGetToken = getToken as any;
const mockGetUserById = getUserById as any;

// Helper to create mock NextRequest for API routes
function createAPIRequest(pathname: string) {
  const url = `http://localhost:3000${pathname}`;
  const req = new NextRequest(url, {
    headers: new Headers({
      'user-agent': 'test',
      'content-type': 'application/json',
    }),
  });

  Object.defineProperty(req, 'nextUrl', {
    value: new URL(url),
    writable: false,
  });

  return req;
}

describe('API Route Protection - Email Verification Required', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockNextResponse = { type: 'next' };
    const mockRedirectResponse = { type: 'redirect' };
    const mockJSONResponse = { type: 'json', status: 401 };

    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue(mockRedirectResponse),
      next: vi.fn().mockReturnValue(mockNextResponse),
      json: vi.fn().mockReturnValue(mockJSONResponse)
    };

    Object.assign(NextResponse, mockNextResponseMethods);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Protected API Routes - Authentication Required', () => {
    const protectedAPIRoutes = [
      '/api/secrets',
      '/api/secrets/123',
      '/api/secrets/123/check-in',
      '/api/secrets/123/toggle-pause',
      '/api/user/profile',
      '/api/user/settings'
    ];

    test.each(protectedAPIRoutes)('should reject unauthenticated requests to %s', async (apiRoute) => {
      // Arrange - no token
      mockGetToken.mockResolvedValue(null);

      const req = createAPIRequest(apiRoute);

      // Import middleware after mocking
      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(req);

      // Assert - should return 401 for unauthenticated API requests
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: 'Please sign in to continue',
          code: 'UNAUTHENTICATED'
        },
        { status: 401 }
      );
    });

    test.each(protectedAPIRoutes)('should reject unverified users from %s', async (apiRoute) => {
      // Arrange - authenticated but unverified user
      const mockToken = {
        sub: 'user123',
        email: 'unverified@example.com',
        name: 'Unverified User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User exists but email not verified
      const mockUser = {
        id: 'user123',
        email: 'unverified@example.com',
        name: 'Unverified User',
        emailVerified: null, // Not verified
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      const req = createAPIRequest(apiRoute);

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(req);

      // Assert - should return 403 for unverified users
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: 'Please verify your email address to continue',
          code: 'EMAIL_NOT_VERIFIED'
        },
        { status: 403 }
      );
    });

    test.each(protectedAPIRoutes)('should allow verified users to access %s', async (apiRoute) => {
      // Arrange - authenticated and verified user
      const mockToken = {
        sub: 'user123',
        email: 'verified@example.com',
        name: 'Verified User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User with verified email
      const mockUser = {
        id: 'user123',
        email: 'verified@example.com',
        name: 'Verified User',
        emailVerified: new Date('2024-01-01'), // Verified
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      const req = createAPIRequest(apiRoute);

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(req);

      // Assert - should allow access
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('Auth API Routes - Should Allow Access', () => {
    const authAPIRoutes = [
      '/api/auth/callback/google',
      '/api/auth/session',
      '/api/auth/signin',
      '/api/auth/signout',
      '/api/auth/providers',
      '/api/auth/resend-verification',
      '/api/auth/verify-email',
      '/api/auth/verification-status'
    ];

    test.each(authAPIRoutes)('should allow access to auth API route %s without verification', async (authRoute) => {
      // Arrange - could be authenticated or not
      mockGetToken.mockResolvedValue(null);

      const req = createAPIRequest(authRoute);

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(req);

      // Assert - should allow access without checking verification
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.json).not.toHaveBeenCalled();
      expect(mockGetUserById).not.toHaveBeenCalled();
    });
  });

  describe('Critical Issue - API Routes Excluded by Matcher', () => {
    it('should expose the critical configuration issue', () => {
      // This test documents the critical issue: API routes are excluded by the matcher
      const middlewareConfig = {
        matcher: [
          "/((?!api|_next/static|_next/image|favicon.ico).*)",
        ]
      };

      // The current matcher excludes ALL API routes (including /api/secrets)
      const apiRoutes = [
        '/api/secrets',
        '/api/secrets/123',
        '/api/user/profile'
      ];

      // All these routes would NOT match the current matcher pattern
      apiRoutes.forEach(route => {
        const matches = route.match(/^\/((?!api|_next\/static|_next\/image|favicon\.ico).*)$/);
        expect(matches).toBeNull(); // They don't match = middleware not applied
      });

      // Only auth API routes should be excluded, not all API routes
      const shouldMatch = [
        '/api/secrets',
        '/api/user/profile'
      ];

      const shouldNotMatch = [
        '/api/auth/session',
        '/_next/static/file.js',
        '/favicon.ico'
      ];

      // This is what the matcher SHOULD be:
      const fixedMatcher = "/((?!api/auth|_next/static|_next/image|favicon.ico).*)";

      shouldMatch.forEach(route => {
        const matches = route.match(new RegExp(`^${fixedMatcher}$`));
        expect(matches).not.toBeNull(); // Should match = middleware applied
      });

      shouldNotMatch.forEach(route => {
        const matches = route.match(new RegExp(`^${fixedMatcher}$`));
        expect(matches).toBeNull(); // Should not match = middleware not applied
      });
    });
  });
});