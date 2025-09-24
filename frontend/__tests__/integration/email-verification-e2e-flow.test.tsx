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
const mockSession = {
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

describe('EmailVerificationPageNextAuth - E2E Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockClear()
    mockToast.mockClear()
    mockSearchParams.delete('email')
    mockSearchParams.delete('token')
    mockSearchParams.delete('callbackUrl')
    mockSearchParams.delete('next')
  })

  it('should display the verification page with user email', async () => {
    render(<EmailVerificationPageNextAuth />)

    await waitFor(() => {
      expect(screen.getByTestId('verification-container')).toBeInTheDocument()
    })

    // Should show the user's email
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument()

    // Should show verification UI elements
    expect(screen.getByText('Verify your email address')).toBeInTheDocument()
    expect(screen.getByText('Resend verification email')).toBeInTheDocument()
    expect(screen.getByText('Back to sign in')).toBeInTheDocument()
  })

  it('should handle the resend verification flow correctly', async () => {
    // Mock successful API response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, message: 'Verification email sent successfully' })
    } as Response)
    global.fetch = mockFetch

    render(<EmailVerificationPageNextAuth />)

    await waitFor(() => {
      expect(screen.getByText('Resend verification email')).toBeInTheDocument()
    })

    // Click resend button
    const resendButton = screen.getByText('Resend verification email')
    fireEvent.click(resendButton)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeInTheDocument()
    })

    // Should call the correct API
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      })
    })

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Email sent',
        description: 'A new verification email has been sent to your email address.'
      })
    })
  })

  it('should handle token verification flow correctly', async () => {
    // Set token in URL params
    mockSearchParams.set('token', 'valid-token')
    mockSearchParams.set('email', 'test@example.com')

    // Mock successful verification response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, verified: true })
    } as Response)
    global.fetch = mockFetch

    render(<EmailVerificationPageNextAuth />)

    // Should auto-verify with token
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: 'valid-token', email: 'test@example.com' }),
      })
    })

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument()
    })

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Email verified!',
        description: 'Your email address has been successfully verified.'
      })
    })

    // Should redirect after delay
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 3000 })
  })

  it('should handle API errors gracefully', async () => {
    // Mock API error response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ success: false, error: 'User not found' })
    } as Response)
    global.fetch = mockFetch

    render(<EmailVerificationPageNextAuth />)

    await waitFor(() => {
      expect(screen.getByText('Resend verification email')).toBeInTheDocument()
    })

    // Click resend button
    const resendButton = screen.getByText('Resend verification email')
    fireEvent.click(resendButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument()
    })
  })

  it('should handle network errors gracefully', async () => {
    // Mock network error
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    global.fetch = mockFetch

    render(<EmailVerificationPageNextAuth />)

    await waitFor(() => {
      expect(screen.getByText('Resend verification email')).toBeInTheDocument()
    })

    // Click resend button
    const resendButton = screen.getByText('Resend verification email')
    fireEvent.click(resendButton)

    // Should show network error message
    await waitFor(() => {
      expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
    })
  })

  it('should navigate back to sign in', async () => {
    render(<EmailVerificationPageNextAuth />)

    await waitFor(() => {
      expect(screen.getByText('Back to sign in')).toBeInTheDocument()
    })

    // Click back to sign in button
    const backButton = screen.getByText('Back to sign in')
    fireEvent.click(backButton)

    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })
})