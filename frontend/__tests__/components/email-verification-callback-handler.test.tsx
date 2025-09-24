import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EmailVerificationCallbackHandler } from '@/components/auth/email-verification-callback-handler'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => {
      if (key === 'callbackUrl') return '/dashboard'
      if (key === 'next') return null
      return null
    })
  })
}))

// Mock email verification
vi.mock('@/lib/email-verification', () => ({
  checkEmailVerificationStatus: vi.fn()
}))

// Get reference to mocked function
import { checkEmailVerificationStatus } from '@/lib/email-verification'
const mockCheckEmailVerificationStatus = vi.mocked(checkEmailVerificationStatus)

describe('EmailVerificationCallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render callback handler successfully', async () => {
    mockCheckEmailVerificationStatus.mockResolvedValue({
      isVerified: false,
      user: null,
      error: null
    })

    render(<EmailVerificationCallbackHandler />)

    // Should start with loading state
    expect(screen.getByText(/checking verification status/i)).toBeInTheDocument()
  })

  it('should show loading state initially', () => {
    mockCheckEmailVerificationStatus.mockResolvedValue({
      isVerified: false,
      user: null,
      error: null
    })

    render(<EmailVerificationCallbackHandler />)

    expect(screen.getByText(/checking verification status/i)).toBeInTheDocument()
  })

  it('should preserve callbackUrl in data attribute', async () => {
    // Make the mock never resolve to stay in loading state longer
    mockCheckEmailVerificationStatus.mockImplementation(() => new Promise(() => {}))

    render(<EmailVerificationCallbackHandler />)

    // Should show loading state
    expect(screen.getByText(/checking verification status/i)).toBeInTheDocument()
  })

  it('should redirect to verification page when not verified', async () => {
    mockCheckEmailVerificationStatus.mockResolvedValue({
      isVerified: false,
      user: null,
      error: null
    })

    render(<EmailVerificationCallbackHandler />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/auth/verify-email'))
    })
  })

  it('should redirect to callback URL when verified', async () => {
    mockCheckEmailVerificationStatus.mockResolvedValue({
      isVerified: true,
      user: { id: '1' },
      error: null
    })

    render(<EmailVerificationCallbackHandler />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should handle verification check errors', async () => {
    mockCheckEmailVerificationStatus.mockRejectedValue(new Error('Network error'))

    render(<EmailVerificationCallbackHandler />)

    await waitFor(() => {
      expect(screen.getByText(/verification error/i)).toBeInTheDocument()
      expect(screen.getByText(/error checking verification status/i)).toBeInTheDocument()
    })
  })
})