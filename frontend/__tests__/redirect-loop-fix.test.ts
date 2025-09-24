import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById } from '@/lib/auth/users'

// Mock NextAuth JWT
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}))

// Mock auth users module
vi.mock('@/lib/auth/users', () => ({
  getUserById: vi.fn()
}))

// Mock Next.js server functions
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    redirect: vi.fn(),
    next: vi.fn()
  }
}))

const mockGetToken = getToken as any
const mockGetUserById = vi.mocked(getUserById)

describe('Redirect Loop Fix Tests', () => {
  let mockRequest: NextRequest
  let mockRedirectResponse: any
  let mockNextResponse: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockRedirectResponse = { type: 'redirect' }
    mockNextResponse = { type: 'next' }

    const mockNextResponseMethods = {
      redirect: vi.fn().mockReturnValue(mockRedirectResponse),
      next: vi.fn().mockReturnValue(mockNextResponse)
    }

    // Properly mock NextResponse static methods
    Object.assign(NextResponse, mockNextResponseMethods)

    mockRequest = {
      nextUrl: {
        pathname: '/dashboard',
        href: 'http://localhost:3000/dashboard',
        clone: () => ({
          pathname: '/sign-in',
          searchParams: {
            set: vi.fn()
          }
        })
      }
    } as unknown as NextRequest
  })

  describe('Redirect Loop Prevention', () => {
    it('should not create redirect loop: authenticated user on /sign-in should redirect to /dashboard ONCE', async () => {
      // Arrange - authenticated user on sign-in page
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(mockToken)
      mockRequest.nextUrl.pathname = '/sign-in'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should redirect to dashboard
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRedirectResponse)
    })

    it('should allow authenticated users to access /dashboard without redirect', async () => {
      // Arrange - authenticated user accessing dashboard
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(mockToken)

      // User exists in database
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      }
      mockGetUserById.mockResolvedValue(mockUser)

      mockRequest.nextUrl.pathname = '/dashboard'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should NOT redirect, should allow access
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(NextResponse.next).toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)
    })

    it('should redirect unauthenticated users from /dashboard to /sign-in', async () => {
      // Arrange - no token (unauthenticated)
      mockGetToken.mockResolvedValue(null)
      mockRequest.nextUrl.pathname = '/dashboard'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should redirect to sign-in
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRedirectResponse)
    })

    it('should allow unauthenticated users to access /sign-in without redirect', async () => {
      // Arrange - no token on sign-in page
      mockGetToken.mockResolvedValue(null)
      mockRequest.nextUrl.pathname = '/sign-in'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should NOT redirect, should allow access
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(NextResponse.next).toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)
    })

    it('should handle /auth/login route correctly for authenticated users', async () => {
      // Arrange - authenticated user on old auth route
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(mockToken)
      mockRequest.nextUrl.pathname = '/auth/login'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should redirect to dashboard
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRedirectResponse)
    })

    it('should allow OAuth callback routes regardless of authentication status', async () => {
      // Test both authenticated and unauthenticated scenarios
      const testCases = [
        { token: null, description: 'unauthenticated' },
        {
          token: { sub: 'user123', email: 'user@example.com', name: 'Test User' },
          description: 'authenticated'
        }
      ]

      for (const testCase of testCases) {
        mockGetToken.mockResolvedValue(testCase.token)
        mockRequest.nextUrl.pathname = '/api/auth/callback/google'

        const { middleware } = await import('@/middleware')

        // Act
        const result = await middleware(mockRequest)

        // Assert - should allow access regardless of auth status
        expect(NextResponse.redirect).not.toHaveBeenCalled()
        expect(NextResponse.next).toHaveBeenCalled()
        expect(result).toBe(mockNextResponse)
      }
    })
  })

  describe('Route Consistency Tests', () => {
    it('should ensure all sign-in related routes point to /sign-in', async () => {
      // This test ensures consistency in route naming
      mockGetToken.mockResolvedValue(null)

      const signInRoutes = ['/sign-in', '/auth/login']

      for (const route of signInRoutes) {
        mockRequest.nextUrl.pathname = route

        const { middleware } = await import('@/middleware')
        const result = await middleware(mockRequest)

        // All these routes should be accessible without redirect when unauthenticated
        expect(NextResponse.next).toHaveBeenCalled()
        expect(result).toBe(mockNextResponse)
      }
    })

    it('should ensure dashboard is consistently protected', async () => {
      // Arrange - no token
      mockGetToken.mockResolvedValue(null)
      mockRequest.nextUrl.pathname = '/dashboard'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should redirect to sign-in (not login)
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRedirectResponse)
    })
  })

  describe('Session Token Validation', () => {
    it('should handle session token correctly after OAuth callback', async () => {
      // Simulate a fresh session token after OAuth
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        iat: Date.now() / 1000, // Issued at time
        exp: (Date.now() / 1000) + 3600 // Expires in 1 hour
      }

      mockGetToken.mockResolvedValue(mockToken)

      // User exists in database
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      }
      mockGetUserById.mockResolvedValue(mockUser)

      mockRequest.nextUrl.pathname = '/dashboard'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should allow access to protected route
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(NextResponse.next).toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)
    })

    it('should handle token validation errors gracefully', async () => {
      // Simulate token validation failure
      mockGetToken.mockRejectedValue(new Error('Invalid token'))
      mockRequest.nextUrl.pathname = '/dashboard'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert - should redirect to sign-in on error
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRedirectResponse)
    })
  })
})