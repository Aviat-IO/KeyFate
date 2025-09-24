import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

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

describe('Middleware Email Verification Integration Tests', () => {
  let mockGetToken: any;
  let mockGetUserById: any;
  let mockRedirectResponse: any;
  let mockNextResponse: any;
  let consoleLogSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamic import to get fresh mocks
    const { getToken } = await import('next-auth/jwt');
    const { getUserById } = await import('@/lib/auth/users');

    mockGetToken = getToken as any;
    mockGetUserById = getUserById as any;

    mockRedirectResponse = { type: 'redirect' };
    mockNextResponse = { type: 'next' };

    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue(mockRedirectResponse),
      next: vi.fn().mockReturnValue(mockNextResponse)
    };

    Object.assign(NextResponse, mockNextResponseMethods);

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should enforce email verification for new credential users', async () => {
    // Arrange: New user created via email/password (unverified)
    const mockToken = {
      id: 'new-user-123',
      sub: 'new-user-123',
      email: 'newuser@example.com'
    };

    const mockUser = {
      id: 'new-user-123',
      email: 'newuser@example.com',
      name: 'New User',
      emailVerified: null, // New users should be unverified
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
    expect(mockGetUserById).toHaveBeenCalledWith('new-user-123');
    expect(NextResponse.redirect).toHaveBeenCalled();
    expect(result).toBe(mockRedirectResponse);

    // Verify the logs show email verification check
    const logs = consoleLogSpy.mock.calls.map(call => call[0]);
    expect(logs.some(log => log.includes('User email not verified'))).toBe(true);
  });

  it('should allow Google OAuth users (auto-verified) to access protected routes', async () => {
    // Arrange: Google OAuth user (auto-verified)
    const mockToken = {
      id: 'google-user-456',
      sub: 'google-user-456',
      email: 'googleuser@example.com'
    };

    const mockUser = {
      id: 'google-user-456',
      email: 'googleuser@example.com',
      name: 'Google User',
      emailVerified: new Date(), // Google OAuth users are auto-verified
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
    expect(mockGetUserById).toHaveBeenCalledWith('google-user-456');
    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toBe(mockNextResponse);

    // Verify the logs show successful access
    const logs = consoleLogSpy.mock.calls.map(call => call[0]);
    expect(logs.some(log => log.includes('Authenticated and verified access'))).toBe(true);
  });

  it('should allow verified credential users to access protected routes', async () => {
    // Arrange: Email/password user who has completed verification
    const mockToken = {
      id: 'verified-user-789',
      sub: 'verified-user-789',
      email: 'verified@example.com'
    };

    const mockUser = {
      id: 'verified-user-789',
      email: 'verified@example.com',
      name: 'Verified User',
      emailVerified: new Date(), // User has completed email verification
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockGetToken.mockResolvedValue(mockToken);
    mockGetUserById.mockResolvedValue(mockUser);

    const mockRequest = {
      nextUrl: {
        pathname: '/settings',
        href: 'https://example.com/settings'
      }
    } as unknown as NextRequest;

    const { middleware } = await import('@/middleware');

    // Act
    const result = await middleware(mockRequest);

    // Assert
    expect(mockGetUserById).toHaveBeenCalledWith('verified-user-789');
    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toBe(mockNextResponse);

    // Verify the logs show successful access
    const logs = consoleLogSpy.mock.calls.map(call => call[0]);
    expect(logs.some(log => log.includes('Authenticated and verified access'))).toBe(true);
  });

  it('should allow access to verification page for unverified users', async () => {
    // Arrange: Unverified user accessing verification page
    const mockToken = {
      id: 'unverified-user-999',
      sub: 'unverified-user-999',
      email: 'unverified@example.com'
    };

    const mockRequest = {
      nextUrl: {
        pathname: '/auth/verify-email',
        href: 'https://example.com/auth/verify-email'
      }
    } as unknown as NextRequest;

    mockGetToken.mockResolvedValue(mockToken);

    const { middleware } = await import('@/middleware');

    // Act
    const result = await middleware(mockRequest);

    // Assert
    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toBe(mockNextResponse);

    // Should not check user verification for public routes
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it('should redirect unverified users with proper callback URL', async () => {
    // Arrange: Unverified user trying to access protected route
    const mockToken = {
      id: 'unverified-user-000',
      sub: 'unverified-user-000',
      email: 'unverified@example.com'
    };

    const mockUser = {
      id: 'unverified-user-000',
      email: 'unverified@example.com',
      name: 'Unverified User',
      emailVerified: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockGetToken.mockResolvedValue(mockToken);
    mockGetUserById.mockResolvedValue(mockUser);

    const searchParamsMock = {
      set: vi.fn()
    };

    const mockRequest = {
      nextUrl: {
        pathname: '/secrets',
        href: 'https://example.com/secrets',
        clone: () => ({
          pathname: '/auth/verify-email',
          searchParams: searchParamsMock
        })
      }
    } as unknown as NextRequest;

    const { middleware } = await import('@/middleware');

    // Act
    const result = await middleware(mockRequest);

    // Assert
    expect(mockGetUserById).toHaveBeenCalledWith('unverified-user-000');
    expect(NextResponse.redirect).toHaveBeenCalled();
    expect(result).toBe(mockRedirectResponse);

    // Verify callback URL is set
    expect(searchParamsMock.set).toHaveBeenCalledWith('callbackUrl', 'https://example.com/secrets');
    expect(searchParamsMock.set).toHaveBeenCalledWith('error', 'Please verify your email address to continue');
  });
});