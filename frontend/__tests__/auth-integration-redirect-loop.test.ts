import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { redirect } from 'next/navigation'
import { getUserById } from '@/lib/auth/users'

// Mock NextAuth JWT
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn()
}))

// Mock auth users module
vi.mock('@/lib/auth/users', () => ({
  getUserById: vi.fn()
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

// Mock Next.js server functions
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    redirect: vi.fn(),
    next: vi.fn()
  }
}))

// Mock Supabase client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

const mockGetToken = getToken as any
const mockGetUserById = vi.mocked(getUserById)
const mockRedirect = redirect as any

describe('Auth Integration Redirect Loop Tests', () => {
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

  describe('Authentication Mismatch Detection', () => {
    it('should identify when NextAuth session exists but Supabase user does not', async () => {
      // This simulates the exact scenario causing the redirect loop

      // 1. NextAuth has valid token (OAuth completed successfully)
      const nextAuthToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(nextAuthToken)

      // 2. User exists in database (for middleware check)
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: new Date()
      }
      mockGetUserById.mockResolvedValue(mockUser)

      // 3. Supabase does not have the user (separate concern)
      const { createClient } = await import('@/utils/supabase/server')
      const mockSupabase = createClient()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      // 3. Test middleware behavior (should allow access based on NextAuth)
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

      const { middleware } = await import('@/middleware')

      const middlewareResult = await middleware(mockRequest)

      // Assert: Middleware should allow access (NextAuth token valid)
      expect(mockGetToken).toHaveBeenCalled()
      expect(NextResponse.next).toHaveBeenCalled()
      expect(middlewareResult).toBe(mockNextResponse)

      // 4. Test authenticated layout behavior (should redirect due to missing Supabase user)
      mockRedirect.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT') // Next.js redirect behavior
      })

      // Import the layout component
      const AuthenticatedLayout = (await import('@/app/(authenticated)/layout')).default

      // Assert: Layout should attempt to redirect
      await expect(async () => {
        await AuthenticatedLayout({ children: 'test' })
      }).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/sign-in')
    })

    it('should detect redirect loop pattern in logs', async () => {
      // This test validates the specific sequence that creates the loop
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }

      // Simulate the loop sequence:

      // 1. User visits /dashboard with NextAuth token
      mockGetToken.mockResolvedValue(mockToken)
      let mockRequest = {
        nextUrl: { pathname: '/dashboard' }
      } as NextRequest

      const { middleware } = await import('@/middleware')
      await middleware(mockRequest)

      // Should log accessing dashboard
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Middleware] Authenticated access to /dashboard')
      )

      // 2. Layout redirects to /auth/login (due to missing Supabase user)
      // 3. User now visits /auth/login with NextAuth token
      mockRequest = {
        nextUrl: { pathname: '/auth/login' }
      } as NextRequest


      await middleware(mockRequest)

      // Should log redirecting to dashboard
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Middleware] Authenticated user on auth route, redirecting to dashboard')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Fixed Auth Integration', () => {
    it('should use consistent authentication source', async () => {
      // This test ensures we fix the auth source consistency

      // Scenario: After fix, both middleware and layout should use NextAuth
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User'
      }
      mockGetToken.mockResolvedValue(mockToken)

      // Test that middleware uses NextAuth (current behavior - correct)
      const mockRequest = {
        nextUrl: { pathname: '/dashboard' }
      } as NextRequest

      const { middleware } = await import('@/middleware')

      const result = await middleware(mockRequest)

      expect(mockGetToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: process.env.NEXTAUTH_SECRET
      })
      expect(result).toBe(mockNextResponse)

      // After the fix, we should create a new layout that also uses NextAuth
      // This will be implemented in the fix
    })

    it('should handle OAuth callback to dashboard flow correctly', async () => {
      // Test the complete OAuth flow without redirect loops

      // 1. OAuth callback succeeds
      const mockToken = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        iat: Date.now() / 1000,
        exp: (Date.now() / 1000) + 3600
      }

      // 2. User gets redirected to /dashboard
      mockGetToken.mockResolvedValue(mockToken)
      const mockRequest = {
        nextUrl: { pathname: '/dashboard' }
      } as NextRequest

      const { middleware } = await import('@/middleware')

      const result = await middleware(mockRequest)

      // 3. Middleware should allow access
      expect(result).toBe(mockNextResponse)
      expect(NextResponse.redirect).not.toHaveBeenCalled()

      // 4. Layout should NOT redirect (after fix)
      // This will be validated once we implement the fix
    })
  })

  describe('Route Consistency Validation', () => {
    it('should ensure all components use /sign-in consistently', async () => {
      // After the fix, ensure we don't have mixed route references

      // Middleware redirects unauthenticated users to /sign-in
      mockGetToken.mockResolvedValue(null)
      const mockRequest = {
        nextUrl: {
          pathname: '/dashboard',
          clone: () => ({
            pathname: '/sign-in',
            searchParams: { set: vi.fn() }
          })
        }
      } as NextRequest

      const { middleware } = await import('@/middleware')

      await middleware(mockRequest)

      expect(NextResponse.redirect).toHaveBeenCalled()

      // The fix should ensure layout also redirects to /sign-in (not /auth/login)
    })
  })
})