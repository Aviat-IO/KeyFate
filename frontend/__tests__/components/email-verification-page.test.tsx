import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EmailVerificationPage } from '@/components/auth/email-verification-page'

// Mock next/navigation
const mockPush = vi.fn()
const mockSearchParams = {
  get: vi.fn((key: string) => {
    const params: Record<string, string> = {
      email: 'test@example.com',
      callbackUrl: '/dashboard'
    }
    return params[key] || null
  })
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams
}))

// Mock next-auth
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

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock email verification with simple functions
vi.mock('@/lib/email-verification', () => ({
  verifyEmailWithOTP: vi.fn(),
  checkEmailVerificationStatus: vi.fn().mockResolvedValue({
    isVerified: false,
    user: null,
    error: null
  }),
  resendVerificationEmail: vi.fn()
}))

describe('EmailVerificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the verification page successfully', async () => {
    render(<EmailVerificationPage />)

    // Just verify the main components are present
    await waitFor(() => {
      expect(screen.getByTestId('verification-container')).toBeInTheDocument()
    })

    expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
  })

  it('should show OTP input fields', async () => {
    render(<EmailVerificationPage />)

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox')
      expect(inputs).toHaveLength(6)
    })
  })

  it('should show continue and back to sign in buttons', async () => {
    render(<EmailVerificationPage />)

    await waitFor(() => {
      expect(screen.getByText(/continue/i)).toBeInTheDocument()
      expect(screen.getByText(/back to sign in/i)).toBeInTheDocument()
    })
  })

  it('should show resend verification button', async () => {
    render(<EmailVerificationPage />)

    await waitFor(() => {
      expect(screen.getByText(/resend verification email/i)).toBeInTheDocument()
    })
  })

  it('should have responsive design classes', async () => {
    render(<EmailVerificationPage />)

    await waitFor(() => {
      const container = screen.getByTestId('verification-container')
      expect(container).toHaveClass('min-h-screen', 'px-4', 'py-16')
    })
  })

  it('should use design system components', async () => {
    render(<EmailVerificationPage />)

    await waitFor(() => {
      const card = screen.getByTestId('verification-card')
      expect(card).toHaveClass('rounded-lg') // Card component styling
    })
  })
})