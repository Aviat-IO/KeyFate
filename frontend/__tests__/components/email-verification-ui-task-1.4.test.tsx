/**
 * Task 1.4: Email Verification UI Components and User Flows - TDD Test Suite
 *
 * This test suite validates the requirements for Task 1.4:
 * 1. Email verification page component at /auth/verify-email
 * 2. OTP/token input form with proper validation
 * 3. Resend verification email functionality with rate limiting
 * 4. Clear user feedback for verification status (success/error/pending)
 * 5. Responsive design and accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmailVerificationPageNextAuth } from '@/components/auth/email-verification-page-nextauth'

// Mock modules
const mockPush = vi.fn()
const mockToast = vi.fn()
let mockSearchParams = new Map<string, string>()
let mockSessionData = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    emailVerified: false
  }
}
let mockSessionStatus = 'authenticated'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null
  })
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: mockSessionData,
    status: mockSessionStatus
  })
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

// Mock API responses
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Task 1.4: Email Verification UI Components and User Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.clear()
    mockSearchParams.set('email', 'test@example.com')
    mockSessionData = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        emailVerified: false
      }
    }
    mockSessionStatus = 'authenticated'

    // Default successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/auth/verification-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, isVerified: false })
        })
      }
      if (url.includes('/api/auth/resend-verification')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      }
      if (url.includes('/api/auth/verify-email-nextauth')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Email verification page component rendering', () => {
    it('should render the verification page with proper structure', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByTestId('verification-container')).toBeInTheDocument()
        expect(screen.getByTestId('verification-card')).toBeInTheDocument()
      })

      expect(screen.getByText('Verify your email address')).toBeInTheDocument()
      expect(screen.getByText(/We need to verify your email address/)).toBeInTheDocument()
    })

    it('should display the user email address correctly', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
      })
    })

    it('should show loading state when checking verification status', () => {
      render(<EmailVerificationPageNextAuth />)

      // Should show loading initially
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Checking verification status...')).toBeInTheDocument()
    })

    it('should redirect unauthenticated users to sign in', async () => {
      mockSessionStatus = 'unauthenticated'

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/sign-in')
      })
    })
  })

  describe('2. Token verification functionality', () => {
    it('should automatically verify token when provided in URL', async () => {
      mockSearchParams.set('token', 'test-verification-token')
      mockSearchParams.set('email', 'test@example.com')

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-email-nextauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'test-verification-token',
            email: 'test@example.com'
          })
        })
      })
    })

    it('should show success state after successful token verification', async () => {
      mockSearchParams.set('token', 'test-verification-token')
      mockSearchParams.set('email', 'test@example.com')

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument()
        expect(screen.getByLabelText('Success checkmark')).toBeInTheDocument()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Email verified!',
        description: 'Your email address has been successfully verified.'
      })
    })

    it('should handle token verification errors gracefully', async () => {
      mockSearchParams.set('token', 'invalid-token')
      mockSearchParams.set('email', 'test@example.com')

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auth/verify-email-nextauth')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: false, error: 'Invalid token' })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, isVerified: false })
        })
      })

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText('Invalid token')).toBeInTheDocument()
      })
    })

    it('should redirect to callback URL after successful verification', async () => {
      mockSearchParams.set('token', 'test-verification-token')
      mockSearchParams.set('email', 'test@example.com')
      mockSearchParams.set('callbackUrl', '/custom-dashboard')

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument()
      })

      // Wait for redirect timeout
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2100))
      })

      expect(mockPush).toHaveBeenCalledWith('/custom-dashboard')
    })
  })

  describe('3. Resend verification email functionality', () => {
    it('should display resend button', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })
    })

    it('should send resend request when button clicked', async () => {
      const user = userEvent.setup()
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const resendButton = screen.getByText('Resend verification email')
        expect(resendButton).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      await user.click(resendButton)

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' })
      })
    })

    it('should show loading state during resend process', async () => {
      const user = userEvent.setup()

      // Mock delayed response to test loading state
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auth/resend-verification')) {
          return new Promise(resolve =>
            setTimeout(() => resolve({
              ok: true,
              json: () => Promise.resolve({ success: true })
            }), 100)
          )
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, isVerified: false })
        })
      })

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const resendButton = screen.getByText('Resend verification email')
        expect(resendButton).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      await user.click(resendButton)

      expect(screen.getByText('Sending...')).toBeInTheDocument()
      expect(resendButton).toBeDisabled()
    })

    it('should show success toast after successful resend', async () => {
      const user = userEvent.setup()
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const resendButton = screen.getByText('Resend verification email')
        expect(resendButton).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      await user.click(resendButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Email sent',
          description: 'A new verification email has been sent to your email address.'
        })
      })
    })

    it('should handle resend errors gracefully', async () => {
      const user = userEvent.setup()

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auth/resend-verification')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: false, error: 'Rate limit exceeded' })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, isVerified: false })
        })
      })

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const resendButton = screen.getByText('Resend verification email')
        expect(resendButton).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      await user.click(resendButton)

      await waitFor(() => {
        expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
      })
    })

    it('should prevent rapid clicks on resend button', async () => {
      const user = userEvent.setup()
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const resendButton = screen.getByText('Resend verification email')
        expect(resendButton).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')

      // First click should trigger API call
      await user.click(resendButton)

      // Wait for loading state to finish
      await waitFor(() => {
        expect(screen.queryByText('Sending...')).not.toBeInTheDocument()
      })

      // Get call count after first successful click
      const callCountAfterFirst = mockFetch.mock.calls.length

      // Additional rapid clicks should not trigger more API calls
      await user.click(resendButton)
      await user.click(resendButton)

      // Should not have made additional API calls (rate limited)
      expect(mockFetch).toHaveBeenCalledTimes(callCountAfterFirst)
    })
  })

  describe('4. User feedback and status display', () => {
    it('should show error messages in accessible alert component', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auth/verification-status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: false, error: 'Verification check failed' })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert')
        expect(errorAlert).toBeInTheDocument()
        expect(screen.getByText('Verification check failed')).toBeInTheDocument()
      })
    })

    it('should show loading indicators during API calls', async () => {
      render(<EmailVerificationPageNextAuth />)

      // Should show initial loading
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Checking verification status...')).toBeInTheDocument()
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
      })
    })

    it('should redirect already verified users', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auth/verification-status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, isVerified: true })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('5. Responsive design and accessibility', () => {
    it('should have responsive container classes', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const container = screen.getByTestId('verification-container')
        expect(container).toHaveClass('min-h-screen', 'px-4', 'py-16')
      })
    })

    it('should have proper card sizing for mobile and desktop', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const card = screen.getByTestId('verification-card')
        expect(card).toHaveClass('w-full', 'max-w-md')
      })
    })

    it('should have proper ARIA labels and roles', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        // Check for proper roles and labels
        expect(screen.getByRole('alert', { hidden: true })).toBeInTheDocument()
      })
    })

    it('should have accessible button states', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const resendButton = screen.getByRole('button', { name: /resend verification email/i })
        expect(resendButton).toBeInTheDocument()
        expect(resendButton).not.toBeDisabled()
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const resendButton = screen.getByRole('button', { name: /resend verification email/i })
        expect(resendButton).toBeInTheDocument()
      })

      const resendButton = screen.getByRole('button', { name: /resend verification email/i })
      const backButton = screen.getByRole('button', { name: /back to sign in/i })

      // Focus on resend button specifically
      resendButton.focus()
      expect(resendButton).toHaveFocus()

      // Should be activatable with Enter
      await user.keyboard('{Enter}')
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', expect.any(Object))
    })

    it('should have proper heading hierarchy', async () => {
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 })
        expect(heading).toBeInTheDocument()
        expect(heading).toHaveTextContent('Verify your email address')
      })
    })
  })

  describe('Navigation and user flows', () => {
    it('should provide back to sign in functionality', async () => {
      const user = userEvent.setup()
      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const backButton = screen.getByText('Back to sign in')
        expect(backButton).toBeInTheDocument()
      })

      const backButton = screen.getByText('Back to sign in')
      await user.click(backButton)

      expect(mockPush).toHaveBeenCalledWith('/sign-in')
    })

    it('should handle different callback URLs', async () => {
      mockSearchParams.set('callbackUrl', '/custom-redirect')
      mockSearchParams.set('token', 'test-token')

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument()
      })

      // Wait for redirect
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2100))
      })

      expect(mockPush).toHaveBeenCalledWith('/custom-redirect')
    })

    it('should default to dashboard if no callback URL provided', async () => {
      mockSearchParams.delete('callbackUrl')
      mockSearchParams.set('token', 'test-token')

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument()
      })

      // Wait for redirect
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2100))
      })

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})