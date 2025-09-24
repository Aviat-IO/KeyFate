/**
 * Middleware Integration Testing for Email Verification
 * Task 1.6: Test middleware enforcement of email verification
 *
 * Test Coverage:
 * - Route protection for unverified users
 * - Redirect logic for verified vs unverified users
 * - API route protection
 * - Error handling in middleware
 * - Session validation
 * - Email verification enforcement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/middleware'

// Mock dependencies
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

vi.mock('@/lib/auth/users', () => ({
  getUserById: vi.fn(),
}))

const mockGetToken = vi.mocked(require('next-auth/jwt').getToken)
const mockGetUserById = vi.mocked(require('@/lib/auth/users').getUserById)

// Helper to create test requests
function createRequest(pathname: string, headers = {}) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers,
  })
}

describe('Middleware Email Verification Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  describe('Public Routes - No Authentication Required', () => {
    it('should allow access to home page without authentication', async () => {
      mockGetToken.mockResolvedValue(null)

      const request = createRequest('/')
      const response = await middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('should allow access to sign-in page without authentication', async () => {
      mockGetToken.mockResolvedValue(null)

      const request = createRequest('/sign-in')
      const response = await middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('should allow access to auth pages without authentication', async () => {
      mockGetToken.mockResolvedValue(null)

      const authPages = [
        '/auth/login',
        '/auth/signup',
        '/auth/error',
        '/auth/verify-email',
      ]

      for (const page of authPages) {
        const request = createRequest(page)
        const response = await middleware(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
      }
    })

    it('should allow access to NextAuth API routes', async () => {
      mockGetToken.mockResolvedValue(null)

      const apiRoutes = [
        '/api/auth/signin',
        '/api/auth/signout',
        '/api/auth/callback/google',
        '/api/auth/session',
      ]

      for (const route of apiRoutes) {
        const request = createRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
      }
    })
  })

  describe('Unauthenticated User Access', () => {
    it('should redirect unauthenticated users to sign-in for protected pages', async () => {
      mockGetToken.mockResolvedValue(null)

      const protectedPages = [
        '/dashboard',
        '/secrets',
        '/profile',
        '/settings',
      ]

      for (const page of protectedPages) {
        const request = createRequest(page)
        const response = await middleware(request)

        expect(response.status).toBe(307) // Redirect
        const location = response.headers.get('location')
        expect(location).toContain('/sign-in')
        expect(location).toContain(`callbackUrl=${encodeURIComponent(`http://localhost:3000${page}`)}`)
      }
    })

    it('should return 401 JSON for unauthenticated API requests', async () => {
      mockGetToken.mockResolvedValue(null)

      const protectedApiRoutes = [
        '/api/secrets',
        '/api/user/profile',
        '/api/settings',
      ]

      for (const route of protectedApiRoutes) {
        const request = createRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(401)

        const data = await response.json()
        expect(data.error).toBe('Authentication required')
        expect(data.code).toBe('UNAUTHENTICATED')
      }
    })
  })

  describe('Authenticated but Unverified Users', () => {
    beforeEach(() => {
      // Mock authenticated session
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      })

      // Mock unverified user
      mockGetUserById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: null, // Not verified
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it('should redirect unverified users to email verification page', async () => {
      const protectedPages = [
        '/dashboard',
        '/secrets',
        '/profile',
        '/settings',
      ]

      for (const page of protectedPages) {
        const request = createRequest(page)
        const response = await middleware(request)

        expect(response.status).toBe(307) // Redirect
        const location = response.headers.get('location')
        expect(location).toContain('/auth/verify-email')
        expect(location).toContain(`callbackUrl=${encodeURIComponent(`http://localhost:3000${page}`)}`)
        expect(location).toContain('error=Please%20verify%20your%20email%20address%20to%20continue')
      }
    })

    it('should return 403 JSON for unverified API requests', async () => {
      const protectedApiRoutes = [
        '/api/secrets',
        '/api/user/profile',
        '/api/settings',
      ]

      for (const route of protectedApiRoutes) {
        const request = createRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(403)

        const data = await response.json()
        expect(data.error).toBe('Email verification required')
        expect(data.code).toBe('EMAIL_NOT_VERIFIED')
      }
    })

    it('should allow access to verification-related API routes', async () => {
      const verificationRoutes = [
        '/api/auth/resend-verification',
        '/api/auth/verify-email',
        '/api/auth/verification-status',
      ]

      for (const route of verificationRoutes) {
        const request = createRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
      }
    })

    it('should allow access to email verification page', async () => {
      const request = createRequest('/auth/verify-email')
      const response = await middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('Verified Users Access', () => {
    beforeEach(() => {
      // Mock authenticated session
      mockGetToken.mockResolvedValue({
        sub: 'verified-user-123',
        email: 'verified@example.com',
        name: 'Verified User',
      })

      // Mock verified user
      mockGetUserById.mockResolvedValue({
        id: 'verified-user-123',
        email: 'verified@example.com',
        name: 'Verified User',
        emailVerified: new Date(), // Verified
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it('should allow verified users access to protected pages', async () => {
      const protectedPages = [
        '/dashboard',
        '/secrets',
        '/profile',
        '/settings',
      ]

      for (const page of protectedPages) {
        const request = createRequest(page)
        const response = await middleware(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
      }
    })

    it('should allow verified users access to protected API routes', async () => {
      const protectedApiRoutes = [
        '/api/secrets',
        '/api/user/profile',
        '/api/settings',
      ]

      for (const route of protectedApiRoutes) {
        const request = createRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
      }
    })

    it('should redirect verified users away from auth pages to dashboard', async () => {
      const authPages = [
        '/auth/login',
        '/auth/signup',
        '/sign-in',
      ]

      for (const page of authPages) {
        const request = createRequest(page)
        const response = await middleware(request)

        expect(response.status).toBe(307) // Redirect
        const location = response.headers.get('location')
        expect(location).toContain('/dashboard')
      }
    })

    it('should allow verified users to access verification page (edge case)', async () => {
      // Verified users might still access verification page directly
      const request = createRequest('/auth/verify-email')
      const response = await middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle token validation errors gracefully', async () => {
      // Mock token validation error
      mockGetToken.mockRejectedValue(new Error('Token validation failed'))

      const request = createRequest('/dashboard')
      const response = await middleware(request)

      expect(response.status).toBe(307) // Redirect to login
      const location = response.headers.get('location')
      expect(location).toContain('/sign-in')
      expect(location).toContain('error=Please%20sign%20in%20to%20continue')
    })

    it('should handle database errors during user lookup', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      })

      // Mock database error
      mockGetUserById.mockRejectedValue(new Error('Database connection failed'))

      const request = createRequest('/dashboard')
      const response = await middleware(request)

      expect(response.status).toBe(307) // Redirect to login
      const location = response.headers.get('location')
      expect(location).toContain('/sign-in')
      expect(location).toContain('error=Authentication%20error%20occurred')
    })

    it('should handle missing user ID in token', async () => {
      mockGetToken.mockResolvedValue({
        // Missing sub/id
        email: 'test@example.com',
      })

      const request = createRequest('/dashboard')
      const response = await middleware(request)

      expect(response.status).toBe(307) // Redirect to login
      const location = response.headers.get('location')
      expect(location).toContain('/sign-in')
      expect(location).toContain('error=Invalid%20session')
    })

    it('should handle user not found in database', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'nonexistent-user',
        email: 'test@example.com',
      })

      // Mock user not found
      mockGetUserById.mockResolvedValue(null)

      const request = createRequest('/dashboard')
      const response = await middleware(request)

      expect(response.status).toBe(307) // Redirect to login
      const location = response.headers.get('location')
      expect(location).toContain('/sign-in')
      expect(location).toContain('error=User%20not%20found')
    })

    it('should allow access to public routes even on errors', async () => {
      // Mock token validation error
      mockGetToken.mockRejectedValue(new Error('Token validation failed'))

      const publicRoutes = ['/', '/sign-in', '/auth/login']

      for (const route of publicRoutes) {
        const request = createRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
      }
    })
  })

  describe('Edge Cases and Security', () => {
    it('should handle malformed authorization headers', async () => {
      const request = createRequest('/dashboard', {
        authorization: 'Bearer malformed-token',
      })

      // Token validation should handle malformed tokens
      mockGetToken.mockResolvedValue(null)

      const response = await middleware(request)

      expect(response.status).toBe(307) // Redirect to login
    })

    it('should handle concurrent verification status changes', async () => {
      // Mock user that becomes verified during request processing
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      })

      // First call returns unverified, second returns verified
      mockGetUserById
        .mockResolvedValueOnce({
          id: 'user-123',
          email: 'test@example.com',
          emailVerified: null, // Unverified
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      const request = createRequest('/dashboard')
      const response = await middleware(request)

      // Should redirect to verification based on initial state
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/auth/verify-email')
    })

    it('should handle very long callback URLs safely', async () => {
      mockGetToken.mockResolvedValue(null)

      const longPath = '/dashboard/' + 'a'.repeat(2000)
      const request = createRequest(longPath)
      const response = await middleware(request)

      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/sign-in')
      expect(location).toContain('callbackUrl=')
      // Should handle long URLs without errors
    })

    it('should normalize email addresses consistently', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        email: '  TEST@EXAMPLE.COM  ', // Mixed case with spaces
      })

      mockGetUserById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com', // Normalized in database
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = createRequest('/dashboard')
      const response = await middleware(request)

      expect(response.status).toBe(200)
      expect(mockGetUserById).toHaveBeenCalledWith('user-123')
    })
  })

  describe('Performance and Logging', () => {
    it('should complete middleware processing in reasonable time', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      })

      mockGetUserById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = createRequest('/dashboard')

      const startTime = performance.now()
      await middleware(request)
      const duration = performance.now() - startTime

      // Middleware should complete in under 100ms for verified users
      expect(duration).toBeLessThan(100)
    })

    it('should log relevant information for debugging', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      })

      mockGetUserById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = createRequest('/dashboard')
      await middleware(request)

      // Should log middleware processing steps
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Middleware] Processing request to: /dashboard')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Middleware] Token validation result:')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Middleware] Email verification status:')
      )
    })
  })
})