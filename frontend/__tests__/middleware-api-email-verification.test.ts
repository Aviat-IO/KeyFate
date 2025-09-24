import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserById } from '@/lib/auth/users';

// Mock NextAuth JWT
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}));

// Mock getUserById function
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

describe('Middleware API Routes Email Verification', () => {
  let mockRedirectResponse: any;
  let mockNextResponse: any;
  let mockJsonResponse: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedirectResponse = { type: 'redirect' };
    mockNextResponse = { type: 'next' };
    mockJsonResponse = { type: 'json' };

    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue(mockRedirectResponse),
      next: vi.fn().mockReturnValue(mockNextResponse),
      json: vi.fn().mockReturnValue(mockJsonResponse)
    };

    Object.assign(NextResponse, mockNextResponseMethods);

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('API Routes Email Verification Enforcement', () => {
    it('should return 403 JSON for unverified users accessing protected API routes', async () => {
      // Arrange: User with valid session but unverified email
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'unverified@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'unverified@example.com',
        name: 'Unverified User',
        emailVerified: null, // NOT VERIFIED
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockRequest = {
        nextUrl: {
          pathname: '/api/secrets',
          href: 'https://example.com/api/secrets'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: 'Please verify your email address to continue',
          code: 'EMAIL_NOT_VERIFIED'
        },
        { status: 403 }
      );
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockJsonResponse);
    });

    it('should return 200/next for verified users accessing protected API routes', async () => {
      // Arrange: User with valid session and verified email
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'verified@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'verified@example.com',
        name: 'Verified User',
        emailVerified: new Date(), // VERIFIED
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockRequest = {
        nextUrl: {
          pathname: '/api/secrets',
          href: 'https://example.com/api/secrets'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.json).not.toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    it('should return 401 JSON for unauthenticated users accessing protected API routes', async () => {
      // Arrange: No token (unauthenticated)
      mockGetToken.mockResolvedValue(null);

      const mockRequest = {
        nextUrl: {
          pathname: '/api/secrets',
          href: 'https://example.com/api/secrets'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: 'Please sign in to continue',
          code: 'UNAUTHENTICATED'
        },
        { status: 401 }
      );
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockJsonResponse);
    });

    it('should allow access to verification-related API routes for authenticated users', async () => {
      // Arrange: Unverified user accessing verification API
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'unverified@example.com'
      };

      mockGetToken.mockResolvedValue(mockToken);

      const verificationRoutes = [
        '/api/auth/resend-verification',
        '/api/auth/verify-email',
        '/api/auth/verification-status'
      ];

      for (const pathname of verificationRoutes) {
        vi.clearAllMocks();

        const mockRequest = {
          nextUrl: {
            pathname,
            href: `https://example.com${pathname}`
          }
        } as unknown as NextRequest;

        const { middleware } = await import('@/middleware');

        // Act
        const result = await middleware(mockRequest);

        // Assert
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.json).not.toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        expect(result).toBe(mockNextResponse);

        // Should not check user verification for verification routes
        expect(mockGetUserById).not.toHaveBeenCalled();
      }
    });

    it('should allow access to NextAuth API routes without verification check', async () => {
      // Public NextAuth API routes should always be accessible
      const nextAuthRoutes = [
        '/api/auth/signin',
        '/api/auth/signout',
        '/api/auth/callback/google',
        '/api/auth/providers',
        '/api/auth/session',
        '/api/auth/csrf'
      ];

      for (const pathname of nextAuthRoutes) {
        vi.clearAllMocks();

        const mockRequest = {
          nextUrl: {
            pathname,
            href: `https://example.com${pathname}`
          }
        } as unknown as NextRequest;

        const { middleware } = await import('@/middleware');

        // Act
        const result = await middleware(mockRequest);

        // Assert
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.json).not.toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        expect(result).toBe(mockNextResponse);

        // Should not check auth or verification for NextAuth routes
        expect(mockGetUserById).not.toHaveBeenCalled();
      }
    });

    it('should return 403 JSON with correct error code for API routes', async () => {
      // Arrange: Database error during user lookup for API route
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockRejectedValue(new Error('Database connection failed'));

      const mockRequest = {
        nextUrl: {
          pathname: '/api/secrets',
          href: 'https://example.com/api/secrets'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: 'Authentication error occurred',
          code: 'UNAUTHENTICATED'
        },
        { status: 401 }
      );
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockJsonResponse);
    });

    it('should return 401 JSON when user not found in database for API route', async () => {
      // Arrange: Valid token but user not in database
      const mockToken = {
        id: 'missing-user-123',
        sub: 'missing-user-123',
        email: 'missing@example.com'
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(null); // User not found

      const mockRequest = {
        nextUrl: {
          pathname: '/api/secrets',
          href: 'https://example.com/api/secrets'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('missing-user-123');
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: 'User not found',
          code: 'UNAUTHENTICATED'
        },
        { status: 401 }
      );
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockJsonResponse);
    });

    it('should return 401 JSON when token has no user ID for API route', async () => {
      // Arrange: Token without user ID
      const mockToken = {
        email: 'user@example.com',
        // Missing both id and sub
      };

      mockGetToken.mockResolvedValue(mockToken);

      const mockRequest = {
        nextUrl: {
          pathname: '/api/secrets',
          href: 'https://example.com/api/secrets'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: 'Invalid session',
          code: 'UNAUTHENTICATED'
        },
        { status: 401 }
      );
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockJsonResponse);
    });
  });

  describe('Protected API Routes Coverage', () => {
    const protectedApiRoutes = [
      '/api/secrets',
      '/api/secrets/123',
      '/api/secrets/123/check-in',
      '/api/secrets/123/toggle-pause',
      '/api/user/profile',
      '/api/user/settings'
    ];

    protectedApiRoutes.forEach(route => {
      it(`should enforce email verification for protected API route: ${route}`, async () => {
        // Arrange: Unverified user
        const mockToken = {
          id: 'user123',
          sub: 'user123',
          email: 'unverified@example.com'
        };

        const mockUser = {
          id: 'user123',
          email: 'unverified@example.com',
          name: 'Unverified User',
          emailVerified: null, // NOT VERIFIED
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockGetToken.mockResolvedValue(mockToken);
        mockGetUserById.mockResolvedValue(mockUser);

        const mockRequest = {
          nextUrl: {
            pathname: route,
            href: `https://example.com${route}`
          }
        } as unknown as NextRequest;

        const { middleware } = await import('@/middleware');

        // Act
        const result = await middleware(mockRequest);

        // Assert
        expect(NextResponse.json).toHaveBeenCalledWith(
          {
            error: 'Please verify your email address to continue',
            code: 'EMAIL_NOT_VERIFIED'
          },
          { status: 403 }
        );
        expect(result).toBe(mockJsonResponse);
      });
    });
  });
});