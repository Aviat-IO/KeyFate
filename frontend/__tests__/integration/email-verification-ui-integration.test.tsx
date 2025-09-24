import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { EmailVerificationPageNextAuth } from '@/components/auth/email-verification-page-nextauth'

// Mock next/navigation
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key)
  })
}))

// Mock next-auth
let mockSession = {
  data: {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      emailVerified: null
    }
  },
  status: 'authenticated' as const
}

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession
}))

// Mock toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('EmailVerificationPageNextAuth - UI Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockClear()
    mockToast.mockClear()
    mockFetch.mockClear()
    mockSearchParams.delete('email')
    mockSearchParams.delete('token')
    mockSearchParams.delete('callbackUrl')
    mockSearchParams.delete('next')

    // Reset mock session
    mockSession = {
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          emailVerified: null
        }
      },
      status: 'authenticated'
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Verification Status Integration', () => {
    it('should display user email from session', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
      })
    })

    it('should show loading state initially when session is loading', () => {
      mockSession.status = 'loading'

      render(<EmailVerificationPageNextAuth />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Checking verification status...')).toBeInTheDocument()
    })

    it('should show loading state when checking verification status with token', () => {
      mockSearchParams.set('token', 'test-token')
      mockSearchParams.set('email', 'test@example.com')

      // Mock a delayed response to keep the loading state
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
          } as Response), 100)
        )
      )

      render(<EmailVerificationPageNextAuth />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Checking verification status...')).toBeInTheDocument()
    })

    it('should redirect unauthenticated users', () => {
      mockSession.status = 'unauthenticated'

      render(<EmailVerificationPageNextAuth />)

      expect(mockPush).toHaveBeenCalledWith('/sign-in')
    })
  })

  describe('Resend Verification Integration', () => {
    beforeEach(() => {
      // Mock successful resend API response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, message: 'Verification email sent successfully' })
      } as Response)
    })

    it('should call resend API with correct email', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      })
    })

    it('should show loading state during resend', async () => {
      // Mock delayed response
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
          } as Response), 100)
        )
      )

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(screen.getByText('Sending...')).toBeInTheDocument()
      })
    })

    it('should show success toast on successful resend', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Email sent',
          description: 'A new verification email has been sent to your email address.'
        })
      })
    })

    it('should handle resend API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ success: false, error: 'Rate limited' })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(screen.getByText('Rate limited')).toBeInTheDocument()
      })
    })

    it('should handle network errors during resend', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('Token Verification Integration', () => {
    beforeEach(() => {
      mockSearchParams.set('token', 'valid-token-123')
      mockSearchParams.set('email', 'test@example.com')
    })

    it('should auto-verify when token is present in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, verified: true, message: 'Email successfully verified' })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-email-nextauth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: 'valid-token-123', email: 'test@example.com' }),
        })
      })
    })

    it('should show success state and redirect after verification', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, verified: true })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Email verified!',
          description: 'Your email address has been successfully verified.'
        })
      }, { timeout: 3000 })

      // Should redirect after 2 seconds
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      }, { timeout: 3000 })
    })

    it('should handle verification API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ success: false, error: 'Invalid or expired verification token' })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired verification token')).toBeInTheDocument()
      })
    })

    it('should handle network errors during verification', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
      })
    })

    it('should use callback URL from search params', async () => {
      mockSearchParams.set('callbackUrl', '/custom-redirect')

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, verified: true })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/custom-redirect')
      }, { timeout: 3000 })
    })

    it('should use next URL parameter as fallback', async () => {
      mockSearchParams.delete('callbackUrl')
      mockSearchParams.set('next', '/fallback-redirect')

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, verified: true })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/fallback-redirect')
      }, { timeout: 3000 })
    })
  })

  describe('Error Handling Integration', () => {
    it('should disable resend button when email is not available', async () => {
      mockSession.data!.user!.email = undefined

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')

      // Button should be disabled when no email is available
      expect(resendButton).toHaveAttribute('disabled')
    })

    it('should clear error when retrying operations', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ success: false, error: 'First error' })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      // First attempt - should show error
      const resendButton = screen.getByText('Resend verification email')
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument()
      })

      // Mock successful response for retry
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      } as Response)

      // Second attempt - should clear error
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Session State Integration', () => {
    it('should handle loading session state', () => {
      mockSession.status = 'loading'

      render(<EmailVerificationPageNextAuth />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Checking verification status...')).toBeInTheDocument()
    })

    it('should handle session without user data', () => {
      mockSession.data = null
      mockSession.status = 'authenticated'

      render(<EmailVerificationPageNextAuth />)

      // Should still render but with empty email
      expect(screen.getByTestId('verification-container')).toBeInTheDocument()
    })
  })

  describe('Navigation Integration', () => {
    it('should navigate back to sign in', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Back to sign in')).toBeInTheDocument()
      })

      const backButton = screen.getByText('Back to sign in')
      fireEvent.click(backButton)

      expect(mockPush).toHaveBeenCalledWith('/sign-in')
    })
  })
})