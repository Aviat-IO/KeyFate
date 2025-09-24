/**
 * TASK 1.3: USER FLOW INTEGRATION TEST
 *
 * This test validates the complete user flow for email verification
 * enforcement including user experience scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserById } from '@/lib/auth/users';

// Mock dependencies
vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));
vi.mock('@/lib/auth/users', () => ({ getUserById: vi.fn() }));
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: { redirect: vi.fn(), next: vi.fn() }
}));

const mockGetToken = getToken as any;
const mockGetUserById = getUserById as any;

describe('TASK 1.3: Complete User Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue({ type: 'redirect' }),
      next: vi.fn().mockReturnValue({ type: 'next' })
    };
    Object.assign(NextResponse, mockNextResponseMethods);
  });

  describe('User Journey: New email/password user', () => {
    it('should complete the verification enforcement flow', async () => {
      // Scenario: New user signs up with email/password, tries to access dashboard
      // Expected: Redirected to email verification page

      const mockToken = {
        id: 'new-user-123',
        sub: 'new-user-123',
        email: 'newuser@example.com'
      };

      const mockUser = {
        id: 'new-user-123',
        email: 'newuser@example.com',
        name: 'New User',
        emailVerified: null, // New users start unverified
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockSearchParams = { set: vi.fn() };
      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'https://example.com/dashboard',
          clone: () => ({
            pathname: '/auth/verify-email',
            searchParams: mockSearchParams
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act: User tries to access dashboard
      const result = await middleware(mockRequest);

      // Assert: Complete flow validation
      expect(mockGetUserById).toHaveBeenCalledWith('new-user-123');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(mockSearchParams.set).toHaveBeenCalledWith('callbackUrl', 'https://example.com/dashboard');
      expect(mockSearchParams.set).toHaveBeenCalledWith('error', 'Please verify your email address to continue');
      expect(result).toEqual({ type: 'redirect' });
    });
  });

  describe('User Journey: Google OAuth user', () => {
    it('should allow immediate access for verified OAuth user', async () => {
      // Scenario: User signs in with Google (auto-verified), accesses dashboard
      // Expected: Immediate access granted

      const mockToken = {
        id: 'google-user-456',
        sub: 'google-user-456',
        email: 'google@example.com'
      };

      const mockUser = {
        id: 'google-user-456',
        email: 'google@example.com',
        name: 'Google User',
        emailVerified: new Date(), // Google users are auto-verified
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

      // Act: OAuth user accesses dashboard
      const result = await middleware(mockRequest);

      // Assert: Immediate access granted
      expect(mockGetUserById).toHaveBeenCalledWith('google-user-456');
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toEqual({ type: 'next' });
    });
  });

  describe('User Journey: Previously verified user', () => {
    it('should allow access for user who completed verification', async () => {
      // Scenario: User who previously verified their email accesses protected route
      // Expected: Access granted

      const mockToken = {
        id: 'verified-user-789',
        sub: 'verified-user-789',
        email: 'verified@example.com'
      };

      const mockUser = {
        id: 'verified-user-789',
        email: 'verified@example.com',
        name: 'Verified User',
        emailVerified: new Date('2024-01-15'), // Previously verified
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const mockRequest = {
        nextUrl: {
          pathname: '/secrets',
          href: 'https://example.com/secrets'
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act: Verified user accesses protected route
      const result = await middleware(mockRequest);

      // Assert: Access granted
      expect(mockGetUserById).toHaveBeenCalledWith('verified-user-789');
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(result).toEqual({ type: 'next' });
    });
  });

  describe('User Journey: Verification page access', () => {
    it('should allow unverified users to access verification page and APIs', async () => {
      // Scenario: Unverified user needs to access verification page and related APIs
      // Expected: Access granted to verification resources

      const verificationPaths = [
        '/auth/verify-email',
        '/api/auth/resend-verification',
        '/api/auth/verify-email',
        '/api/auth/verification-status'
      ];

      for (const pathname of verificationPaths) {
        vi.clearAllMocks();

        const mockToken = {
          id: 'unverified-user',
          sub: 'unverified-user',
          email: 'unverified@example.com'
        };

        if (pathname.startsWith('/api/')) {
          // For API routes, we only need the token check
          mockGetToken.mockResolvedValue(mockToken);
        } else {
          // For page routes, no token check needed (public)
          mockGetToken.mockResolvedValue(null);
        }

        const mockRequest = {
          nextUrl: {
            pathname,
            href: `https://example.com${pathname}`
          }
        } as unknown as NextRequest;

        const { middleware } = await import('@/middleware');

        // Act: Access verification resources
        const result = await middleware(mockRequest);

        // Assert: Access granted
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        expect(result).toEqual({ type: 'next' });

        // Should not query database for verification routes
        expect(mockGetUserById).not.toHaveBeenCalled();
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle session/database synchronization issues', async () => {
      // Scenario: User has valid session but is not in database (rare edge case)
      // Expected: Redirect to login for security

      const mockToken = {
        id: 'orphaned-session-user',
        sub: 'orphaned-session-user',
        email: 'orphaned@example.com'
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(null); // User not found in database

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

      // Act: Orphaned session tries to access protected route
      const result = await middleware(mockRequest);

      // Assert: Redirect to login for security
      expect(mockGetUserById).toHaveBeenCalledWith('orphaned-session-user');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toEqual({ type: 'redirect' });
    });

    it('should handle database errors gracefully', async () => {
      // Scenario: Database error during user lookup
      // Expected: Redirect to login for security

      const mockToken = {
        id: 'user-123',
        sub: 'user-123',
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
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest;

      const { middleware } = await import('@/middleware');

      // Act: User access during database error
      const result = await middleware(mockRequest);

      // Assert: Secure fallback to login
      expect(mockGetUserById).toHaveBeenCalledWith('user-123');
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toEqual({ type: 'redirect' });
    });
  });

  describe('Route Coverage', () => {
    it('should protect all application routes consistently', async () => {
      // Scenario: Verify enforcement across all protected routes
      // Expected: Consistent behavior across application

      const protectedRoutes = [
        '/dashboard',
        '/secrets',
        '/secrets/create',
        '/secrets/123',
        '/profile',
        '/settings'
      ];

      const mockToken = {
        id: 'unverified-user',
        sub: 'unverified-user',
        email: 'unverified@example.com'
      };

      const mockUser = {
        id: 'unverified-user',
        email: 'unverified@example.com',
        name: 'Unverified User',
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      for (const route of protectedRoutes) {
        vi.clearAllMocks();

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

        // Act: Access each protected route
        const result = await middleware(mockRequest);

        // Assert: Consistent enforcement
        expect(mockGetUserById).toHaveBeenCalledWith('unverified-user');
        expect(NextResponse.redirect).toHaveBeenCalled();
        expect(result).toEqual({ type: 'redirect' });
      }
    });
  });
});