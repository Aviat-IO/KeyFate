import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerificationCallback } from '@/components/auth/verification-callback'

// Mock next/navigation
const mockPush = vi.fn()
const mockSearchParams = {
  get: vi.fn()
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams
}))

// Mock fetch
global.fetch = vi.fn()

describe('VerificationCallback Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    ;(global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ success: true })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should show loading state initially', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    expect(screen.getByTestId('verification-callback-loading')).toBeInTheDocument()
    expect(screen.getByText('Verifying your email...')).toBeInTheDocument()
  })

  it('should show success state after successful verification', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByTestId('verification-callback-success')).toBeInTheDocument()
      expect(screen.getByText('Email Verified!')).toBeInTheDocument()
    })
  })

  it('should call verification API with correct parameters', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'test-token',
          email: 'test@example.com'
        })
      })
    })
  })

  it('should show error state when token is missing', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { email: 'test@example.com' } // Missing token
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByTestId('verification-callback-error')).toBeInTheDocument()
      expect(screen.getByText('Verification Failed')).toBeInTheDocument()
      expect(screen.getByText(/invalid verification link/i)).toBeInTheDocument()
    })
  })

  it('should show error state when email is missing', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token' } // Missing email
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByTestId('verification-callback-error')).toBeInTheDocument()
      expect(screen.getByText(/invalid verification link/i)).toBeInTheDocument()
    })
  })

  it('should show error state when API returns error', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: 'Token expired' })
    })

    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'expired-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByTestId('verification-callback-error')).toBeInTheDocument()
      expect(screen.getByText('Token expired')).toBeInTheDocument()
    })
  })

  it('should handle network errors', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByTestId('verification-callback-error')).toBeInTheDocument()
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('should auto-redirect after successful verification', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByText(/redirecting to dashboard in 3 seconds/i)).toBeInTheDocument()
    })

    // Fast-forward timer
    vi.advanceTimersByTime(3000)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should use custom redirect URL', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback redirectUrl="/custom-dashboard" />)

    vi.advanceTimersByTime(3000)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/custom-dashboard')
    })
  })

  it('should call onSuccess callback', async () => {
    const mockOnSuccess = vi.fn()

    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback onSuccess={mockOnSuccess} />)

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('test@example.com')
    })
  })

  it('should call onError callback', async () => {
    const mockOnError = vi.fn()

    mockSearchParams.get.mockImplementation(() => null) // No params

    render(<VerificationCallback onError={mockOnError} />)

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Invalid verification link')
    })
  })

  it('should navigate to continue button', async () => {
    const user = userEvent.setup()

    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByText('Continue to Dashboard')).toBeInTheDocument()
    })

    const continueButton = screen.getByText('Continue to Dashboard')
    await user.click(continueButton)

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('should navigate to resend email from error state', async () => {
    const user = userEvent.setup()

    ;(global.fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: 'Token expired' })
    })

    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'expired-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByText('Request New Verification Email')).toBeInTheDocument()
    })

    const resendButton = screen.getByText('Request New Verification Email')
    await user.click(resendButton)

    expect(mockPush).toHaveBeenCalledWith('/auth/verify-email?email=test%40example.com')
  })

  it('should navigate back to sign in', async () => {
    const user = userEvent.setup()

    mockSearchParams.get.mockImplementation(() => null) // No params - error state

    render(<VerificationCallback />)

    await waitFor(() => {
      expect(screen.getByText('Back to Sign In')).toBeInTheDocument()
    })

    const backButton = screen.getByText('Back to Sign In')
    await user.click(backButton)

    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })

  it('should apply custom className', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      const params = { token: 'test-token', email: 'test@example.com' }
      return params[key as keyof typeof params] || null
    })

    const { container } = render(<VerificationCallback className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})