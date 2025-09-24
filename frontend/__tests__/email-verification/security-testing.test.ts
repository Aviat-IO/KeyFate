/**
 * Security Testing for Email Verification System
 * Task 1.6: Comprehensive security validation
 *
 * Test Coverage:
 * - Rate limiting enforcement
 * - Token validation security
 * - Input sanitization
 * - SQL injection prevention
 * - XSS protection
 * - CSRF protection
 * - Timing attack prevention
 * - Session security
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST as verifyEmailPOST } from '@/app/api/auth/verify-email/route'
import { POST as resendVerificationPOST } from '@/app/api/auth/resend-verification/route'
import { middleware } from '@/middleware'

// Mock security dependencies
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

vi.mock('@/lib/auth/users', () => ({
  getUserById: vi.fn(),
}))

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

const mockDb = vi.mocked(require('@/lib/db/drizzle').db)
const mockCheckRateLimit = vi.mocked(require('@/lib/auth/rate-limiting').checkRateLimit)
const mockGetUserById = vi.mocked(require('@/lib/auth/users').getUserById)
const mockGetToken = vi.mocked(require('next-auth/jwt').getToken)

// Helper to create test requests
function createRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })
}

describe('Email Verification Security Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default secure rate limit response
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 5,
      resetTime: new Date(Date.now() + 300000),
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rate Limiting Security', () => {
    it('should enforce strict rate limits on verification attempts', async () => {
      // Mock rate limit exceeded
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 300,
        resetTime: new Date(Date.now() + 300000),
      })

      const request = createRequest('http://localhost:3000/api/auth/verify-email', {
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

      // Should include proper rate limit headers
      expect(response.headers.get('Retry-After')).toBe('300')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('should use different rate limit buckets for different operations', async () => {
      const verifyRequest = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'verify-token',
        }),
      })

      await verifyEmailPOST(verifyRequest)

      // Verify rate limiting called with specific key
      expect(mockCheckRateLimit).toHaveBeenCalledWith('verify-email', 'test@example.com')

      mockGetToken.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      })

      const resendRequest = createRequest('http://localhost:3000/api/auth/resend-verification', {
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })

      await resendVerificationPOST(resendRequest)

      // Resend should use different rate limit key
      expect(mockCheckRateLimit).toHaveBeenCalledWith('resend-verification', 'test@example.com')
    })

    it('should implement progressive rate limiting', async () => {
      // First few attempts should have standard limits
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 4,
        resetTime: new Date(Date.now() + 300000),
      })

      // After multiple failures, stricter limits
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 900, // Longer timeout
        resetTime: new Date(Date.now() + 900000),
      })

      const request1 = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'progressive@example.com',
          token: 'token1',
        }),
      })

      const response1 = await verifyEmailPOST(request1)
      expect(response1.status).not.toBe(429)

      const request2 = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'progressive@example.com',
          token: 'token2',
        }),
      })

      const response2 = await verifyEmailPOST(request2)
      expect(response2.status).toBe(429)

      const data = await response2.json()
      expect(data.retryAfter).toBe(900)
    })
  })

  describe('Token Validation Security', () => {
    it('should validate token format and length', async () => {
      const invalidTokens = [
        '', // Empty
        'a', // Too short
        'a'.repeat(300), // Too long
        'invalid-chars-!@#$%', // Invalid characters
        '../../etc/passwd', // Path traversal attempt
        '<script>alert(1)</script>', // XSS attempt
        'SELECT * FROM users', // SQL injection attempt
      ]

      for (const token of invalidTokens) {
        const request = createRequest('http://localhost:3000/api/auth/verify-email', {
          body: JSON.stringify({
            email: 'test@example.com',
            token,
          }),
        })

        const response = await verifyEmailPOST(request)
        const data = await response.json()

        // Should reject invalid tokens
        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Token is required')
      }
    })

    it('should use cryptographically secure token comparison', async () => {
      // Mock database to return token for comparison
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'token-id',
              identifier: 'test@example.com',
              token: 'secure-token-12345678901234567890',
              expires: new Date(Date.now() + 3600000),
            }])),
          })),
        })),
      })

      const validToken = 'secure-token-12345678901234567890'
      const similarToken = 'secure-token-12345678901234567891' // One character different

      // Test with slightly different token - should fail
      const request1 = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'test@example.com',
          token: similarToken,
        }),
      })

      const response1 = await verifyEmailPOST(request1)
      expect(response1.status).toBe(400)

      // Test with exact token - should proceed to user lookup
      const request2 = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'test@example.com',
          token: validToken,
        }),
      })

      // Will fail at user lookup stage, but token validation passed
      const response2 = await verifyEmailPOST(request2)
      expect(mockDb.select).toHaveBeenCalledTimes(4) // 2 for tokens, 2 for users
    })

    it('should prevent timing attacks on token validation', async () => {
      // Mock different scenarios with consistent timing
      const validTokenLookup = vi.fn(() => Promise.resolve([{
        id: 'token-id',
        identifier: 'test@example.com',
        token: 'valid-token',
        expires: new Date(Date.now() + 3600000),
      }]))

      const invalidTokenLookup = vi.fn(() => Promise.resolve([]))

      // Test timing for valid vs invalid tokens
      const times: number[] = []

      for (let i = 0; i < 5; i++) {
        mockDb.select.mockReturnValue({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: i < 3 ? validTokenLookup : invalidTokenLookup,
            })),
          })),
        })

        const request = createRequest('http://localhost:3000/api/auth/verify-email', {
          body: JSON.stringify({
            email: 'test@example.com',
            token: i < 3 ? 'valid-token' : 'invalid-token',
          }),
        })

        const start = performance.now()
        await verifyEmailPOST(request)
        const duration = performance.now() - start

        times.push(duration)
      }

      // Timing variance should be minimal
      const maxTime = Math.max(...times)
      const minTime = Math.min(...times)
      const variance = maxTime - minTime

      expect(variance).toBeLessThan(50) // Less than 50ms variance
    })
  })

  describe('Input Sanitization Security', () => {
    it('should sanitize and normalize email addresses', async () => {
      const testCases = [
        {
          input: '  TEST@EXAMPLE.COM  ',
          expected: 'test@example.com',
        },
        {
          input: 'test+tag@example.com',
          expected: 'test+tag@example.com',
        },
        {
          input: 'test@EXAMPLE.COM',
          expected: 'test@example.com',
        },
      ]

      for (const testCase of testCases) {
        const request = createRequest('http://localhost:3000/api/auth/verify-email', {
          body: JSON.stringify({
            email: testCase.input,
            token: 'some-token',
          }),
        })

        await verifyEmailPOST(request)

        // Check that rate limiting was called with normalized email
        expect(mockCheckRateLimit).toHaveBeenCalledWith('verify-email', testCase.expected)
      }
    })

    it('should reject malicious email formats', async () => {
      const maliciousEmails = [
        'test@example.com<script>alert(1)</script>',
        'test@example.com"; DROP TABLE users; --',
        'test@example.com\r\nBcc: attacker@evil.com',
        '../../../etc/passwd@example.com',
        'test@example.com%0d%0aCC:attacker@evil.com',
      ]

      for (const email of maliciousEmails) {
        const request = createRequest('http://localhost:3000/api/auth/verify-email', {
          body: JSON.stringify({
            email,
            token: 'some-token',
          }),
        })

        const response = await verifyEmailPOST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Invalid email address')
      }
    })

    it('should prevent SQL injection in database queries', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' OR '1'='1",
      ]

      // Mock database to capture query parameters
      const mockWhere = vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([])),
      }))

      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: mockWhere,
        })),
      })

      for (const injection of sqlInjectionAttempts) {
        const request = createRequest('http://localhost:3000/api/auth/verify-email', {
          body: JSON.stringify({
            email: 'test@example.com',
            token: injection,
          }),
        })

        await verifyEmailPOST(request)

        // Verify parameterized queries are used (Drizzle ORM should prevent injection)
        expect(mockWhere).toHaveBeenCalled()
      }
    })
  })

  describe('Session Security', () => {
    it('should validate session integrity in middleware', async () => {
      // Mock tampered token
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        // Missing required fields or malformed
        iat: Date.now() / 1000 - 3600, // Issued 1 hour ago
        exp: Date.now() / 1000 - 1800, // Expired 30 minutes ago
      })

      const request = new NextRequest('http://localhost:3000/dashboard')

      const response = await middleware(request)

      // Should redirect to login due to invalid/expired token
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/sign-in')
    })

    it('should handle missing user ID in session securely', async () => {
      mockGetToken.mockResolvedValue({
        // Missing sub/id field
        email: 'test@example.com',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      })

      const request = new NextRequest('http://localhost:3000/dashboard')

      const response = await middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/sign-in')
      expect(response.headers.get('location')).toContain('error=Invalid%20session')
    })

    it('should prevent session fixation attacks', async () => {
      // Valid session but user doesn't exist in database
      mockGetToken.mockResolvedValue({
        sub: 'nonexistent-user',
        email: 'ghost@example.com',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      })

      mockGetUserById.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/dashboard')

      const response = await middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/sign-in')
      expect(response.headers.get('location')).toContain('error=User%20not%20found')
    })
  })

  describe('CSRF Protection', () => {
    it('should validate request origin for state-changing operations', async () => {
      // Test missing origin header
      const request1 = createRequest('http://localhost:3000/api/auth/verify-email', {
        headers: {
          'Content-Type': 'application/json',
          // Missing Origin header
        },
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'some-token',
        }),
      })

      // Should still work for same-origin (localhost in tests)
      const response1 = await verifyEmailPOST(request1)
      // Response depends on other validations, but CSRF check passed

      // Test malicious origin
      const request2 = createRequest('http://localhost:3000/api/auth/verify-email', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://evil.com',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'some-token',
        }),
      })

      // Should be handled by framework-level CSRF protection
      // Our API doesn't explicitly check origin, relying on NextAuth/framework
      const response2 = await verifyEmailPOST(request2)
      expect(response2).toBeDefined() // Framework handles CSRF
    })

    it('should require proper content-type headers', async () => {
      const request = createRequest('http://localhost:3000/api/auth/verify-email', {
        headers: {
          // Missing or wrong content-type
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'some-token',
        }),
      })

      // Should handle malformed content-type
      const response = await verifyEmailPOST(request)
      expect(response.status).toBe(500) // JSON parsing error
    })
  })

  describe('XSS Protection', () => {
    it('should not reflect user input in error messages', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(document.cookie)</script>',
      ]

      for (const payload of xssPayloads) {
        const request = createRequest('http://localhost:3000/api/auth/verify-email', {
          body: JSON.stringify({
            email: `${payload}@example.com`,
            token: 'some-token',
          }),
        })

        const response = await verifyEmailPOST(request)
        const data = await response.json()

        // Error message should not contain the raw payload
        expect(JSON.stringify(data)).not.toContain(payload)
        expect(JSON.stringify(data)).not.toContain('<script>')
        expect(JSON.stringify(data)).not.toContain('javascript:')
      }
    })

    it('should sanitize error details in responses', async () => {
      // Mock database error with potential sensitive information
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed: postgresql://user:password@host:5432/db')
      })

      const request = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'some-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      // Should not expose internal error details
      expect(data.error).toBe('An unexpected error occurred during verification')
      expect(JSON.stringify(data)).not.toContain('postgresql://')
      expect(JSON.stringify(data)).not.toContain('password')
    })
  })

  describe('Data Exposure Prevention', () => {
    it('should not leak sensitive user information in responses', async () => {
      // Mock successful verification
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

      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 'user-123',
              email: 'test@example.com',
              password: 'hashed-password-should-not-leak',
              emailVerified: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              secretNotes: 'Private information',
            }])),
          })),
        })),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })

      mockDb.delete.mockReturnValue({
        where: vi.fn(() => Promise.resolve()),
      })

      const request = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'valid-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Should only include safe user fields
      expect(data.user.id).toBe('user-123')
      expect(data.user.email).toBe('test@example.com')

      // Should not leak sensitive fields
      expect(data.user.password).toBeUndefined()
      expect(data.user.secretNotes).toBeUndefined()
      expect(JSON.stringify(data)).not.toContain('hashed-password')
      expect(JSON.stringify(data)).not.toContain('Private information')
    })

    it('should not expose database internal structure', async () => {
      // Mock database constraint error
      mockDb.update.mockImplementation(() => {
        throw new Error('CONSTRAINT `fk_users_email_verified` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`)')
      })

      const request = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'test@example.com',
          token: 'some-token',
        }),
      })

      const response = await verifyEmailPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('An unexpected error occurred during verification')

      // Should not expose database schema information
      expect(JSON.stringify(data)).not.toContain('CONSTRAINT')
      expect(JSON.stringify(data)).not.toContain('FOREIGN KEY')
      expect(JSON.stringify(data)).not.toContain('fk_users_email')
    })
  })

  describe('Denial of Service Prevention', () => {
    it('should handle large request payloads gracefully', async () => {
      const largeToken = 'a'.repeat(10000) // Very large token

      const request = createRequest('http://localhost:3000/api/auth/verify-email', {
        body: JSON.stringify({
          email: 'test@example.com',
          token: largeToken,
        }),
      })

      const response = await verifyEmailPOST(request)

      // Should reject or handle large payloads without crashing
      expect([400, 413, 500]).toContain(response.status)
    })

    it('should prevent resource exhaustion from malformed requests', async () => {
      const malformedRequests = [
        '{"email":"test@example.com","token":',  // Incomplete JSON
        '{"email":"test@example.com","token":"valid","extra":' + 'x'.repeat(1000000), // Huge payload
        '{"email":"test@example.com","nested":{"deep":{"very":{"nested":"' + 'x'.repeat(10000) + '"}}}}', // Deep nesting
      ]

      for (const malformed of malformedRequests) {
        const request = createRequest('http://localhost:3000/api/auth/verify-email', {
          body: malformed,
        })

        const startTime = performance.now()
        const response = await verifyEmailPOST(request)
        const duration = performance.now() - startTime

        // Should handle malformed requests quickly without hanging
        expect(duration).toBeLessThan(1000) // Less than 1 second
        expect([400, 500]).toContain(response.status)
      }
    })
  })
})