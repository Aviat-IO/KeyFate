import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/secrets/route'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'

// Mock NextAuth
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn()
}))

// Mock Drizzle services
vi.mock('@/lib/db/drizzle', () => ({
  secretsService: {
    create: vi.fn()
  }
}))

// Mock RobustSecretsService
vi.mock('@/lib/db/secrets-service-robust', () => ({
  RobustSecretsService: vi.fn()
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

import { secretsService } from '@/lib/db/drizzle'
import { RobustSecretsService } from '@/lib/db/secrets-service-robust'
import { encryptMessage } from '@/lib/encryption'
import { secretSchema } from '@/lib/schemas/secret'

const mockGetServerSession = getServerSession as any
const mockSecretsService = secretsService as any
const mockRobustSecretsService = RobustSecretsService as any
const mockEncryptMessage = encryptMessage as any
const mockSecretSchema = secretSchema as any

describe('Complete Authentication Workflow Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication Fix Validation', () => {
    it('should handle complete Google OAuth → Form Submission → API flow', async () => {
      // Step 1: User signs in via Google OAuth (NextAuth handles this)
      const googleOAuthSession = {
        user: {
          id: 'google-oauth-user-123',
          email: 'user@gmail.com',
          name: 'Google User',
          image: 'https://lh3.googleusercontent.com/...'
        },
        expires: '2024-12-31T23:59:59.999Z'
      }

      // Step 2: Layout calls getServerSession(authConfig) - should work
      mockGetServerSession.mockResolvedValue(googleOAuthSession)

      // Step 3: Form submits secret data to /api/secrets
      const secretFormData = {
        title: 'Family Safe Combination',
        server_share: 'deadbeef1234567890abcdef', // Hex-encoded SSS share
        recipient_name: 'My Spouse',
        recipient_email: 'spouse@example.com',
        recipient_phone: '',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }

      mockSecretSchema.parse.mockReturnValue(secretFormData)

      // Step 4: API encrypts server share
      mockEncryptMessage.mockResolvedValue({
        encrypted: 'encrypted-server-share-data',
        iv: 'initialization-vector',
        authTag: 'authentication-tag'
      })

      // Step 5: API stores in database using Drizzle ORM
      const mockCreatedSecret = {
        id: 'secret-uuid-123',
        title: 'Family Safe Combination',
        userId: 'google-oauth-user-123',
        serverShare: 'encrypted-server-share-data',
        iv: 'initialization-vector',
        authTag: 'authentication-tag',
        recipientEmail: 'spouse@example.com',
        nextCheckIn: new Date('2024-03-01T00:00:00.000Z')
      }
      mockSecretsService.create.mockResolvedValue(mockCreatedSecret)

      // Step 6: Make API request
      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(secretFormData),
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'next-auth.session-token=mock-session-token'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      // Step 7: Verify successful response
      expect(response.status).toBe(200)
      expect(result.secretId).toBe('secret-uuid-123')
      expect(result.title).toBe('Family Safe Combination')

      // Step 8: Verify authentication flow was correct
      expect(mockGetServerSession).toHaveBeenCalledTimes(1)
      expect(mockEncryptMessage).toHaveBeenCalledWith('deadbeef1234567890abcdef')
      expect(mockSecretsService.create).toHaveBeenCalledTimes(1)

      // Step 9: Verify user_id from NextAuth session was used
      const insertedData = mockSecretsService.create.mock.calls[0][0]
      expect(insertedData.userId).toBe('google-oauth-user-123')
      expect(insertedData.serverShare).toBe('encrypted-server-share-data')
    })

    it('should reject requests when user is not authenticated via Google OAuth', async () => {
      // No NextAuth session (user not signed in)
      mockGetServerSession.mockResolvedValue(null)

      const secretFormData = {
        title: 'Test Secret',
        server_share: 'abc123',
        recipient_name: 'Test User',
        recipient_email: 'test@example.com',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }

      mockSecretSchema.parse.mockReturnValue(secretFormData)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(secretFormData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')

      // Should not proceed to database operations
      expect(mockEncryptMessage).not.toHaveBeenCalled()
      expect(mockSecretsService.create).not.toHaveBeenCalled()
    })

    it('should handle expired or invalid NextAuth sessions', async () => {
      // Simulate NextAuth session validation error
      mockGetServerSession.mockRejectedValue(new Error('JWT token expired'))

      const secretFormData = {
        title: 'Test Secret',
        server_share: 'abc123',
        recipient_name: 'Test User',
        recipient_email: 'test@example.com',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }

      mockSecretSchema.parse.mockReturnValue(secretFormData)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(secretFormData),
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'next-auth.session-token=expired-token'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
    })
  })

  describe('Form Compatibility Validation', () => {
    it('should work with the exact payload structure from newSecretForm.tsx', async () => {
      // Mock valid NextAuth session
      mockGetServerSession.mockResolvedValue({
        user: { id: 'form-user-123', email: 'form@example.com' }
      })

      // This matches the exact structure from newSecretForm.tsx lines 90-100
      const formPayload = {
        title: 'Important Documents Location',
        server_share: 'a1b2c3d4e5f6', // Plain hex share from SSS
        recipient_name: 'Emergency Contact',
        recipient_email: 'emergency@family.com',
        recipient_phone: '+1234567890',
        contact_method: 'email',
        check_in_days: 90,
        sss_shares_total: 3,
        sss_threshold: 2
      }

      mockSecretSchema.parse.mockReturnValue(formPayload)
      mockEncryptMessage.mockResolvedValue({
        encrypted: 'form-encrypted-share',
        iv: 'form-iv',
        authTag: 'form-auth-tag'
      })

      const mockFormSecret = {
        id: 'form-secret-456',
        title: 'Important Documents Location',
        userId: 'form-user-123',
        serverShare: 'form-encrypted-share',
        iv: 'form-iv',
        authTag: 'form-auth-tag'
      }
      mockSecretsService.create.mockResolvedValue(mockFormSecret)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(formPayload),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.secretId).toBe('form-secret-456')

      // Verify the server share was encrypted before storage
      expect(mockEncryptMessage).toHaveBeenCalledWith('a1b2c3d4e5f6')

      // Verify encrypted data was stored
      const storedData = mockSecretsService.create.mock.calls[0][0]
      expect(storedData.serverShare).toBe('form-encrypted-share')
      expect(storedData.iv).toBe('form-iv')
      expect(storedData.authTag).toBe('form-auth-tag')
    })

    it('should handle contact method phone-only correctly', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'phone-user-123', email: 'phone@example.com' }
      })

      const phoneOnlyPayload = {
        title: 'Phone Contact Secret',
        server_share: 'phone123share',
        recipient_name: 'Phone Contact',
        recipient_email: '',
        recipient_phone: '+1987654321',
        contact_method: 'phone',
        check_in_days: 30,
        sss_shares_total: 2,
        sss_threshold: 2
      }

      mockSecretSchema.parse.mockReturnValue(phoneOnlyPayload)
      mockEncryptMessage.mockResolvedValue({
        encrypted: 'phone-encrypted',
        iv: 'phone-iv',
        authTag: 'phone-tag'
      })

      const mockPhoneSecret = {
        id: 'phone-secret-789',
        userId: 'phone-user-123',
        serverShare: 'phone-encrypted',
        iv: 'phone-iv',
        authTag: 'phone-tag'
      }
      mockSecretsService.create.mockResolvedValue(mockPhoneSecret)

      const request = new NextRequest('http://localhost:3000/api/secrets', {
        method: 'POST',
        body: JSON.stringify(phoneOnlyPayload),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // Verify recipient_email was set to null for phone-only contact
      const storedData = mockSecretsService.create.mock.calls[0][0]
      expect(storedData.recipientEmail).toBeNull()
      expect(storedData.contactMethod).toBe('phone')
    })
  })
})