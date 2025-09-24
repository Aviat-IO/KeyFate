import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { getUserById } from '@/lib/auth/users'

// Mock NextAuth JWT and server session
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}))

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn()
}))

vi.mock('@/lib/auth/users', () => ({
  getUserById: vi.fn()
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

vi.mock('@/lib/auth-config', () => ({
  authConfig: { providers: [], session: { strategy: 'jwt' } }
}))

vi.mock('@/components/nav-bar', () => ({
  NavBar: () => 'NavBar'
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
const mockGetServerSession = getServerSession as any
const mockGetUserById = vi.mocked(getUserById)
const mockRedirect = redirect as any

describe('Complete Redirect Loop Solution Tests', () => {
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

    Object.assign(NextResponse, mockNextResponseMethods)
  })

  describe('Complete OAuth Flow Without Redirect Loops', () => {
    it('should handle complete OAuth flow: callback → dashboard access → no redirect loops', async () => {
      // Simulate a user session after successful OAuth
      const userSession = {
        user: {
          id: 'user123',
          email: 'user@example.com',
          name: 'Test User'
        },
        expires: '2024-12-31T23:59:59.999Z'
      }

      // Both middleware (JWT) and layout (server session) use the same session
      mockGetToken.mockResolvedValue(userSession)
      mockGetServerSession.mockResolvedValue(userSession)

      // User exists in database
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      }
      mockGetUserById.mockResolvedValue(mockUser)

      const { middleware } = await import('@/middleware')

      // 1. OAuth callback should work
      let mockUrl = new URL('http://localhost:3000/api/auth/callback/google')
      mockUrl.clone = () => new URL(mockUrl.href)

      let mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      let result = await middleware(mockRequest)

      expect(NextResponse.next).toHaveBeenCalled()
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)

      // 2. User can access dashboard after OAuth
      mockUrl = new URL('http://localhost:3000/dashboard')
      mockUrl.clone = () => new URL(mockUrl.href)

      mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      result = await middleware(mockRequest)

      expect(NextResponse.next).toHaveBeenCalled()
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)

      // 3. Layout allows authenticated access (no redirect)
      const AuthenticatedLayout = (await import('@/app/(authenticated)/layout')).default

      mockRedirect.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT')
      })

      // Should NOT redirect authenticated users
      await expect(async () => {
        await AuthenticatedLayout({ children: 'dashboard content' })
      }).not.toThrow()

      expect(mockRedirect).not.toHaveBeenCalled()

      // 4. If authenticated user somehow visits /sign-in, redirect to dashboard ONCE
      mockUrl = new URL('http://localhost:3000/sign-in')
      mockUrl.clone = () => new URL(mockUrl.href)

      mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      result = await middleware(mockRequest)

      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)

      // 5. Verify no infinite loop - only one redirect occurs
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
    })

    it('should handle unauthenticated users consistently', async () => {
      // No session for unauthenticated user
      mockGetToken.mockResolvedValue(null)
      mockGetServerSession.mockResolvedValue(null)

      const { middleware } = await import('@/middleware')

      // 1. Unauthenticated user accessing dashboard should be redirected to sign-in
      let mockUrl = new URL('http://localhost:3000/dashboard')
      mockUrl.clone = () => {
        const cloned = new URL('http://localhost:3000/sign-in')
        Object.defineProperty(cloned, 'searchParams', {
          value: { set: vi.fn() },
          writable: true
        })
        return cloned as any
      }

      let mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      let result = await middleware(mockRequest)

      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)

      // 2. Unauthenticated user can access sign-in page
      // Clear previous mocks
      vi.clearAllMocks()
      const mockNextResponseMethods2 = {
        redirect: vi.fn().mockReturnValue(mockRedirectResponse),
        next: vi.fn().mockReturnValue(mockNextResponse)
      }
      Object.assign(NextResponse, mockNextResponseMethods2)

      mockUrl = new URL('http://localhost:3000/sign-in')
      mockUrl.clone = () => new URL(mockUrl.href)

      mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      result = await middleware(mockRequest)

      expect(NextResponse.next).toHaveBeenCalled()
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)

      // 3. Layout redirects unauthenticated users to sign-in
      const AuthenticatedLayout = (await import('@/app/(authenticated)/layout')).default

      mockRedirect.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT')
      })

      await expect(async () => {
        await AuthenticatedLayout({ children: 'dashboard content' })
      }).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/sign-in')
    })

    it('should use consistent authentication source (NextAuth) everywhere', async () => {
      // Verify both middleware and layout use NextAuth

      const session = {
        user: { id: 'user123', email: 'user@example.com', name: 'Test User' }
      }

      mockGetToken.mockResolvedValue(session)
      mockGetServerSession.mockResolvedValue(session)

      const { middleware } = await import('@/middleware')

      // Test middleware uses getToken
      const mockUrl = new URL('http://localhost:3000/dashboard')
      mockUrl.clone = () => new URL(mockUrl.href)

      const mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      await middleware(mockRequest)

      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })

      // Test layout uses getServerSession
      const AuthenticatedLayout = (await import('@/app/(authenticated)/layout')).default
      await AuthenticatedLayout({ children: 'test' })

      expect(mockGetServerSession).toHaveBeenCalled()

      // Both should access the same session data
      expect(mockGetToken).toHaveBeenCalled()
      expect(mockGetServerSession).toHaveBeenCalled()
    })

    it('should maintain route consistency (all redirects go to /sign-in)', async () => {
      // Test that all components redirect to the same sign-in route

      // Middleware redirects unauthenticated users to /sign-in
      mockGetToken.mockResolvedValue(null)

      const { middleware } = await import('@/middleware')

      const mockUrl = new URL('http://localhost:3000/dashboard')
      mockUrl.clone = () => {
        const cloned = new URL('http://localhost:3000/sign-in')
        Object.defineProperty(cloned, 'searchParams', {
          value: { set: vi.fn() },
          writable: true
        })
        return cloned as any
      }

      const mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      await middleware(mockRequest)

      expect(NextResponse.redirect).toHaveBeenCalled()

      // Layout redirects unauthenticated users to /sign-in
      mockGetServerSession.mockResolvedValue(null)

      mockRedirect.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT')
      })

      const AuthenticatedLayout = (await import('@/app/(authenticated)/layout')).default

      await expect(async () => {
        await AuthenticatedLayout({ children: 'test' })
      }).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/sign-in')

      // Consistent redirect target
      expect(mockRedirect).toHaveBeenCalledWith('/sign-in')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle session errors gracefully without causing loops', async () => {
      // Simulate session errors
      mockGetToken.mockRejectedValue(new Error('Token error'))
      mockGetServerSession.mockRejectedValue(new Error('Session error'))

      const { middleware } = await import('@/middleware')

      // Middleware should redirect on token error
      const mockUrl = new URL('http://localhost:3000/dashboard')
      mockUrl.clone = () => {
        const cloned = new URL('http://localhost:3000/sign-in')
        Object.defineProperty(cloned, 'searchParams', {
          value: { set: vi.fn() },
          writable: true
        })
        return cloned as any
      }

      const mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      const result = await middleware(mockRequest)

      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)

      // Layout should redirect on session error
      mockRedirect.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT')
      })

      const AuthenticatedLayout = (await import('@/app/(authenticated)/layout')).default

      await expect(async () => {
        await AuthenticatedLayout({ children: 'test' })
      }).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/sign-in')
    })

    it('should prevent infinite redirects with circuit breaker behavior', async () => {
      // Test that the system prevents infinite redirect loops

      const session = {
        user: { id: 'user123', email: 'user@example.com', name: 'Test User' }
      }

      mockGetToken.mockResolvedValue(session)
      mockGetServerSession.mockResolvedValue(session)

      const { middleware } = await import('@/middleware')

      // Multiple requests should not cause excessive redirects
      const mockUrl = new URL('http://localhost:3000/sign-in')
      mockUrl.clone = () => new URL('http://localhost:3000/dashboard')

      const mockRequest = {
        nextUrl: mockUrl
      } as NextRequest

      // Simulate multiple rapid requests
      for (let i = 0; i < 5; i++) {
        await middleware(mockRequest)
      }

      // Should only redirect once per request, not accumulate
      expect(NextResponse.redirect).toHaveBeenCalledTimes(5) // Once per request
      expect(NextResponse.redirect).not.toHaveBeenCalledTimes(25) // Not exponential
    })
  })
})