import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmailVerificationPage } from '@/components/auth/email-verification-page'
import { OTPInput } from '@/components/auth/otp-input'
import { EmailVerificationCallbackHandler } from '@/components/auth/email-verification-callback-handler'

// Mock hooks and utilities
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: vi.fn((key: string) => {
      const params: Record<string, string> = {
        email: 'test@example.com',
        callbackUrl: '/dashboard',
        next: '/settings'
      }
      return params[key] || null
    })
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        email: 'test@example.com',
        emailVerified: false
      }
    },
    status: 'authenticated'
  })
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock email verification functions
vi.mock('@/lib/email-verification', () => ({
  verifyEmailWithOTP: vi.fn(),
  resendVerificationEmail: vi.fn(),
  checkEmailVerificationStatus: vi.fn()
}))

// Get references to mocked functions
import { checkEmailVerificationStatus, verifyEmailWithOTP, resendVerificationEmail } from '@/lib/email-verification'
const mockCheckEmailVerificationStatus = vi.mocked(checkEmailVerificationStatus)
const mockVerifyEmailWithOTP = vi.mocked(verifyEmailWithOTP)
const mockResendVerificationEmail = vi.mocked(resendVerificationEmail)

describe('Enhanced Email Verification Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('EmailVerificationPage', () => {
    it('should render verification page with proper instructions', async () => {
      // Mock verified status as false so component doesn't redirect
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      render(<EmailVerificationPage />)

      // Wait for loading to finish and check for text using getAllByText for multiple instances
      await waitFor(() => {
        const elements = screen.getAllByText(/verify your email address/i)
        expect(elements.length).toBeGreaterThan(0)
      })

      expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
      expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument()
    })

    it('should handle callbackUrl from middleware redirects', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      render(<EmailVerificationPage />)

      await waitFor(() => {
        const continueButton = screen.getByText(/continue/i)
        expect(continueButton).toBeInTheDocument()
      })
    })

    it('should display clear messaging about verification requirements', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      render(<EmailVerificationPage />)

      await waitFor(() => {
        expect(screen.getByText(/we need to verify your email/i)).toBeInTheDocument()
        expect(screen.getByText(/before you can access/i)).toBeInTheDocument()
      })
    })

    it('should integrate with existing design system', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      render(<EmailVerificationPage />)

      await waitFor(() => {
        // Check for shadcn/ui components
        expect(screen.getByRole('button')).toHaveClass('inline-flex') // Button component
        const card = screen.getByTestId('verification-card')
        expect(card).toHaveClass('rounded-lg') // Card component
      })
    })

    it('should be responsive across all devices', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      render(<EmailVerificationPage />)

      await waitFor(() => {
        const container = screen.getByTestId('verification-container')
        expect(container).toHaveClass('min-h-screen', 'px-4', 'py-16')
      })
    })
  })

  describe('OTPInput', () => {
    const mockOnComplete = vi.fn()
    const mockOnChange = vi.fn()

    it('should render 6 input fields for OTP', () => {
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole('textbox')
      expect(inputs).toHaveLength(6)
    })

    it('should auto-focus on first input and advance focus on input', async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole('textbox')

      // First input should be focused
      expect(inputs[0]).toHaveFocus()

      // Typing should advance focus
      await user.type(inputs[0], '1')
      expect(inputs[1]).toHaveFocus()

      await user.type(inputs[1], '2')
      expect(inputs[2]).toHaveFocus()
    })

    it('should support paste functionality for full OTP', async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const firstInput = screen.getAllByRole('textbox')[0]
      firstInput.focus()

      // Simulate paste event
      await user.paste('123456')

      expect(mockOnComplete).toHaveBeenCalledWith('123456')
    })

    it('should handle backspace navigation', async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const inputs = screen.getAllByRole('textbox')

      // Type in first few inputs
      await user.type(inputs[0], '1')
      await user.type(inputs[1], '2')

      // First backspace clears current field, stays on input 1
      await user.keyboard('{Backspace}')
      expect(inputs[1]).toHaveFocus()
      expect(inputs[1]).toHaveValue('')

      // Second backspace on empty field moves to previous and clears it
      await user.keyboard('{Backspace}')
      expect(inputs[0]).toHaveFocus()
      expect(inputs[0]).toHaveValue('')
    })

    it('should only allow numeric input', async () => {
      const user = userEvent.setup()
      render(<OTPInput onComplete={mockOnComplete} onChange={mockOnChange} />)

      const firstInput = screen.getAllByRole('textbox')[0]

      await user.type(firstInput, 'abc123')

      // Should only have numeric value
      expect(firstInput).toHaveValue('1')
    })
  })

  describe('EmailVerificationCallbackHandler', () => {
    it('should handle successful verification and redirect to callbackUrl', async () => {
      const mockPush = vi.fn()
      const mockRouter = vi.fn(() => ({
        push: mockPush
      }))

      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: true,
        user: { id: '1' },
        error: null
      })

      // Mock the navigation
      vi.doMock('next/navigation', () => ({
        useRouter: mockRouter,
        useSearchParams: () => ({
          get: vi.fn(() => '/dashboard')
        })
      }))

      render(<EmailVerificationCallbackHandler />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('should handle verification errors gracefully', async () => {
      mockCheckEmailVerificationStatus.mockRejectedValue(new Error('Network error'))

      render(<EmailVerificationCallbackHandler />)

      await waitFor(() => {
        expect(screen.getByText(/error checking verification/i)).toBeInTheDocument()
      })
    })

    it('should preserve callbackUrl through verification flow', () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      const mockSearchParams = vi.fn((key: string) => {
        if (key === 'callbackUrl') return '/protected-page'
        if (key === 'next') return '/settings'
        return null
      })

      vi.doMock('next/navigation', () => ({
        useRouter: () => ({ push: vi.fn() }),
        useSearchParams: () => ({
          get: mockSearchParams
        })
      }))

      render(<EmailVerificationCallbackHandler />)

      // Should use callbackUrl as priority
      expect(screen.getByTestId('callback-handler')).toHaveAttribute('data-callback', '/protected-page')
    })
  })

  describe('Loading States', () => {
    it('should show loading spinner during verification attempts', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      mockVerifyEmailWithOTP.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))

      const user = userEvent.setup()
      render(<EmailVerificationPage />)

      // Wait for initial loading to finish
      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
      })

      // Fill OTP and complete to trigger verification
      const otpInputs = screen.getAllByRole('textbox')
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString())
      }

      await waitFor(() => {
        expect(screen.getByText(/verifying/i)).toBeInTheDocument()
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      })
    })

    it('should show loading state during resend attempts', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      mockResendVerificationEmail.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))

      const user = userEvent.setup()
      render(<EmailVerificationPage />)

      // Wait for initial loading to finish
      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
      })

      const resendButton = screen.getByText(/resend verification email/i)
      await user.click(resendButton)

      expect(screen.getByText(/sending/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error messages for invalid OTP', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      mockVerifyEmailWithOTP.mockResolvedValue({ success: false, error: 'Invalid verification code' })

      const user = userEvent.setup()
      render(<EmailVerificationPage />)

      // Wait for initial loading to finish
      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '0')
      }

      await waitFor(() => {
        expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument()
      })
    })

    it('should display error messages for expired OTP', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      mockVerifyEmailWithOTP.mockResolvedValue({ success: false, error: 'Verification code has expired' })

      const user = userEvent.setup()
      render(<EmailVerificationPage />)

      // Wait for initial loading to finish
      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '1')
      }

      await waitFor(() => {
        expect(screen.getByText(/verification code has expired/i)).toBeInTheDocument()
      })
    })

    it('should provide actionable feedback for network errors', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      mockVerifyEmailWithOTP.mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup()
      render(<EmailVerificationPage />)

      // Wait for initial loading to finish
      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '1')
      }

      await waitFor(() => {
        expect(screen.getByText(/network error.*try again/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })
  })

  describe('Rate Limiting UI Feedback', () => {
    it('should show countdown timer when rate limited', async () => {
      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      mockResendVerificationEmail.mockResolvedValue({ success: true })

      const user = userEvent.setup()
      render(<EmailVerificationPage />)

      // Wait for initial loading to finish
      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
      })

      const resendButton = screen.getByText(/resend verification email/i)
      await user.click(resendButton)

      // Should show countdown
      await waitFor(() => {
        expect(screen.getByText(/resend in \d+s/i)).toBeInTheDocument()
      })

      // Button should be disabled
      expect(resendButton).toBeDisabled()
    })

    it('should re-enable resend button after cooldown', async () => {
      vi.useFakeTimers()

      mockCheckEmailVerificationStatus.mockResolvedValue({
        isVerified: false,
        user: null,
        error: null
      })

      mockResendVerificationEmail.mockResolvedValue({ success: true })

      const user = userEvent.setup()
      render(<EmailVerificationPage />)

      // Wait for initial loading to finish
      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
      })

      const resendButton = screen.getByText(/resend verification email/i)
      await user.click(resendButton)

      // Fast-forward time
      vi.advanceTimersByTime(60000)

      await waitFor(() => {
        expect(resendButton).not.toBeDisabled()
        expect(screen.getByText(/resend verification email/i)).toBeInTheDocument()
      })

      vi.useRealTimers()
    })
  })
})