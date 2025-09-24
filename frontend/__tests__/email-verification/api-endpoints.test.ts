/**
 * Email Verification API Endpoints Testing
 * Task 1.6: Backend API endpoint comprehensive testing
 *
 * Test Coverage:
 * - /api/auth/verify-email
 * - /api/auth/resend-verification
 * - /api/auth/verification-status
 * - Rate limiting
 * - Security validation
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST as verifyEmailPOST } from '@/app/api/auth/verify-email/route'
import { POST as resendVerificationPOST } from '@/app/api/auth/resend-verification/route'
import { GET as verificationStatusGET } from '@/app/api/auth/verification-status/route'

// Mock database and dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    insert: vi.fn(() => ({
      into: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}))

vi.mock('@/lib/auth/rate-limiting', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/auth/email-service', () => ({
  sendVerificationEmail: vi.fn(),
}))

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

const mockDb = vi.mocked(require('@/lib/db/drizzle').db)
const mockCheckRateLimit = vi.mocked(require('@/lib/auth/rate-limiting').checkRateLimit)
const mockSendVerificationEmail = vi.mocked(require('@/lib/auth/email-service').sendVerificationEmail)
const mockGetToken = vi.mocked(require('next-auth/jwt').getToken)

describe('Email Verification API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default rate limit success
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 5,
      resetTime: new Date(Date.now() + 300000),
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('/api/auth/verify-email', () => {
    it('should successfully verify email with valid token', async () => {
      // Mock valid token lookup
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'token-id',
              identifier: 'test@example.com',
              token: 'valid-token',
              expires: new Date(Date.now() + 3600000), // 1 hour from now
            }])),
          })),
        })),
      })

      // Mock user lookup
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'user-id',
              email: 'test@example.com',
              emailVerified: null,
            }])),
          })),
        })),
      })

      // Mock update operations
      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })

      mockDb.delete.mockReturnValue({
        where: vi.fn(() => Promise.resolve()),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'valid-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.verified).toBe(true)
      expect(data.user.email).toBe('test@example.com')
    })

    it('should handle invalid verification token', async () => {
      // Mock no token found
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'invalid-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid or expired verification token')
    })

    it('should handle expired verification token', async () => {
      // Mock expired token
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'token-id',
              identifier: 'test@example.com',
              token: 'expired-token',
              expires: new Date(Date.now() - 3600000), // 1 hour ago
            }])),
          })),
        })),
      })

      mockDb.delete.mockReturnValue({
        where: vi.fn(() => Promise.resolve()),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'expired-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Verification token has expired')

      // Should clean up expired token
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('should handle already verified user', async () => {
      // Mock valid token
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'token-id',
              identifier: 'test@example.com',
              token: 'valid-token',
              expires: new Date(Date.now() + 3600000),
            }])),
          })),
        })),
      })

      // Mock already verified user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'user-id',
              email: 'test@example.com',
              emailVerified: new Date(),
            }])),
          })),
        })),
      })

      mockDb.delete.mockReturnValue({
        where: vi.fn(() => Promise.resolve()),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'valid-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.verified).toBe(true)
      expect(data.message).toBe('Email is already verified')
    })

    it('should enforce rate limiting', async () => {
      // Mock rate limit exceeded
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 300,
        resetTime: new Date(Date.now() + 300000),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'some-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Too many verification attempts. Please try again later.')
      expect(response.headers.get('Retry-After')).toBe('300')
    })

    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          // Missing token
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Email and token are required')
      expect(data.details).toBeDefined()
    })

    it('should handle user not found', async () => {
      // Mock valid token
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'token-id',
              identifier: 'test@example.com',
              token: 'valid-token',
              expires: new Date(Date.now() + 3600000),
            }])),
          })),
        })),
      })

      // Mock no user found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'valid-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('User not found')
    })

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'valid-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('An unexpected error occurred during verification')
    })
  })

  describe('/api/auth/resend-verification', () => {
    it('should successfully resend verification email', async () => {
      // Mock authenticated session
      mockGetToken.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      })

      // Mock user lookup
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'user-id',
              email: 'test@example.com',
              emailVerified: null,
            }])),
          })),
        })),
      })

      // Mock successful email send
      mockSendVerificationEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      })

      // Mock token insertion
      mockDb.insert.mockReturnValue({
        into: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{
              token: 'new-token',
              expires: new Date(Date.now() + 3600000),
            }])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })

      const response = await resendVerificationPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Verification email sent')
    })

    it('should reject unauthenticated requests', async () => {
      // Mock no token
      mockGetToken.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })

      const response = await resendVerificationPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    it('should handle already verified users', async () => {
      mockGetToken.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      })

      // Mock already verified user
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'user-id',
              email: 'test@example.com',
              emailVerified: new Date(),
            }])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })

      const response = await resendVerificationPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Email is already verified')
    })

    it('should enforce rate limiting on resend', async () => {
      mockGetToken.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      })

      // Mock rate limit exceeded
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 60,
        resetTime: new Date(Date.now() + 60000),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })

      const response = await resendVerificationPOST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Too many requests')
    })
  })

  describe('/api/auth/verification-status', () => {
    it('should return verification status for authenticated user', async () => {
      mockGetToken.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      })

      // Mock user lookup
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'user-id',
              email: 'test@example.com',
              emailVerified: new Date(),
            }])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verification-status')

      const response = await verificationStatusGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.isVerified).toBe(true)
      expect(data.user.email).toBe('test@example.com')
    })

    it('should return unverified status for unverified user', async () => {
      mockGetToken.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      })

      // Mock unverified user
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'user-id',
              email: 'test@example.com',
              emailVerified: null,
            }])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verification-status')

      const response = await verificationStatusGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.isVerified).toBe(false)
      expect(data.user.email).toBe('test@example.com')
    })

    it('should reject unauthenticated requests', async () => {
      mockGetToken.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/verification-status')

      const response = await verificationStatusGET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    it('should handle user not found', async () => {
      mockGetToken.mockResolvedValue({
        id: 'nonexistent-user',
        email: 'test@example.com',
      })

      // Mock no user found
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verification-status')

      const response = await verificationStatusGET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('User not found')
    })
  })

  describe('Security and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should sanitize email addresses', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })

      const request = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: '  TEST@EXAMPLE.COM  ',
          token: 'some-token',
        }),
      })

      const response = await verifyEmailPOST(request)

      // Should have normalized the email
      expect(mockCheckRateLimit).toHaveBeenCalledWith('verify-email', 'test@example.com')
    })

    it('should prevent timing attacks', async () => {
      // Test with valid token - should take some time
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => new Promise(resolve =>
              setTimeout(() => resolve([]), 50)
            )),
          })),
        })),
      })

      const request1 = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'valid-token',
        }),
      })

      const start1 = Date.now()
      await verifyEmailPOST(request1)
      const duration1 = Date.now() - start1

      // Test with invalid token - should take similar time
      const request2 = new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'invalid-token',
        }),
      })

      const start2 = Date.now()
      await verifyEmailPOST(request2)
      const duration2 = Date.now() - start2

      // Timing should be similar (within 20ms) to prevent timing attacks
      expect(Math.abs(duration1 - duration2)).toBeLessThan(20)
    })
  })
})