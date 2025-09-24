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

describe('OAuth Redirect Loop Integration Tests', () => {
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
  })

  describe('Redirect Loop Scenarios', () => {
    it('should NOT create infinite redirect loop between /sign-in and /dashboard', async () => {
      // Simulate successful OAuth flow

      // 1. User has valid NextAuth token after OAuth
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        iat: Date.now() / 1000,
        exp: (Date.now() / 1000) + 3600
      }
      mockGetToken.mockResolvedValue(mockToken)

      // 2. User exists in database
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      }
      mockGetUserById.mockResolvedValue(mockUser)

      const { middleware } = await import('@/middleware')

      // 2. User visits /dashboard - middleware should allow access
      const dashboardUrl = new URL('http://localhost:3000/dashboard')
      dashboardUrl.clone = () => {
        const cloned = new URL(dashboardUrl.href)
        cloned.clone = dashboardUrl.clone
        return cloned
      }

      let mockRequest = {
        nextUrl: dashboardUrl
      } as NextRequest

      let result = await middleware(mockRequest)

      expect(NextResponse.next).toHaveBeenCalled()
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)

      // 3. If somehow user visits /sign-in while authenticated, redirect to dashboard ONCE
      const signInUrl = new URL('http://localhost:3000/sign-in')
      signInUrl.clone = () => {
        const cloned = new URL(signInUrl.href)
        return cloned
      }

      mockRequest = {
        nextUrl: signInUrl
      } as NextRequest

      result = await middleware(mockRequest)

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRedirectResponse)

      // 4. Verify no additional redirects would occur
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
    })

    it('should handle OAuth callback flow correctly', async () => {
      // Test the complete OAuth callback sequence

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

      const { middleware } = await import('@/middleware')

      // 1. OAuth callback should be allowed
      const callbackUrl = new URL('http://localhost:3000/api/auth/callback/google')
      callbackUrl.clone = () => {
        const cloned = new URL(callbackUrl.href)
        cloned.clone = callbackUrl.clone
        return cloned
      }

      let mockRequest = {
        nextUrl: callbackUrl
      } as NextRequest

      let result = await middleware(mockRequest)

      expect(NextResponse.next).toHaveBeenCalled()
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)

      // 2. After callback, user can access protected routes
      const dashboardUrl2 = new URL('http://localhost:3000/dashboard')
      dashboardUrl2.clone = () => {
        const cloned = new URL(dashboardUrl2.href)
        cloned.clone = dashboardUrl2.clone
        return cloned
      }

      mockRequest = {
        nextUrl: dashboardUrl2
      } as NextRequest

      result = await middleware(mockRequest)

      expect(NextResponse.next).toHaveBeenCalled()
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)
    })

    it('should redirect unauthenticated users consistently to /sign-in', async () => {
      // Ensure unauthenticated users are redirected consistently
      mockGetToken.mockResolvedValue(null)

      const { middleware } = await import('@/middleware')

      const protectedRoutes = ['/dashboard', '/secrets', '/profile']

      for (const route of protectedRoutes) {
        const mockRequest = {
          nextUrl: {
            pathname: route,
            href: `http://localhost:3000${route}`,
            clone: () => ({
              pathname: '/sign-in',
              searchParams: { set: vi.fn() }
            })
          }
        } as unknown as NextRequest

        const result = await middleware(mockRequest)

        expect(NextResponse.redirect).toHaveBeenCalled()
        expect(result).toBe(mockRedirectResponse)
      }
    })

    it('should allow unauthenticated access to public routes', async () => {
      mockGetToken.mockResolvedValue(null)

      const { middleware } = await import('@/middleware')

      const publicRoutes = ['/', '/sign-in', '/auth/login', '/api/auth/signin']

      for (const route of publicRoutes) {
        const mockRequest = {
          nextUrl: { pathname: route }
        } as NextRequest

        const result = await middleware(mockRequest)

        expect(NextResponse.next).toHaveBeenCalled()
        expect(NextResponse.redirect).not.toHaveBeenCalled()
        expect(result).toBe(mockNextResponse)
      }
    })
  })

  describe('Token Validation Edge Cases', () => {
    it('should handle token validation errors gracefully', async () => {
      // Simulate token validation failure
      mockGetToken.mockRejectedValue(new Error('Token validation failed'))

      const { middleware } = await import('@/middleware')

      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'http://localhost:3000/dashboard',
          clone: () => ({
            pathname: '/sign-in',
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest

      const result = await middleware(mockRequest)

      // Should redirect to sign-in on token error
      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)
    })

    it('should handle expired tokens correctly', async () => {
      // Simulate expired token
      const expiredToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        iat: Date.now() / 1000 - 7200, // Issued 2 hours ago
        exp: Date.now() / 1000 - 3600  // Expired 1 hour ago
      }

      // NextAuth handles token expiration internally, so this would return null
      mockGetToken.mockResolvedValue(null)

      const { middleware } = await import('@/middleware')

      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          href: 'http://localhost:3000/dashboard',
          clone: () => ({
            pathname: '/sign-in',
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest

      const result = await middleware(mockRequest)

      // Should redirect to sign-in for expired token
      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)
    })
  })

  describe('Route Protection Validation', () => {
    it('should protect all authenticated routes', async () => {
      mockGetToken.mockResolvedValue(null)

      const { middleware } = await import('@/middleware')

      // Test routes that should be protected
      const protectedRoutes = [
        '/dashboard',
        '/secrets',
        '/secrets/new',
        '/secrets/123',
        '/profile',
        '/settings'
      ]

      for (const route of protectedRoutes) {
        const mockRequest = {
          nextUrl: {
            pathname: route,
            href: `http://localhost:3000${route}`,
            clone: () => ({
              pathname: '/sign-in',
              searchParams: { set: vi.fn() }
            })
          }
        } as unknown as NextRequest

        const result = await middleware(mockRequest)

        expect(NextResponse.redirect).toHaveBeenCalled()
        expect(result).toBe(mockRedirectResponse)
      }
    })

    it('should allow access to all public routes', async () => {
      mockGetToken.mockResolvedValue(null)

      const { middleware } = await import('@/middleware')

      // Test routes that should be public
      const publicRoutes = [
        '/',
        '/sign-in',
        '/auth/login',
        '/auth/error',
        '/api/auth/signin',
        '/api/auth/callback/google',
        '/api/auth/error'
      ]

      for (const route of publicRoutes) {
        const mockRequest = {
          nextUrl: { pathname: route }
        } as NextRequest

        const result = await middleware(mockRequest)

        expect(NextResponse.next).toHaveBeenCalled()
        expect(NextResponse.redirect).not.toHaveBeenCalled()
        expect(result).toBe(mockNextResponse)
      }
    })
  })
})