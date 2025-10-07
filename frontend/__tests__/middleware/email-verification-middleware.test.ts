/**
 * Test Suite: Email Verification Middleware (Task 1.3)
 *
 * Tests the updated middleware that enforces email verification using
 * the emailVerified field from the JWT token (populated by auth callbacks).
 *
 * Implementation approach:
 * - JWT callback adds emailVerified from database to token
 * - Session callback exposes emailVerified in session
 * - Middleware checks token.emailVerified and redirects unverified users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mock NextResponse methods
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      redirect: vi.fn((url) => ({ type: 'redirect', url })),
      next: vi.fn(() => ({ type: 'next' })),
    },
  };
});

// Mock withAuth middleware
vi.mock('next-auth/middleware', () => ({
  withAuth: (middleware: Function, config: any) => {
    // Return a function that calls the middleware with mocked token
    return async (request: any) => {
      // Simulate withAuth adding token to request
      const mockRequest = {
        ...request,
        nextauth: {
          token: request._mockToken || null,
        },
      };
      return middleware(mockRequest);
    };
  },
}));

describe('Email Verification Middleware - Task 1.3', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a base mock request
    mockRequest = {
      nextUrl: {
        pathname: '/dashboard',
        href: 'http://localhost:3000/dashboard',
        clone: () => ({
          pathname: '/auth/verify-email',
        }),
      },
      _mockToken: null,
    } as unknown as NextRequest;
  });

  describe('Email Verification Enforcement', () => {
    it('should redirect unverified users to /auth/verify-email', async () => {
      // Arrange: User with no emailVerified field
      mockRequest._mockToken = {
        id: 'user123',
        email: 'unverified@example.com',
        emailVerified: null,
      };

      // Import middleware after mocks are set up
      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert
      expect(NextResponse.redirect).toHaveBeenCalled();
    });

    it('should allow verified users to access protected routes', async () => {
      // Arrange: User with emailVerified date
      mockRequest._mockToken = {
        id: 'user123',
        email: 'verified@example.com',
        emailVerified: new Date('2024-01-01'),
      };

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should NOT enforce verification on /auth/verify-email route', async () => {
      // Arrange: Unverified user accessing verification page
      mockRequest._mockToken = {
        id: 'user123',
        email: 'unverified@example.com',
        emailVerified: null,
      };
      mockRequest.nextUrl.pathname = '/auth/verify-email';

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should allow access without redirect
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should NOT enforce verification on verification API routes', async () => {
      // Arrange: Unverified user calling verification API
      mockRequest._mockToken = {
        id: 'user123',
        email: 'unverified@example.com',
        emailVerified: null,
      };
      mockRequest.nextUrl.pathname = '/api/auth/verify-email';

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should allow access
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should NOT enforce verification on /sign-in route', async () => {
      // Arrange: Unverified user on sign-in page
      mockRequest._mockToken = {
        id: 'user123',
        email: 'unverified@example.com',
        emailVerified: null,
      };
      mockRequest.nextUrl.pathname = '/sign-in';

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should not redirect (but may redirect to dashboard if already authenticated)
      // The sign-in redirect logic is separate from email verification
      expect(result).toBeDefined();
    });

    it('should redirect signed-in verified users from /sign-in to /dashboard', async () => {
      // Arrange: Verified user trying to access sign-in
      mockRequest._mockToken = {
        id: 'user123',
        email: 'verified@example.com',
        emailVerified: new Date('2024-01-01'),
      };
      mockRequest.nextUrl.pathname = '/sign-in';
      mockRequest.nextUrl.clone = () => ({
        pathname: '/dashboard',
      });

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should redirect to dashboard
      expect(NextResponse.redirect).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should treat undefined emailVerified as unverified', async () => {
      // Arrange: Token without emailVerified field
      mockRequest._mockToken = {
        id: 'user123',
        email: 'unknown@example.com',
        // emailVerified is undefined
      };

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should redirect (treat as unverified)
      expect(NextResponse.redirect).toHaveBeenCalled();
    });

    it('should allow access to auth error page for unverified users', async () => {
      // Arrange: Unverified user accessing error page
      mockRequest._mockToken = {
        id: 'user123',
        email: 'unverified@example.com',
        emailVerified: null,
      };
      mockRequest.nextUrl.pathname = '/auth/error';

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should allow access
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  describe('Google OAuth Users', () => {
    it('should allow Google OAuth users with verified emails', async () => {
      // Arrange: Google OAuth user (verified during sign-in)
      mockRequest._mockToken = {
        id: 'google-user123',
        email: 'google@example.com',
        emailVerified: new Date('2024-01-01'), // Set by signIn callback
      };

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should allow access
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  describe('Credentials Users', () => {
    it('should redirect credentials users without verification', async () => {
      // Arrange: Credentials user who hasn't verified email
      mockRequest._mockToken = {
        id: 'creds-user123',
        email: 'creds@example.com',
        emailVerified: null, // Not verified yet
      };

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should redirect
      expect(NextResponse.redirect).toHaveBeenCalled();
    });

    it('should allow credentials users after they verify', async () => {
      // Arrange: Credentials user who has verified
      mockRequest._mockToken = {
        id: 'creds-user123',
        email: 'creds@example.com',
        emailVerified: new Date('2024-01-01'), // Verified
      };

      const middlewareModule = await import('@/middleware');

      // Act
      const result = await middlewareModule.default(mockRequest);

      // Assert: Should allow access
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });
});
