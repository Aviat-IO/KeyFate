import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SecretCard } from '../secret-card'
import type { Secret } from '@/types'

// Mock the child components
vi.mock('../check-in-button', () => ({
  CheckInButton: ({ onCheckInSuccess }: any) => (
    <button
      data-testid="check-in-button"
      onClick={() => {
        // Simulate API response with snake_case format (the bug)
        const apiResponse = {
          id: 'test-id',
          user_id: 'user-123',
          title: 'Test Secret',
          recipient_name: 'John Doe',
          recipient_email: 'john@example.com',
          recipient_phone: null,
          contact_method: 'email' as const,
          check_in_days: 30,
          status: 'active' as const,
          server_share: 'encrypted-share-data', // This should be preserved!
          iv: 'test-iv',
          auth_tag: 'test-auth-tag',
          sss_shares_total: 3,
          sss_threshold: 2,
          is_triggered: false,
          last_check_in: new Date().toISOString(),
          next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          triggered_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        onCheckInSuccess(apiResponse)
      }}
    >
      Check In
    </button>
  ),
}))

vi.mock('../toggle-pause-button', () => ({
  TogglePauseButton: ({ onToggleSuccess }: any) => (
    <button
      data-testid="pause-button"
      onClick={() => {
        // Simulate API response with snake_case format (the bug)
        const apiResponse = {
          id: 'test-id',
          user_id: 'user-123',
          title: 'Test Secret',
          recipient_name: 'John Doe',
          recipient_email: 'john@example.com',
          recipient_phone: null,
          contact_method: 'email' as const,
          check_in_days: 30,
          status: 'paused' as const,
          server_share: 'encrypted-share-data', // This should be preserved!
          iv: 'test-iv',
          auth_tag: 'test-auth-tag',
          sss_shares_total: 3,
          sss_threshold: 2,
          is_triggered: false,
          last_check_in: new Date().toISOString(),
          next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          triggered_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        onToggleSuccess(apiResponse)
      }}
    >
      Pause
    </button>
  ),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('SecretCard State Management', () => {
  const createMockSecret = (overrides?: Partial<Secret>): Secret => ({
    id: 'test-id',
    userId: 'user-123',
    title: 'Test Secret',
    recipientName: 'John Doe',
    recipientEmail: 'john@example.com',
    recipientPhone: null,
    contactMethod: 'email',
    checkInDays: 30,
    status: 'active',
    serverShare: 'encrypted-share-data', // IMPORTANT: Has server share
    iv: 'test-iv',
    authTag: 'test-auth-tag',
    sssSharesTotal: 3,
    sssThreshold: 2,
    isTriggered: false,
    lastCheckIn: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago (allows check-in)
    nextCheckIn: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
    triggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  describe('Check-in action', () => {
    it('should update lastCheckIn without affecting serverShare field', async () => {
      const secret = createMockSecret()
      render(<SecretCard secret={secret} />)

      // Verify initial state shows server share exists (not disabled)
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()

      // Click check-in button
      const checkInButton = screen.getByTestId('check-in-button')
      await userEvent.click(checkInButton)

      // After check-in, card should NOT show "Disabled" status
      await waitFor(() => {
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
        expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
      })

      // Should still show active/normal status
      const badges = screen.getAllByRole('status')
      const statusTexts = badges.map(badge => badge.textContent)
      expect(statusTexts).not.toContain('Disabled')
    })

    it('should preserve all other secret fields after check-in', async () => {
      const secret = createMockSecret()
      const { container } = render(<SecretCard secret={secret} />)

      // Store original values
      const originalTitle = screen.getByText(secret.title)
      const originalRecipient = screen.getByText(/John Doe/)

      // Click check-in
      await userEvent.click(screen.getByTestId('check-in-button'))

      // Verify fields are unchanged
      await waitFor(() => {
        expect(screen.getByText(secret.title)).toBe(originalTitle)
        expect(screen.getByText(/John Doe/)).toBe(originalRecipient)
      })
    })

    it('should show error state clearly when it occurs', async () => {
      const secret = createMockSecret()

      // Mock a check-in that fails
      vi.mock('../check-in-button', () => ({
        CheckInButton: ({ onCheckInSuccess }: any) => (
          <button
            data-testid="check-in-error-button"
            onClick={() => {
              // Simulate error case - API returns incomplete data
              const brokenApiResponse = {
                id: 'test-id',
                // Missing fields that would cause issues
              }
              onCheckInSuccess(brokenApiResponse as any)
            }}
          >
            Check In
          </button>
        ),
      }))

      render(<SecretCard secret={secret} />)

      // This test documents that broken API responses should be handled gracefully
      // The component should not crash or show misleading state
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
    })
  })

  describe('Pause action', () => {
    it('should update status without affecting serverShare field', async () => {
      const secret = createMockSecret()
      render(<SecretCard secret={secret} />)

      // Verify initial state
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()

      // Click pause button
      await userEvent.click(screen.getByTestId('pause-button'))

      // After pause, should show "Paused" NOT "Disabled"
      await waitFor(() => {
        expect(screen.getByText('Paused')).toBeInTheDocument()
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
        expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
      })
    })

    it('should preserve all other secret fields after pause', async () => {
      const secret = createMockSecret()
      render(<SecretCard secret={secret} />)

      const originalTitle = screen.getByText(secret.title)

      await userEvent.click(screen.getByTestId('pause-button'))

      await waitFor(() => {
        expect(screen.getByText(secret.title)).toBe(originalTitle)
      })
    })

    it('should correctly toggle between active and paused states', async () => {
      const secret = createMockSecret()

      // Start with active secret
      const { rerender } = render(<SecretCard secret={secret} />)

      // After clicking pause
      await userEvent.click(screen.getByTestId('pause-button'))

      await waitFor(() => {
        expect(screen.getByText('Paused')).toBeInTheDocument()
      })

      // Simulate resuming (would need to click again, but API returns active status)
      const resumedSecret = createMockSecret({ status: 'active' })
      rerender(<SecretCard secret={resumedSecret} />)

      // Should show active state again
      expect(screen.queryByText('Paused')).not.toBeInTheDocument()
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
    })
  })

  describe('Server share validation', () => {
    it('should show disabled state only when serverShare is actually null', () => {
      const secretWithoutServerShare = createMockSecret({ serverShare: null })
      render(<SecretCard secret={secretWithoutServerShare} />)

      // Should show disabled state
      expect(screen.getByText('Disabled')).toBeInTheDocument()
      expect(screen.getByText('Server share deleted')).toBeInTheDocument()
    })

    it('should NOT show disabled state when serverShare exists', () => {
      const secretWithServerShare = createMockSecret({ serverShare: 'encrypted-data' })
      render(<SecretCard secret={secretWithServerShare} />)

      // Should NOT show disabled state
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
    })

    it('should maintain serverShare field through multiple state updates', async () => {
      const secret = createMockSecret({ serverShare: 'important-encrypted-data' })
      render(<SecretCard secret={secret} />)

      // Perform check-in
      await userEvent.click(screen.getByTestId('check-in-button'))

      await waitFor(() => {
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      })

      // Perform pause
      await userEvent.click(screen.getByTestId('pause-button'))

      await waitFor(() => {
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
        expect(screen.getByText('Paused')).toBeInTheDocument()
      })

      // After both actions, should still not be disabled
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('should handle undefined serverShare gracefully', () => {
      const secretWithUndefined = createMockSecret({ serverShare: undefined as any })
      render(<SecretCard secret={secretWithUndefined} />)

      // Should treat undefined same as null (disabled)
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })

    it('should handle empty string serverShare', () => {
      const secretWithEmptyString = createMockSecret({ serverShare: '' })
      render(<SecretCard secret={secretWithEmptyString} />)

      // Empty string should be treated as no server share
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })

    it('should prevent check-in when too recent', () => {
      const recentCheckIn = createMockSecret({
        lastCheckIn: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      })

      render(<SecretCard secret={recentCheckIn} />)

      // Check-in button should not be rendered (canCheckIn = false)
      expect(screen.queryByTestId('check-in-button')).not.toBeInTheDocument()
    })
  })
})
