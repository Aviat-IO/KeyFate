import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Mock NextAuth JWT
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
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

describe('Middleware Debug Tests', () => {
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

  describe('Specific /sign-in Route Handling', () => {
    it('should correctly identify /sign-in as both public and auth route', async () => {
      // Test the route classification logic
      const pathname = '/sign-in'

      // Import middleware functions to test the route classification
      const { middleware } = await import('@/middleware')

      // Test with authenticated user
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(mockToken)

      const mockRequest = {
        nextUrl: {
          pathname: '/sign-in',
          clone: () => ({
            pathname: '/dashboard',
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest

      // This should log what path the middleware takes
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = await middleware(mockRequest)

      // Check the logs to see what path was taken
      const logs = consoleSpy.mock.calls.map(call => call[0])
      console.log('Middleware logs:', logs)

      consoleSpy.mockRestore()

      // Should redirect authenticated user from /sign-in to /dashboard
      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)
    })

    it('should test middleware without error handling edge cases', async () => {
      // Test the middleware logic step by step
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }

      // Ensure getToken doesn't throw
      mockGetToken.mockImplementation(async () => {
        console.log('getToken called, returning:', mockToken)
        return mockToken
      })

      const mockRequest = {
        nextUrl: {
          pathname: '/sign-in',
          clone: () => ({
            pathname: '/dashboard',
            searchParams: { set: vi.fn() }
          })
        }
      } as unknown as NextRequest

      const { middleware } = await import('@/middleware')

      // Mock console methods to capture logs
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const result = await middleware(mockRequest)

        console.log('Middleware result:', result)
        console.log('Redirect calls:', NextResponse.redirect.mock.calls)
        console.log('Next calls:', NextResponse.next.mock.calls)

        // Show what logs were generated
        const logs = consoleLogSpy.mock.calls.map(call => call[0])
        const errors = consoleErrorSpy.mock.calls.map(call => call[0])
        console.log('Logs:', logs)
        console.log('Errors:', errors)

        // Should redirect to dashboard
        expect(NextResponse.redirect).toHaveBeenCalled()
        expect(result).toBe(mockRedirectResponse)
      } finally {
        consoleLogSpy.mockRestore()
        consoleErrorSpy.mockRestore()
      }
    })
  })

  describe('Route Classification Testing', () => {
    it('should test the isAuthRoute and isPublicRoute functions directly', () => {
      // Test the route classification functions
      const AUTH_ROUTES = ['/api/auth', '/auth', '/sign-in']
      const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/error', '/sign-in']

      function isPublicRoute(pathname: string): boolean {
        if (PUBLIC_ROUTES.includes(pathname as any)) {
          return true
        }
        if (pathname.startsWith('/api/auth/')) {
          return true
        }
        return false
      }

      function isAuthRoute(pathname: string): boolean {
        return AUTH_ROUTES.some(route => pathname.startsWith(route))
      }

      // Test /sign-in
      expect(isPublicRoute('/sign-in')).toBe(true)
      expect(isAuthRoute('/sign-in')).toBe(true)

      // This shows that /sign-in is both public and auth route
      console.log('/sign-in isPublic:', isPublicRoute('/sign-in'))
      console.log('/sign-in isAuth:', isAuthRoute('/sign-in'))
    })
  })
})