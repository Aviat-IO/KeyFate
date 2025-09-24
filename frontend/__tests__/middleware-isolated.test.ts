import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Mock NextAuth JWT - ensure it doesn't throw
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}))

const mockGetToken = getToken as any

describe('Middleware Isolated Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Ensure NextResponse methods are available and working
    vi.spyOn(NextResponse, 'redirect').mockImplementation((url) => {
      return { type: 'redirect', url } as any
    })

    vi.spyOn(NextResponse, 'next').mockImplementation(() => {
      return { type: 'next' } as any
    })
  })

  it('should handle authenticated user on /sign-in route correctly', async () => {
    // Set up a valid token
    const validToken = {
      sub: 'user123',
      email: 'user@example.com',
      name: 'Test User'
    }

    mockGetToken.mockResolvedValue(validToken)

    // Create a proper NextRequest mock
    const mockUrl = new URL('http://localhost:3000/sign-in')
    mockUrl.clone = () => {
      const cloned = new URL(mockUrl.href)
      return cloned
    }

    const mockRequest = {
      nextUrl: mockUrl,
      url: 'http://localhost:3000/sign-in'
    } as NextRequest

    // Import and test the middleware
    const { middleware } = await import('@/middleware')

    let result
    let error = null

    try {
      result = await middleware(mockRequest)
    } catch (e) {
      error = e
      console.error('Middleware threw error:', e)
    }

    // Check what happened
    console.log('Result:', result)
    console.log('Error:', error)
    console.log('NextResponse.redirect calls:', (NextResponse.redirect as any).mock.calls)
    console.log('NextResponse.next calls:', (NextResponse.next as any).mock.calls)

    if (error) {
      expect(error).toBeNull() // This will fail and show us the error
    }

    // Should have redirected to dashboard
    expect(NextResponse.redirect).toHaveBeenCalled()
    expect(result?.type).toBe('redirect')
  })

  it('should handle the route classification correctly', () => {
    // Test the exact logic from middleware
    const pathname = '/sign-in'

    // PUBLIC_ROUTES from middleware
    const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/error', '/sign-in']

    // AUTH_ROUTES from middleware
    const AUTH_ROUTES = ['/api/auth', '/auth', '/sign-in']

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

    // Test the logic
    const isPublic = isPublicRoute(pathname)
    const isAuth = isAuthRoute(pathname)

    console.log(`${pathname}: isPublic=${isPublic}, isAuth=${isAuth}`)

    expect(isPublic).toBe(true)
    expect(isAuth).toBe(true)

    // Simulate middleware logic
    const hasToken = true // authenticated user

    // The middleware should first check: token && isAuthRoute && !api
    if (hasToken && isAuth && !pathname.startsWith('/api/auth/')) {
      console.log('Should redirect to dashboard')
      expect(true).toBe(true) // This path should be taken
    } else if (isPublic) {
      console.log('Should allow access as public route')
      expect(false).toBe(true) // This should NOT be taken when authenticated
    } else {
      console.log('Should require authentication')
      expect(false).toBe(true) // This should NOT be taken
    }
  })
})