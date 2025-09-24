/**
 * TASK 1.3: EMAIL VERIFICATION ENFORCEMENT - COMPREHENSIVE VALIDATION
 *
 * This test validates that the authentication middleware properly enforces
 * email verification for all users accessing protected routes.
 *
 * Requirements verified:
 * 1. Update the authentication middleware to check if user's email is verified
 * 2. Redirect unverified users to the email verification page
 * 3. Allow verified users to access protected routes
 * 4. Ensure this works for both OAuth and email/password authentication
 * 5. Add proper error messages and user feedback
 */

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

describe('TASK 1.3: Email Verification Enforcement - Complete Implementation', () => {
  let mockRedirectResponse: any;
  let mockNextResponse: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedirectResponse = { type: 'redirect' };
    mockNextResponse = { type: 'next' };

    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue(mockRedirectResponse),
      next: vi.fn().mockReturnValue(mockNextResponse)
    };

    Object.assign(NextResponse, mockNextResponseMethods);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('REQUIREMENT 1: Check user email verification status from database', () => {
    it('should query database for user verification status on protected routes', async () => {
      // Arrange: User with valid session
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date(),
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
      await middleware(mockRequest);

      // Assert: Database was queried for user verification status
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(mockGetUserById).toHaveBeenCalledTimes(1);
    });

    it('should not query database for public routes', async () => {
      // Arrange: User accessing public route
      const mockRequest = {
        nextUrl: {
          pathname: '/auth/verify-email',
          href: 'https://example.com/auth/verify-email'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      await middleware(mockRequest);

      // Assert: No database query for public routes
      expect(mockGetUserById).not.toHaveBeenCalled();
    });
  });

  describe('REQUIREMENT 2: Redirect unverified users to verification page', () => {
    it('should redirect unverified users to /auth/verify-email', async () => {
      // Arrange: Unverified user
      const mockToken = {
        id: 'unverified123',
        sub: 'unverified123',
        email: 'unverified@example.com'
      };

      const mockUser = {
        id: 'unverified123',
        email: 'unverified@example.com',
        name: 'Unverified User',
        emailVerified: null, // NOT VERIFIED
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockClonedUrl = {
        pathname: '/auth/verify-email',
        searchParams: {
          set: vi.fn()
        }
      };

      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => mockClonedUrl
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert: Redirected to verification page
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);

      // Assert: Proper callback URL and error message set
      expect(mockClonedUrl.searchParams.set).toHaveBeenCalledWith('callbackUrl', 'https://example.com/dashboard');
      expect(mockClonedUrl.searchParams.set).toHaveBeenCalledWith('error', 'Please verify your email address to continue');
    });

    it('should redirect unverified users for all protected routes', async () => {
      const protectedRoutes = ['/dashboard', '/secrets', '/profile', '/settings'];

      for (const route of protectedRoutes) {
        vi.clearAllMocks();

        const mockToken = {
          id: 'unverified123',
          sub: 'unverified123',
          email: 'unverified@example.com'
        };

        const mockUser = {
          id: 'unverified123',
          email: 'unverified@example.com',
          name: 'Unverified User',
          emailVerified: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockGetToken.mockResolvedValue(mockToken);
        mockGetUserById.mockResolvedValue(mockUser);

        const mockRequest = {
          nextUrl: {
            pathname: route,
            href: `https://example.com${route}`,
            clone: () => ({
              pathname: '/auth/verify-email',
              searchParams: { set: vi.fn() }
            })
          }
        } as unknown as NextRequest;

        const { middleware } = await import('@/middleware');

        // Act
        const result = await middleware(mockRequest);

        // Assert
        expect(NextResponse.redirect).toHaveBeenCalled();
        expect(result).toBe(mockRedirectResponse);
      }
    });
  });

  describe('REQUIREMENT 3: Allow verified users to access protected routes', () => {
    it('should allow verified users to access dashboard', async () => {
      // Arrange: Verified user
      const mockToken = {
        id: 'verified123',
        sub: 'verified123',
        email: 'verified@example.com'
      };

      const mockUser = {
        id: 'verified123',
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

      // Assert: Access granted
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    it('should allow verified users to access all protected routes', async () => {
      const protectedRoutes = ['/dashboard', '/secrets', '/profile', '/settings'];

      for (const route of protectedRoutes) {
        vi.clearAllMocks();

        const mockToken = {
          id: 'verified123',
          sub: 'verified123',
          email: 'verified@example.com'
        };

        const mockUser = {
          id: 'verified123',
          email: 'verified@example.com',
          name: 'Verified User',
          emailVerified: new Date(),
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

        // Assert: Access granted to all protected routes
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        expect(result).toBe(mockNextResponse);
      }
    });
  });

  describe('REQUIREMENT 4: Support both OAuth and email/password authentication', () => {
    it('should enforce verification for Google OAuth users', async () => {
      // Arrange: Google OAuth user (should be auto-verified)
      const mockToken = {
        id: 'google-user123',
        sub: 'google-user123',
        email: 'google@example.com'
      };

      const mockUser = {
        id: 'google-user123',
        email: 'google@example.com',
        name: 'Google User',
        emailVerified: new Date(), // Google users auto-verified
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

      // Assert: Access granted for verified OAuth user
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    it('should enforce verification for email/password users', async () => {
      // Arrange: Email/password user (unverified)
      const mockToken = {
        id: 'email-user123',
        sub: 'email-user123',
        email: 'email@example.com'
      };

      const mockUser = {
        id: 'email-user123',
        email: 'email@example.com',
        name: 'Email User',
        emailVerified: null, // Email users need verification
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
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert: Redirected for unverified email user
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });
  });

  describe('REQUIREMENT 5: Proper error messages and user feedback', () => {
    it('should include appropriate error message in redirect URL', async () => {
      // Arrange: Unverified user
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'User',
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockSetSearchParams = vi.fn();
      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => ({
            pathname: '/auth/verify-email',
            searchParams: { set: mockSetSearchParams }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      await middleware(mockRequest);

      // Assert: Proper error message set
      expect(mockSetSearchParams).toHaveBeenCalledWith('error', 'Please verify your email address to continue');
    });

    it('should preserve callback URL for post-verification redirect', async () => {
      // Arrange: Unverified user
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'User',
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockSetSearchParams = vi.fn();
      const originalUrl = 'https://example.com/secrets/important';

      const mockRequest = {
        nextUrl: {
          pathname: '/secrets/important',
          href: originalUrl,
          clone: () => ({
            pathname: '/auth/verify-email',
            searchParams: { set: mockSetSearchParams }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      await middleware(mockRequest);

      // Assert: Callback URL preserved
      expect(mockSetSearchParams).toHaveBeenCalledWith('callbackUrl', originalUrl);
    });

    it('should log appropriate verification status information', async () => {
      // Arrange: User verification check
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'User',
        emailVerified: new Date('2024-01-01'),
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
      await middleware(mockRequest);

      // Assert: Verification status logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Middleware] Email verification status:',
        expect.objectContaining({
          userId: 'user123',
          email: 'user@example.com',
          isEmailVerified: true
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle users not found in database', async () => {
      // Arrange: Valid token but user not in database
      const mockToken = {
        id: 'missing123',
        sub: 'missing123',
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
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert: Redirect to login
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    it('should handle undefined emailVerified field correctly', async () => {
      // Arrange: User with undefined emailVerified
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'User',
        // emailVerified is undefined
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
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert: Treat undefined as unverified
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });
  });

  describe('Performance and Functionality', () => {
    it('should allow access to verification-related API routes for unverified users', async () => {
      // Arrange: Unverified user accessing verification API
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      mockGetToken.mockResolvedValue(mockToken);

      const verificationRoutes = [
        '/api/auth/resend-verification',
        '/api/auth/verify-email',
        '/api/auth/verification-status'
      ];

      for (const route of verificationRoutes) {
        vi.clearAllMocks();

        const mockRequest = {
          nextUrl: {
            pathname: route,
            href: `https://example.com${route}`
          }
        } as unknown as NextRequest;

        const { middleware } = await import('@/middleware');

        // Act
        const result = await middleware(mockRequest);

        // Assert: Access granted to verification routes
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        expect(result).toBe(mockNextResponse);

        // Should not query database for verification routes
        expect(mockGetUserById).not.toHaveBeenCalled();
      }
    });
  });
});