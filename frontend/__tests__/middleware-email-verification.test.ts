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
    next: vi.fn()
  }
}));

const mockGetToken = getToken as any;
const mockGetUserById = getUserById as any;

describe('Middleware Email Verification Enforcement', () => {
  let mockRedirectResponse: any;
  let mockNextResponse: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedirectResponse = { type: 'redirect' };
    mockNextResponse = { type: 'next' };

    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue(mockRedirectResponse),
      next: vi.fn().mockReturnValue(mockNextResponse)
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

  describe('Email Verification Enforcement', () => {
    it('should redirect unverified users to email verification page', async () => {
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
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => ({
            pathname: '/auth/verify-email',
            searchParams: {
              set: vi.fn()
            }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);

      // Verify redirect was to email verification page
      const redirectCall = (NextResponse.redirect as any).mock.calls[0];
      expect(redirectCall).toBeDefined();
    });

    it('should allow verified users to access protected routes', async () => {
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
          pathname: '/dashboard',
          href: 'https://example.com/dashboard'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    it('should handle Google OAuth users (automatically verified)', async () => {
      // Arrange: Google OAuth user should be auto-verified
      const mockToken = {
        id: 'google-user-123',
        sub: 'google-user-123',
        email: 'google@example.com'
      };

      const mockUser = {
        id: 'google-user-123',
        email: 'google@example.com',
        name: 'Google User',
        emailVerified: new Date(), // Google users should be auto-verified
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'https://example.com/dashboard'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('google-user-123');
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    it('should handle email/password users requiring verification', async () => {
      // Arrange: Email/password user that should require verification
      const mockToken = {
        id: 'email-user-123',
        sub: 'email-user-123',
        email: 'emailuser@example.com'
      };

      const mockUser = {
        id: 'email-user-123',
        email: 'emailuser@example.com',
        name: 'Email User',
        emailVerified: null, // Should require verification for email/password users
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockRequest = {
        nextUrl: {
          pathname: '/settings',
          href: 'https://example.com/settings',
          clone: () => ({
            pathname: '/auth/verify-email',
            searchParams: {
              set: vi.fn()
            }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('email-user-123');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange: Database error during user lookup
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockRejectedValue(new Error('Database connection failed'));

      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => ({
            pathname: '/sign-in',
            searchParams: {
              set: vi.fn()
            }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Middleware] Database error during user lookup:'),
        expect.any(Error)
      );
    });

    it('should handle user not found in database', async () => {
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
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => ({
            pathname: '/sign-in',
            searchParams: {
              set: vi.fn()
            }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('missing-user-123');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Middleware] User not found in database, redirecting to login'
      );
    });

    it('should handle missing user ID in token', async () => {
      // Arrange: Token without user ID
      const mockToken = {
        email: 'user@example.com',
        // Missing both id and sub
      };

      mockGetToken.mockResolvedValue(mockToken);

      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => ({
            pathname: '/sign-in',
            searchParams: {
              set: vi.fn()
            }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).not.toHaveBeenCalled();
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Middleware] No user ID found in token, redirecting to login'
      );
    });
  });

  describe('Public Route Handling', () => {
    it('should allow unverified users to access public routes', async () => {
      // Public routes should always be accessible
      const publicRoutes = ['/', '/sign-in', '/auth/signup', '/auth/error', '/auth/verify-email'];

      for (const pathname of publicRoutes) {
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
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        expect(result).toBe(mockNextResponse);

        // Should not check user verification for public routes
        expect(mockGetUserById).not.toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined emailVerified field gracefully', async () => {
      // Arrange: User with undefined emailVerified field
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'User',
        // emailVerified field is undefined
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => ({
            pathname: '/auth/verify-email',
            searchParams: {
              set: vi.fn()
            }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });
  });
});