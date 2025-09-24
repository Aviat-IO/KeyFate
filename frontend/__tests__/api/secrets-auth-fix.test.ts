import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/secrets/route'
import { NextRequest } from 'next/server'

// Mock NextAuth
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn()
}))

// Mock Supabase
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn()
}))

// Mock encryption
vi.mock('@/lib/encryption', () => ({
  encryptMessage: vi.fn()
}))

// Mock schemas
vi.mock('@/lib/schemas/secret', () => ({
  secretSchema: {
    parse: vi.fn()
  }
}))

// Mock Drizzle service
vi.mock('@/lib/db/drizzle', () => ({
  secretsService: {
    create: vi.fn()
  }
}))

import { getServerSession } from 'next-auth/next'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { encryptMessage } from '@/lib/encryption'
import { secretSchema } from '@/lib/schemas/secret'
import { secretsService } from '@/lib/db/drizzle'

const mockGetServerSession = getServerSession as any
const mockCreateClient = createClient as any
const mockCreateServiceRoleClient = createServiceRoleClient as any
const mockEncryptMessage = encryptMessage as any
const mockSecretSchema = secretSchema as any
const mockSecretsService = secretsService as any

describe('Secrets API Authentication Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Current Problem: Supabase Auth vs NextAuth Mismatch', () => {
    it('should succeed with valid NextAuth session (demonstrating the fix)', async () => {
      // With the fix, the API now uses NextAuth instead of Supabase auth
      const nextAuthSession = {
        user: {
          id: 'nextauth-user-123',
          email: 'user@example.com',
          name: 'Test User'
        },
        expires: '2024-12-31T23:59:59.999Z'
      }
      mockGetServerSession.mockResolvedValue(nextAuthSession)

      // Mock encryption
      mockEncryptMessage.mockResolvedValue({
        encrypted: 'encrypted-share',
        iv: 'test-iv',
        authTag: 'test-auth-tag'
      })

      // Mock secrets service for database operations
      mockSecretsService.create.mockResolvedValue({
        id: 'secret-123',
        title: 'Test Secret',
        userId: 'nextauth-user-123'
      })

      const validSecretData = {
        title: 'Test Secret',
        server_share: 'test-share-data',
        recipient_name: 'Test Recipient',
        recipient_email: 'recipient@example.com',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }
      mockSecretSchema.parse.mockReturnValue(validSecretData)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(validSecretData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      // Debug the actual response
      if (response.status !== 200) {
        console.log('Test 1 - Error response status:', response.status)
        console.log('Test 1 - Error response body:', result)
      }

      // With NextAuth fix, should succeed
      expect(response.status).toBe(200)
      expect(result.secretId).toBe('secret-123')
    })
  })

  describe('Solution: Use NextAuth for API Authentication', () => {
    it('should succeed when NextAuth session exists', async () => {
      // Mock NextAuth session (user authenticated via Google OAuth)
      const nextAuthSession = {
        user: {
          id: 'nextauth-user-123',
          email: 'user@example.com',
          name: 'Test User'
        },
        expires: '2024-12-31T23:59:59.999Z'
      }
      mockGetServerSession.mockResolvedValue(nextAuthSession)

      // Mock encryption
      mockEncryptMessage.mockResolvedValue({
        encrypted: 'encrypted-share',
        iv: 'test-iv',
        authTag: 'test-auth-tag'
      })

      // Mock secrets service for database operations
      mockSecretsService.create.mockResolvedValue({
        id: 'secret-123',
        title: 'Test Secret',
        userId: 'nextauth-user-123'
      })

      const validSecretData = {
        title: 'Test Secret',
        server_share: 'test-share-data',
        recipient_name: 'Test Recipient',
        recipient_email: 'recipient@example.com',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }
      mockSecretSchema.parse.mockReturnValue(validSecretData)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(validSecretData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      // With NextAuth fix, should succeed
      expect(response.status).toBe(200)
      expect(result.secretId).toBe('secret-123')

      // Verify secrets service was used for database operations
      expect(mockSecretsService.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'nextauth-user-123'
      }))
    })

    it('should return 401 when no NextAuth session exists', async () => {
      // No NextAuth session
      mockGetServerSession.mockResolvedValue(null)

      const validSecretData = {
        title: 'Test Secret',
        server_share: 'test-share-data',
        recipient_name: 'Test Recipient',
        recipient_email: 'recipient@example.com',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }
      mockSecretSchema.parse.mockReturnValue(validSecretData)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(validSecretData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
    })

    it('should handle NextAuth session errors gracefully', async () => {
      // NextAuth throws an error
      mockGetServerSession.mockRejectedValue(new Error('NextAuth error'))

      const validSecretData = {
        title: 'Test Secret',
        server_share: 'test-share-data',
        recipient_name: 'Test Recipient',
        recipient_email: 'recipient@example.com',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }
      mockSecretSchema.parse.mockReturnValue(validSecretData)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(validSecretData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
    })
  })

  describe('Form Integration Requirements', () => {
    it('should work with form submissions that include NextAuth cookies', async () => {
      // Mock NextAuth session from cookies
      const nextAuthSession = {
        user: {
          id: 'nextauth-user-123',
          email: 'user@example.com',
          name: 'Test User'
        }
      }
      mockGetServerSession.mockResolvedValue(nextAuthSession)

      // Mock encryption
      mockEncryptMessage.mockResolvedValue({
        encrypted: 'encrypted-share',
        iv: 'test-iv',
        authTag: 'test-auth-tag'
      })

      // Mock secrets service for database operations
      mockSecretsService.create.mockResolvedValue({
        id: 'secret-123',
        title: 'My Important Secret',
        userId: 'nextauth-user-123'
      })

      const formData = {
        title: 'My Important Secret',
        server_share: 'abc123def456',
        recipient_name: 'John Doe',
        recipient_email: 'john@example.com',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }
      mockSecretSchema.parse.mockReturnValue(formData)

      // Simulate form submission with NextAuth cookies
      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'next-auth.session-token=mock-token; path=/; secure; httponly'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.secretId).toBe('secret-123')
      expect(result.title).toBe('My Important Secret')
    })
  })
})