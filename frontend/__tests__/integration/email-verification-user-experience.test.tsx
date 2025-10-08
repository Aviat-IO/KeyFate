import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('EmailVerificationPageNextAuth - User Experience Tests', () => {
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

  describe('Accessibility and Usability', () => {
    it('should have proper ARIA labels and accessible elements', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, isVerified: false })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByTestId('verification-container')).toBeInTheDocument()
      })

      // Check for proper headings
      expect(screen.getByRole('heading', { name: /verify your email address/i })).toBeInTheDocument()

      // Check for accessible buttons
      const resendButton = screen.getByRole('button', { name: /resend verification email/i })
      expect(resendButton).toBeInTheDocument()
      expect(resendButton).not.toHaveAttribute('aria-disabled', 'true')

      const backButton = screen.getByRole('button', { name: /back to sign in/i })
      expect(backButton).toBeInTheDocument()
    })

    it('should have proper loading states with accessible feedback', async () => {
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

      // Should show accessible loading state
      await waitFor(() => {
        expect(screen.getByText('Sending...')).toBeInTheDocument()
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      })

      // Button should be disabled during loading
      expect(resendButton).toHaveAttribute('disabled')
    })

    it('should provide clear error messages to users', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ success: false, error: 'Too many requests. Please wait before trying again.' })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByText('Resend verification email')).toBeInTheDocument()
      })

      const resendButton = screen.getByText('Resend verification email')
      fireEvent.click(resendButton)

      // Should show clear error message
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert')
        expect(errorAlert).toBeInTheDocument()
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument()
      })
    })
  })

  describe('Performance and Responsiveness', () => {
    it('should handle rapid button clicks gracefully', async () => {
      // First call: verification status check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, isVerified: false })
      } as Response)

      let resolvePromise: (value: any) => void
      mockFetch.mockImplementation(() =>
        new Promise(resolve => {
          resolvePromise = resolve
        })
      )

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
      })

      const resendButton = screen.getByRole('button', { name: /resend verification email/i })

      // Click multiple times rapidly
      fireEvent.click(resendButton)
      fireEvent.click(resendButton)
      fireEvent.click(resendButton)

      // Should only make one API call (plus the initial status check)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Button should be disabled
      expect(resendButton).toHaveAttribute('disabled')

      // Resolve the promise
      resolvePromise!({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      })

      await waitFor(() => {
        expect(screen.queryByText('Sending...')).not.toBeInTheDocument()
      })
    })

    it('should clear errors when retrying operations', async () => {
      // First call for status check - return not verified
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, isVerified: false })
      } as Response)

      // Second response: error from resend
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ success: false, error: 'Network error. Please try again.' })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
      })

      const resendButton = screen.getByRole('button', { name: /resend verification email/i })
      fireEvent.click(resendButton)

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      // Third response: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      } as Response)

      // Wait for cooldown to complete (or adjust mock date)
      vi.useFakeTimers()
      vi.advanceTimersByTime(61000) // Advance past 60s cooldown

      // Retry
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend verification email/i })).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }))

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
      })

      vi.useRealTimers()
    })
  })

  describe('Responsive Design', () => {
    it('should render properly on different screen sizes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, isVerified: false })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const container = screen.getByTestId('verification-container')
        expect(container).toHaveClass('min-h-screen', 'px-4', 'py-16')
      })

      const card = screen.getByTestId('verification-card')
      expect(card).toHaveClass('w-full', 'max-w-md')
    })

    it('should have proper spacing and layout', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, isVerified: false })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const cardContent = screen.getByTestId('verification-card').querySelector('[class*="space-y"]')
        expect(cardContent).toBeInTheDocument()
      })
    })
  })

  describe('Email Display and Validation', () => {
    it('should handle missing email gracefully', async () => {
      mockSession.data!.user!.email = undefined

      // First call: verification status check - should handle missing email gracefully
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ success: false, error: 'No user session found' })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        expect(screen.getByTestId('verification-container')).toBeInTheDocument()
      })

      // Should still render the page
      expect(screen.getByText('Verify your email address')).toBeInTheDocument()

      // Should show appropriate message when trying to resend without email
      const resendButton = screen.getByRole('button', { name: /resend verification email/i })

      // Button should be disabled because email is undefined
      expect(resendButton).toBeDisabled()

      fireEvent.click(resendButton)

      await waitFor(() => {
        // The error should be visible in the document
        expect(screen.getByText(/email address is required/i)).toBeInTheDocument()
      })
    })

    it('should display user email prominently', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, isVerified: false })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      await waitFor(() => {
        const emailDisplay = screen.getByText(/test@example.com/)
        expect(emailDisplay).toBeInTheDocument()
        expect(emailDisplay).toHaveClass('font-medium')
      })
    })
  })

  describe('Success Flow UX', () => {
    it('should provide clear success feedback and smooth transition', async () => {
      mockSearchParams.set('token', 'valid-token')
      mockSearchParams.set('email', 'test@example.com')

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, verified: true })
      } as Response)

      render(<EmailVerificationPageNextAuth />)

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument()
      })

      // Should have success styling
      const successIcon = screen.getByRole('img', { hidden: true }) // CheckCircle2 icon
      expect(successIcon).toHaveClass('text-green-600')

      // Should show success toast
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Email verified!',
        description: 'Your email address has been successfully verified.'
      })

      // Should redirect after delay
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      }, { timeout: 3000 })
    })
  })
})