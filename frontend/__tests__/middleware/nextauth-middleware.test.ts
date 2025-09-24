import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById } from '@/lib/auth/users'

// Mock NextAuth JWT
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}))

// Mock user database functions
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
const mockGetUserById = getUserById as any

describe('NextAuth Middleware', () => {
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
        clone: () => ({
          pathname: '/auth/login',
          searchParams: {
            set: vi.fn()
          }
        })
      }
    } as unknown as NextRequest
  })

  describe('Authentication Checks', () => {
    it('should redirect unauthenticated users from protected routes to login', async () => {
      // Arrange - no token (unauthenticated)
      mockGetToken.mockResolvedValue(null)
      mockRequest.nextUrl.pathname = '/dashboard'

      // Import middleware after mocking
      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)
    })

    it('should allow authenticated users to access protected routes', async () => {
      // Arrange - valid token (authenticated)
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(mockToken)

      // Mock verified user in database
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date('2024-01-01'), // Email verified
        createdAt: new Date(),
        updatedAt: new Date()
      }
      mockGetUserById.mockResolvedValue(mockUser)

      mockRequest.nextUrl.pathname = '/dashboard'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(NextResponse.next).toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)
    })

    it('should redirect authenticated users away from auth routes to dashboard', async () => {
      // Arrange - valid token but on auth route
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

      // Assert
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)
    })

    it('should allow access to OAuth callback routes even when authenticated', async () => {
      // Arrange - authenticated user on callback route
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(mockToken)
      mockRequest.nextUrl.pathname = '/api/auth/callback/google'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(NextResponse.redirect).not.toHaveBeenCalled()
      expect(NextResponse.next).toHaveBeenCalled()
      expect(result).toBe(mockNextResponse)
    })

    it('should handle invalid tokens gracefully', async () => {
      // Arrange - token validation fails
      mockGetToken.mockRejectedValue(new Error('Token validation failed'))
      mockRequest.nextUrl.pathname = '/dashboard'

      const { middleware } = await import('@/middleware')

      // Act
      const result = await middleware(mockRequest)

      // Assert
      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      // Should redirect to login on token validation failure
      expect(NextResponse.redirect).toHaveBeenCalled()
      expect(result).toBe(mockRedirectResponse)
    })
  })

  describe('Route Protection', () => {
    const publicRoutes = [
      '/',
      '/auth/login',
      '/auth/error',
      '/api/auth/signin',
      '/api/auth/callback/google'
    ]

    const protectedRoutes = [
      '/dashboard',
      '/secrets',
      '/secrets/123',
      '/profile',
      '/settings'
    ]

    publicRoutes.forEach(route => {
      it(`should allow unauthenticated access to public route: ${route}`, async () => {
        // Arrange
        mockGetToken.mockResolvedValue(null)
        mockRequest.nextUrl.pathname = route

        const { middleware } = await import('@/middleware')

        // Act
        const result = await middleware(mockRequest)

        // Assert
        expect(NextResponse.redirect).not.toHaveBeenCalled()
        expect(NextResponse.next).toHaveBeenCalled()
        expect(result).toBe(mockNextResponse)
      })
    })

    protectedRoutes.forEach(route => {
      it(`should protect route: ${route}`, async () => {
        // Arrange
        mockGetToken.mockResolvedValue(null)
        mockRequest.nextUrl.pathname = route

        const { middleware } = await import('@/middleware')

        // Act
        const result = await middleware(mockRequest)

        // Assert
        expect(NextResponse.redirect).toHaveBeenCalled()
        expect(result).toBe(mockRedirectResponse)
      })
    })
  })
})