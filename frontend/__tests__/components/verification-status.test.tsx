import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerificationStatus } from '@/components/auth/verification-status'

describe('VerificationStatus Component', () => {
  const testEmail = 'test@example.com'

  it('should display error state correctly', () => {
    render(
      <VerificationStatus
        email={testEmail}
        error="Something went wrong"
      />
    )

    expect(screen.getByTestId('verification-error')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should display verified state correctly', () => {
    render(
      <VerificationStatus
        email={testEmail}
        isVerified={true}
      />
    )

    expect(screen.getByTestId('verification-success')).toBeInTheDocument()
    expect(screen.getByText(/has been verified successfully/)).toBeInTheDocument()
    expect(screen.getByText(testEmail)).toBeInTheDocument()
  })

  it('should display pending state correctly', () => {
    render(
      <VerificationStatus
        email={testEmail}
        isPending={true}
      />
    )

    expect(screen.getByTestId('verification-pending')).toBeInTheDocument()
    expect(screen.getByText(/verification in progress/i)).toBeInTheDocument()
    expect(screen.getByText(testEmail)).toBeInTheDocument()
  })

  it('should display default unverified state', () => {
    render(
      <VerificationStatus
        email={testEmail}
      />
    )

    expect(screen.getByTestId('verification-info')).toBeInTheDocument()
    expect(screen.getByText(/verification email sent to/i)).toBeInTheDocument()
    expect(screen.getByText('Unverified')).toBeInTheDocument()
    expect(screen.getByText(/check your email inbox/i)).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <VerificationStatus
        email={testEmail}
        className="custom-class"
      />
    )

    const element = screen.getByTestId('verification-info')
    expect(element).toHaveClass('custom-class')
  })

  it('should prioritize error over other states', () => {
    render(
      <VerificationStatus
        email={testEmail}
        error="Error message"
        isVerified={true}
        isPending={true}
      />
    )

    expect(screen.getByTestId('verification-error')).toBeInTheDocument()
    expect(screen.queryByTestId('verification-success')).not.toBeInTheDocument()
    expect(screen.queryByTestId('verification-pending')).not.toBeInTheDocument()
  })

  it('should prioritize verified over pending state', () => {
    render(
      <VerificationStatus
        email={testEmail}
        isVerified={true}
        isPending={true}
      />
    )

    expect(screen.getByTestId('verification-success')).toBeInTheDocument()
    expect(screen.queryByTestId('verification-pending')).not.toBeInTheDocument()
  })
})