/**
 * Test Suite: Email Verification Enforcement Middleware
 * Task 1.3: Update Authentication Middleware to Enforce Email Verification
 *
 * This test suite verifies that:
 * 1. Middleware checks user email verification status from database
 * 2. Unverified users are redirected to verification flow
 * 3. Verified users can access protected routes normally
 * 4. Works with both Google OAuth and credentials authentication
 * 5. Handles edge cases where verification status might be undefined
 * 6. Provides clear feedback about verification requirements
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
    next: vi.fn()
  }
}));

const mockGetToken = getToken as any;
const mockGetUserById = getUserById as any;

describe('Email Verification Enforcement Middleware - TDD Implementation', () => {
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

    // Properly mock NextResponse static methods
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

  describe('RED PHASE: Write Failing Tests First', () => {
    // TEST 1: Middleware should check email verification status from database
    it('should check user email verification status from database for authenticated users', async () => {
      // Arrange - authenticated user with token
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User in database with verified email
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/dashboard';

      // Import middleware after mocking
      const { middleware } = await import('@/middleware');

      // Act
      await middleware(mockRequest);

      // Assert - should have checked database for user verification status
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
    });

    // TEST 2: Unverified users should be redirected to verification flow
    it('should redirect unverified users to email verification page', async () => {
      // Arrange - authenticated user but not email verified
      const mockToken = {
        sub: 'user123',
        email: 'unverified@example.com',
        name: 'Unverified User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User in database without email verification
      const mockUser = {
        id: 'user123',
        email: 'unverified@example.com',
        name: 'Unverified User',
        emailVerified: null, // Not verified
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should redirect to verification page
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    // TEST 3: Verified users should access protected routes normally
    it('should allow verified users to access protected routes', async () => {
      // Arrange - authenticated and verified user
      const mockToken = {
        sub: 'user123',
        email: 'verified@example.com',
        name: 'Verified User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User in database with email verification
      const mockUser = {
        id: 'user123',
        email: 'verified@example.com',
        name: 'Verified User',
        emailVerified: new Date('2024-01-01'), // Verified
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should allow access
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    // TEST 4: Should work with Google OAuth users (who get verified during sign-in)
    it('should allow Google OAuth users who were verified during sign-in', async () => {
      // Arrange - Google OAuth user (verified during sign-in process)
      const mockToken = {
        sub: 'google-user123',
        email: 'google@example.com',
        name: 'Google User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // Google OAuth user with verification (set during OAuth flow)
      const mockUser = {
        id: 'google-user123',
        email: 'google@example.com',
        name: 'Google User',
        emailVerified: new Date('2024-01-01'), // Verified via Google OAuth
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/secrets';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should allow access
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    // TEST 5: Should work with credentials users who auto-verify
    it('should allow credentials users who auto-verify during registration', async () => {
      // Arrange - credentials user (auto-verified during registration)
      const mockToken = {
        sub: 'creds-user123',
        email: 'creds@example.com',
        name: 'Credentials User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // Credentials user with auto-verification
      const mockUser = {
        id: 'creds-user123',
        email: 'creds@example.com',
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

      // Assert - should allow access
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    // TEST 6: Handle edge case where user not found in database
    it('should handle case where authenticated user is not found in database', async () => {
      // Arrange - valid token but user not in database
      const mockToken = {
        sub: 'missing-user123',
        email: 'missing@example.com',
        name: 'Missing User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User not found in database
      mockGetUserById.mockResolvedValue(null);

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should redirect to login (treat as unauthenticated)
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    // TEST 7: Handle edge case where emailVerified is undefined
    it('should handle case where emailVerified field is undefined', async () => {
      // Arrange - user with undefined emailVerified
      const mockToken = {
        sub: 'undefined-user123',
        email: 'undefined@example.com',
        name: 'Undefined User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // User with undefined email verification status
      const mockUser = {
        id: 'undefined-user123',
        email: 'undefined@example.com',
        name: 'Undefined User',
        emailVerified: undefined, // Undefined verification status
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should redirect to verification (treat as unverified)
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    // TEST 8: Should not check verification for public routes
    it('should not check email verification for public routes', async () => {
      // Arrange - user on public route
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      mockRequest.nextUrl.pathname = '/'; // Public route

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should not check database and allow access
      expect(mockGetUserById).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    // TEST 9: Should not check verification for auth routes
    it('should not check email verification for auth routes', async () => {
      // Arrange - user on auth route
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      mockRequest.nextUrl.pathname = '/api/auth/callback/google';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should not check database and allow access
      expect(mockGetUserById).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });

    // TEST 10: Should redirect with proper verification error message
    it('should redirect to verification page with proper error message', async () => {
      // Arrange - unverified user
      const mockToken = {
        sub: 'user123',
        email: 'unverified@example.com',
        name: 'Unverified User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      const mockUser = {
        id: 'user123',
        email: 'unverified@example.com',
        name: 'Unverified User',
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/dashboard';

      // Mock clone to return a proper URL object
      const mockClonedUrl = {
        pathname: '/auth/verify-email',
        searchParams: {
          set: vi.fn()
        }
      };
      mockRequest.nextUrl.clone = vi.fn().mockReturnValue(mockClonedUrl);

      const { middleware } = await import('@/middleware');

      // Act
      await middleware(mockRequest);

      // Assert - should set proper error parameters
      expect(mockClonedUrl.searchParams.set).toHaveBeenCalledWith(
        'error',
        'Please verify your email address to continue'
      );
      expect(mockClonedUrl.searchParams.set).toHaveBeenCalledWith(
        'callbackUrl',
        'http://localhost:3000/dashboard'
      );
    });

    // TEST 11: Handle database errors gracefully
    it('should handle database errors gracefully', async () => {
      // Arrange - database error during user lookup
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      // Database error
      mockGetUserById.mockRejectedValue(new Error('Database connection failed'));

      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should redirect to login on database error (fail safely)
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    // TEST 12: Performance - should not make unnecessary database calls
    it('should not make database calls for unauthenticated users', async () => {
      // Arrange - no token (unauthenticated)
      mockGetToken.mockResolvedValue(null);
      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      await middleware(mockRequest);

      // Assert - should not check database for unauthenticated users
      expect(mockGetUserById).not.toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    // TEST 13: End-to-end flow for unverified user
    it('should complete full flow for unverified user attempting to access protected route', async () => {
      // Arrange - full flow simulation
      const mockToken = {
        sub: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: null, // Unverified
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/secrets/create';
      mockRequest.nextUrl.href = 'http://localhost:3000/secrets/create';

      const mockClonedUrl = {
        pathname: '/auth/verify-email',
        searchParams: {
          set: vi.fn()
        }
      };
      mockRequest.nextUrl.clone = vi.fn().mockReturnValue(mockClonedUrl);

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - complete flow verification
      expect(mockGetToken).toHaveBeenCalled();
      expect(mockGetUserById).toHaveBeenCalledWith('user123');
      expect(mockClonedUrl.searchParams.set).toHaveBeenCalledWith(
        'callbackUrl',
        'http://localhost:3000/secrets/create'
      );
      expect(mockClonedUrl.searchParams.set).toHaveBeenCalledWith(
        'error',
        'Please verify your email address to continue'
      );
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
    });

    // TEST 14: End-to-end flow for verified user
    it('should complete full flow for verified user accessing protected route', async () => {
      // Arrange - verified user flow
      const mockToken = {
        sub: 'verified-user123',
        email: 'verified@example.com',
        name: 'Verified User'
      };
      mockGetToken.mockResolvedValue(mockToken);

      const mockUser = {
        id: 'verified-user123',
        email: 'verified@example.com',
        name: 'Verified User',
        emailVerified: new Date('2024-01-01'), // Verified
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockGetUserById.mockResolvedValue(mockUser);

      mockRequest.nextUrl.pathname = '/secrets';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should allow full access
      expect(mockGetToken).toHaveBeenCalled();
      expect(mockGetUserById).toHaveBeenCalledWith('verified-user123');
      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
    });
  });

  describe('Backwards Compatibility', () => {
    // TEST 15: Should maintain existing behavior for unauthenticated users
    it('should maintain existing redirect behavior for unauthenticated users', async () => {
      // Arrange - no token
      mockGetToken.mockResolvedValue(null);
      mockRequest.nextUrl.pathname = '/dashboard';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should redirect to sign-in (existing behavior)
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(result).toBe(mockRedirectResponse);
      expect(mockGetUserById).not.toHaveBeenCalled();
    });

    // TEST 16: Should maintain existing behavior for public routes
    it('should maintain existing behavior for public routes', async () => {
      // Arrange - public route access
      mockGetToken.mockResolvedValue(null);
      mockRequest.nextUrl.pathname = '/';

      const { middleware } = await import('@/middleware');

      // Act
      const result = await middleware(mockRequest);

      // Assert - should allow access (existing behavior)
      expect(NextResponse.next).toHaveBeenCalled();
      expect(result).toBe(mockNextResponse);
      expect(mockGetUserById).not.toHaveBeenCalled();
    });
  });
});