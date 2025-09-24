import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  verifyEmailWithOTP,
  sendVerificationOTP,
  checkEmailVerificationStatus,
  resendVerificationEmail,
  handleOAuthEmailVerification
} from '@/lib/email-verification'

// Mock Supabase client
const mockSupabase = {
  auth: {
    verifyOtp: vi.fn(),
    resend: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn()
  }
}

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => mockSupabase
}))

describe('Email Verification System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyEmailWithOTP', () => {
    it('should successfully verify email with valid OTP', async () => {
      // Arrange
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: '123', email_verified: true } },
        error: null
      })

      // Act
      const result = await verifyEmailWithOTP('user@example.com', '123456')

      // Assert
      expect(result.success).toBe(true)
      expect(result.user?.email_verified).toBe(true)
      expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        token: '123456',
        type: 'email'
      })
    })

    it('should handle invalid OTP error', async () => {
      // Arrange
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'Invalid OTP' }
      })

      // Act
      const result = await verifyEmailWithOTP('user@example.com', '000000')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid OTP')
    })

    it('should handle expired OTP error', async () => {
      // Arrange
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'OTP has expired' }
      })

      // Act
      const result = await verifyEmailWithOTP('user@example.com', '123456')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('OTP has expired')
    })
  })

  describe('sendVerificationOTP', () => {
    it('should successfully send OTP to email', async () => {
      // Arrange
      mockSupabase.auth.resend.mockResolvedValue({
        data: {},
        error: null
      })

      // Act
      const result = await sendVerificationOTP('user@example.com')

      // Assert
      expect(result.success).toBe(true)
      expect(mockSupabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com'
      })
    })

    it('should handle email sending failure', async () => {
      // Arrange
      mockSupabase.auth.resend.mockResolvedValue({
        data: null,
        error: { message: 'Email service unavailable' }
      })

      // Act
      const result = await sendVerificationOTP('user@example.com')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email service unavailable')
    })
  })

  describe('checkEmailVerificationStatus', () => {
    it('should return true for verified user', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { email_verified: true } },
        error: null
      })

      // Act
      const result = await checkEmailVerificationStatus()

      // Assert
      expect(result.isVerified).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should return false for unverified user', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { email_verified: false } },
        error: null
      })

      // Act
      const result = await checkEmailVerificationStatus()

      // Assert
      expect(result.isVerified).toBe(false)
      expect(result.error).toBeNull()
    })

    it('should handle user not found', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      // Act
      const result = await checkEmailVerificationStatus()

      // Assert
      expect(result.isVerified).toBe(false)
      expect(result.user).toBeNull()
    })
  })

  describe('handleOAuthEmailVerification', () => {
    it('should set email_verified to true for Google OAuth users', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'user@gmail.com',
        app_metadata: { provider: 'google' },
        email_verified: false
      }

      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: { ...mockUser, email_verified: true } },
        error: null
      })

      // Act
      const result = await handleOAuthEmailVerification(mockUser)

      // Assert
      expect(result.success).toBe(true)
      expect(result.user?.email_verified).toBe(true)
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        data: { email_verified: true }
      })
    })

    it('should skip verification for already verified users', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'user@gmail.com',
        app_metadata: { provider: 'google' },
        email_verified: true
      }

      // Act
      const result = await handleOAuthEmailVerification(mockUser)

      // Assert
      expect(result.success).toBe(true)
      expect(result.alreadyVerified).toBe(true)
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('should handle non-OAuth users appropriately', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        app_metadata: { provider: 'email' },
        email_verified: false
      }

      // Act
      const result = await handleOAuthEmailVerification(mockUser)

      // Assert
      expect(result.success).toBe(true)
      expect(result.requiresVerification).toBe(true)
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    })
  })

  describe('resendVerificationEmail', () => {
    it('should successfully resend verification email', async () => {
      // Arrange
      mockSupabase.auth.resend.mockResolvedValue({
        data: {},
        error: null
      })

      // Act
      const result = await resendVerificationEmail('user@example.com')

      // Assert
      expect(result.success).toBe(true)
      expect(mockSupabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com'
      })
    })

    it('should handle rate limiting', async () => {
      // Arrange
      mockSupabase.auth.resend.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded' }
      })

      // Act
      const result = await resendVerificationEmail('user@example.com')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })
  })
})