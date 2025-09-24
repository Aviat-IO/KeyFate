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

describe('Middleware Email Verification - Comprehensive E2E', () => {
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

  describe('Complete Route Protection Matrix', () => {
    // Define test scenarios
    const testScenarios = [
      {
        name: 'Public Routes - No Authentication Required',
        routes: [
          { path: '/', type: 'page' },
          { path: '/auth/login', type: 'page' },
          { path: '/auth/signup', type: 'page' },
          { path: '/auth/error', type: 'page' },
          { path: '/auth/verify-email', type: 'page' },
          { path: '/sign-in', type: 'page' },
          { path: '/api/auth/signin', type: 'api' },
          { path: '/api/auth/callback/google', type: 'api' },
          { path: '/api/auth/providers', type: 'api' }
        ],
        authRequired: false,
        verificationRequired: false,
        expectedBehavior: 'Allow access regardless of authentication status'
      },
      {
        name: 'Verification Routes - Public Routes (handled internally)',
        routes: [
          { path: '/api/auth/resend-verification', type: 'api' },
          { path: '/api/auth/verify-email', type: 'api' },
          { path: '/api/auth/verification-status', type: 'api' }
        ],
        authRequired: false,
        verificationRequired: false,
        expectedBehavior: 'Allow access regardless of auth (routes handle authentication internally)'
      },
      {
        name: 'Protected Routes - Full Verification Required',
        routes: [
          { path: '/dashboard', type: 'page' },
          { path: '/secrets', type: 'page' },
          { path: '/secrets/123', type: 'page' },
          { path: '/profile', type: 'page' },
          { path: '/settings', type: 'page' },
          { path: '/api/secrets', type: 'api' },
          { path: '/api/secrets/123', type: 'api' },
          { path: '/api/secrets/123/check-in', type: 'api' },
          { path: '/api/secrets/123/toggle-pause', type: 'api' }
        ],
        authRequired: true,
        verificationRequired: true,
        expectedBehavior: 'Require authentication AND email verification'
      }
    ];

    testScenarios.forEach(scenario => {
      describe(scenario.name, () => {
        scenario.routes.forEach(route => {
          if (!scenario.authRequired) {
            it(`should allow unauthenticated access to ${route.path}`, async () => {
              // Arrange: No authentication
              mockGetToken.mockResolvedValue(null);

              const mockRequest = {
                nextUrl: {
                  pathname: route.path,
                  href: `https://example.com${route.path}`
                }
              } as unknown as NextRequest;

              const { middleware } = await import('@/middleware');

              // Act
              const result = await middleware(mockRequest);

              // Assert
              expect(NextResponse.next).toHaveBeenCalled();
              expect(NextResponse.redirect).not.toHaveBeenCalled();
              expect(NextResponse.json).not.toHaveBeenCalled();
              expect(result).toBe(mockNextResponse);
              expect(mockGetUserById).not.toHaveBeenCalled();
            });
          }

          if (scenario.authRequired && !scenario.verificationRequired) {
            it(`should allow authenticated unverified users to access ${route.path}`, async () => {
              // Arrange: Authenticated but unverified user
              const mockToken = {
                id: 'user123',
                sub: 'user123',
                email: 'unverified@example.com'
              };

              mockGetToken.mockResolvedValue(mockToken);

              const mockRequest = {
                nextUrl: {
                  pathname: route.path,
                  href: `https://example.com${route.path}`
                }
              } as unknown as NextRequest;

              const { middleware } = await import('@/middleware');

              // Act
              const result = await middleware(mockRequest);

              // Assert
              expect(NextResponse.next).toHaveBeenCalled();
              expect(NextResponse.redirect).not.toHaveBeenCalled();
              expect(NextResponse.json).not.toHaveBeenCalled();
              expect(result).toBe(mockNextResponse);
              // Should not check user verification for verification routes
              expect(mockGetUserById).not.toHaveBeenCalled();
            });
          }

          if (scenario.authRequired) {
            it(`should redirect/reject unauthenticated users from ${route.path}`, async () => {
              // Arrange: No authentication
              mockGetToken.mockResolvedValue(null);

              const mockRequest = {
                nextUrl: {
                  pathname: route.path,
                  href: `https://example.com${route.path}`,
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
              if (route.type === 'api') {
                expect(NextResponse.json).toHaveBeenCalledWith(
                  {
                    error: 'Please sign in to continue',
                    code: 'UNAUTHENTICATED'
                  },
                  { status: 401 }
                );
                expect(result).toBe(mockJsonResponse);
              } else {
                expect(NextResponse.redirect).toHaveBeenCalled();
                expect(result).toBe(mockRedirectResponse);
              }
            });
          }

          if (scenario.verificationRequired) {
            it(`should redirect/reject unverified users from ${route.path}`, async () => {
              // Arrange: Authenticated but unverified user
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
                  pathname: route.path,
                  href: `https://example.com${route.path}`,
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

              if (route.type === 'api') {
                expect(NextResponse.json).toHaveBeenCalledWith(
                  {
                    error: 'Please verify your email address to continue',
                    code: 'EMAIL_NOT_VERIFIED'
                  },
                  { status: 403 }
                );
                expect(result).toBe(mockJsonResponse);
              } else {
                expect(NextResponse.redirect).toHaveBeenCalled();
                expect(result).toBe(mockRedirectResponse);
              }
            });

            it(`should allow verified users to access ${route.path}`, async () => {
              // Arrange: Authenticated and verified user
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
                  pathname: route.path,
                  href: `https://example.com${route.path}`
                }
              } as unknown as NextRequest;

              const { middleware } = await import('@/middleware');

              // Act
              const result = await middleware(mockRequest);

              // Assert
              expect(mockGetUserById).toHaveBeenCalledWith('user123');
              expect(NextResponse.next).toHaveBeenCalled();
              expect(NextResponse.redirect).not.toHaveBeenCalled();
              expect(NextResponse.json).not.toHaveBeenCalled();
              expect(result).toBe(mockNextResponse);
            });
          }
        });
      });
    });
  });

  describe('Special Cases and Edge Scenarios', () => {
    it('should redirect authenticated users away from auth routes (except verify-email)', async () => {
      // Arrange: Authenticated user on auth route
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'user@example.com'
      };

      mockGetToken.mockResolvedValue(mockToken);

      const authRoutes = ['/auth/login', '/auth/signup', '/sign-in'];

      for (const pathname of authRoutes) {
        vi.clearAllMocks();

        const mockRequest = {
          nextUrl: {
            pathname,
            href: `https://example.com${pathname}`,
            clone: () => ({
              pathname: '/dashboard',
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
        expect(NextResponse.redirect).toHaveBeenCalled();
        expect(result).toBe(mockRedirectResponse);
      }
    });

    it('should handle Google OAuth users (auto-verified) correctly', async () => {
      // Arrange: Google OAuth user (auto-verified)
      const mockToken = {
        id: 'google-user-123',
        sub: 'google-user-123',
        email: 'google@example.com'
      };

      const mockUser = {
        id: 'google-user-123',
        email: 'google@example.com',
        name: 'Google User',
        emailVerified: new Date(), // Google users are auto-verified
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetToken.mockResolvedValue(mockToken);
      mockGetUserById.mockResolvedValue(mockUser);

      const protectedRoutes = ['/dashboard', '/api/secrets'];

      for (const pathname of protectedRoutes) {
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
        expect(mockGetUserById).toHaveBeenCalledWith('google-user-123');
        expect(NextResponse.next).toHaveBeenCalled();
        expect(NextResponse.redirect).not.toHaveBeenCalled();
        expect(NextResponse.json).not.toHaveBeenCalled();
        expect(result).toBe(mockNextResponse);
      }
    });

    it('should handle callback URL preservation in redirects', async () => {
      // Arrange: Unverified user accessing protected route
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'unverified@example.com'
      };

      const mockUser = {
        id: 'user123',
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
          pathname: '/secrets/important-data',
          href: 'https://example.com/secrets/important-data',
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
      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(searchParamsMock.set).toHaveBeenCalledWith('callbackUrl', 'https://example.com/secrets/important-data');
      expect(searchParamsMock.set).toHaveBeenCalledWith('error', 'Please verify your email address to continue');
      expect(result).toBe(mockRedirectResponse);
    });

    it('should handle various error conditions gracefully', async () => {
      const errorScenarios = [
        {
          name: 'Token validation fails',
          tokenResult: null,
          tokenError: new Error('Token validation failed'),
          userResult: null,
          expectedStatus: 401,
          expectedError: 'Please sign in to continue'
        },
        {
          name: 'User lookup fails',
          tokenResult: { id: 'user123', sub: 'user123', email: 'user@example.com' },
          tokenError: null,
          userResult: null,
          userError: new Error('Database connection failed'),
          expectedStatus: 401,
          expectedError: 'Authentication error occurred'
        },
        {
          name: 'User not found in database',
          tokenResult: { id: 'missing-user', sub: 'missing-user', email: 'missing@example.com' },
          tokenError: null,
          userResult: null,
          expectedStatus: 401,
          expectedError: 'User not found'
        },
        {
          name: 'Token missing user ID',
          tokenResult: { email: 'user@example.com' },
          tokenError: null,
          userResult: null,
          expectedStatus: 401,
          expectedError: 'Invalid session'
        }
      ];

      for (const scenario of errorScenarios) {
        vi.clearAllMocks();

        // Arrange
        if (scenario.tokenError) {
          mockGetToken.mockRejectedValue(scenario.tokenError);
        } else {
          mockGetToken.mockResolvedValue(scenario.tokenResult);
        }

        if (scenario.userError) {
          mockGetUserById.mockRejectedValue(scenario.userError);
        } else {
          mockGetUserById.mockResolvedValue(scenario.userResult);
        }

        const mockRequest = {
          nextUrl: {
            pathname: '/api/secrets',
            href: 'https://example.com/api/secrets',
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
        expect(NextResponse.json).toHaveBeenCalledWith(
          {
            error: scenario.expectedError,
            code: 'UNAUTHENTICATED'
          },
          { status: scenario.expectedStatus }
        );
        expect(result).toBe(mockJsonResponse);
      }
    });
  });

  describe('Logging and Observability', () => {
    it('should log key decision points for debugging', async () => {
      // Arrange: Unverified user accessing protected route
      const mockToken = {
        id: 'user123',
        sub: 'user123',
        email: 'unverified@example.com'
      };

      const mockUser = {
        id: 'user123',
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

      // Assert: Check that key logging points were hit
      const logs = consoleLogSpy.mock.calls.map(call => call[0]);

      expect(logs.some(log => log.includes('[Middleware] Processing request to: /dashboard'))).toBe(true);
      expect(logs.some(log => log.includes('[Middleware] Token validation result:'))).toBe(true);
      expect(logs.some(log => log.includes('[Middleware] Email verification status:'))).toBe(true);
      expect(logs.some(log => log.includes('[Middleware] User email not verified'))).toBe(true);
    });
  });
});