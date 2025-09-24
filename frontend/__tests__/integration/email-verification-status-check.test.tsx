import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('EmailVerificationPageNextAuth - Verification Status Check', () => {
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

  it('should check verification status on mount for authenticated users', async () => {
    // Mock unverified user response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        isVerified: false,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          emailVerified: null
        }
      })
    } as Response)

    render(<EmailVerificationPageNextAuth />)

    // Should call verification status API
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/verification-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })

    // Should show verification page for unverified user
    await waitFor(() => {
      expect(screen.getByText('Verify your email address')).toBeInTheDocument()
    })
  })

  it('should redirect already verified users', async () => {
    // Mock verified user response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        isVerified: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          emailVerified: '2023-01-01T00:00:00Z'
        }
      })
    } as Response)

    render(<EmailVerificationPageNextAuth />)

    // Should check verification status
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/verification-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })

    // Should redirect verified user
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should redirect to custom callback URL for verified users', async () => {
    mockSearchParams.set('callbackUrl', '/custom-redirect')

    // Mock verified user response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        isVerified: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          emailVerified: '2023-01-01T00:00:00Z'
        }
      })
    } as Response)

    render(<EmailVerificationPageNextAuth />)

    // Should redirect to custom URL
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/custom-redirect')
    })
  })

  it('should handle verification status API errors', async () => {
    // Mock API error response
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({
        success: false,
        error: 'Not authenticated'
      })
    } as Response)

    render(<EmailVerificationPageNextAuth />)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument()
    })
  })

  it('should handle network errors during status check', async () => {
    // Mock network error
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<EmailVerificationPageNextAuth />)

    // Should show network error message
    await waitFor(() => {
      expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
    })
  })

  it('should not check status when token is present in URL', async () => {
    mockSearchParams.set('token', 'test-token')
    mockSearchParams.set('email', 'test@example.com')

    // Mock token verification response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, verified: true })
    } as Response)

    render(<EmailVerificationPageNextAuth />)

    // Should call verify-email-nextauth instead of verification-status
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: 'test-token', email: 'test@example.com' }),
      })
    })

    // Should NOT call verification-status
    expect(mockFetch).not.toHaveBeenCalledWith('/api/auth/verification-status', expect.any(Object))
  })

  it('should not check status for unauthenticated users', () => {
    mockSession.status = 'unauthenticated'

    render(<EmailVerificationPageNextAuth />)

    // Should not call verification status API
    expect(mockFetch).not.toHaveBeenCalled()

    // Should redirect to sign in
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })

  it('should not check status for loading session', () => {
    mockSession.status = 'loading'

    render(<EmailVerificationPageNextAuth />)

    // Should not call verification status API
    expect(mockFetch).not.toHaveBeenCalled()

    // Should show loading state
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })
})