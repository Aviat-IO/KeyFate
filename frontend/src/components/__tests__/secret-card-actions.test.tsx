/**
 * Test Suite: Secret Card Action Button Integration
 *
 * Tests that check-in and pause actions correctly preserve secret state,
 * especially the critical `serverShare` field.
 *
 * BUG FIX VALIDATION: Ensures that actions don't show "Disabled" incorrectly
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SecretCard } from '../secret-card'
import type { Secret } from '@/types'
import { mapApiSecretToDrizzleShape, type ApiSecret } from '@/lib/db/secret-mapper'

// Mock the config context
vi.mock('@/contexts/ConfigContext', () => ({
  useConfig: () => ({
    config: { siteUrl: 'http://localhost:3000' }
  })
}))

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

const createTestSecret = (overrides?: Partial<Secret>): Secret => ({
  id: 'test-secret-1',
  userId: 'user-123',
  title: 'Test Secret',
  recipientName: 'John Doe',
  recipientEmail: 'john@example.com',
  recipientPhone: null,
  contactMethod: 'email',
  checkInDays: 30,
  status: 'active',
  serverShare: 'encrypted-server-share-data', // Critical field!
  iv: 'test-iv',
  authTag: 'test-auth-tag',
  sssSharesTotal: 3,
  sssThreshold: 2,
  isTriggered: false,
  lastCheckIn: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
  nextCheckIn: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
  triggeredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createApiResponse = (overrides?: Partial<ApiSecret>): ApiSecret => ({
  id: 'test-secret-1',
  user_id: 'user-123',
  title: 'Test Secret',
  recipient_name: 'John Doe',
  recipient_email: 'john@example.com',
  recipient_phone: null,
  contact_method: 'email',
  check_in_days: 30,
  status: 'active',
  server_share: 'encrypted-server-share-data', // Snake case - API format
  iv: 'test-iv',
  auth_tag: 'test-auth-tag',
  sss_shares_total: 3,
  sss_threshold: 2,
  is_triggered: false,
  last_check_in: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  next_check_in: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  triggered_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('SecretCard - Action Button State Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('Check-in Action', () => {
    it('should preserve serverShare after check-in', async () => {
      const user = userEvent.setup()
      const secret = createTestSecret()

      // Mock successful check-in API response
      const apiResponse = createApiResponse({
        last_check_in: new Date().toISOString(),
        next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, secret: apiResponse }),
      })

      render(<SecretCard secret={secret} />)

      // Verify initial state shows active (not disabled)
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()

      // Click check-in button
      const checkInButton = screen.getByRole('button', { name: /check in/i })
      await user.click(checkInButton)

      // Wait for state update
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/secrets/test-secret-1/check-in'),
          expect.any(Object)
        )
      })

      // CRITICAL: Should NOT show "Disabled" after check-in
      await waitFor(() => {
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      })

      // Should NOT show "Server share deleted" text
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()

      // Should still show active status (may appear in mobile and desktop layouts)
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    })

    it('should correctly map API response to Drizzle format', () => {
      const apiResponse = createApiResponse({
        last_check_in: new Date().toISOString(),
      })

      const mappedSecret = mapApiSecretToDrizzleShape(apiResponse)

      // Verify serverShare (camelCase) is preserved
      expect(mappedSecret.serverShare).toBe('encrypted-server-share-data')
      expect(mappedSecret.serverShare).toBeTruthy()

      // Verify it doesn't have snake_case property
      expect(mappedSecret).not.toHaveProperty('server_share')
    })

    it('should handle null serverShare correctly', async () => {
      const user = userEvent.setup()
      const secret = createTestSecret({ serverShare: null })

      render(<SecretCard secret={secret} />)

      // Should show "Disabled" for secret without server share (may appear in mobile and desktop)
      expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0)

      // Check-in button should not be visible
      expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument()
    })
  })

  describe('Pause/Resume Action', () => {
    it('should preserve serverShare after pausing', async () => {
      const user = userEvent.setup()
      const secret = createTestSecret({ status: 'active' })

      // Mock successful pause API response
      const apiResponse = createApiResponse({
        status: 'paused',
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, secret: apiResponse }),
      })

      render(<SecretCard secret={secret} />)

      // Click pause button
      const pauseButton = screen.getByRole('button', { name: /pause/i })
      await user.click(pauseButton)

      // Wait for state update
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/secrets/test-secret-1/toggle-pause'),
          expect.any(Object)
        )
      })

      // CRITICAL: Should show "Paused" not "Disabled"
      await waitFor(() => {
        expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)
      })

      // Should NOT show "Disabled"
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()

      // Should NOT show "Server share deleted"
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
    })

    it('should preserve serverShare after resuming', async () => {
      const user = userEvent.setup()
      const secret = createTestSecret({ status: 'paused' })

      // Mock successful resume API response
      const apiResponse = createApiResponse({
        status: 'active',
        last_check_in: new Date().toISOString(),
        next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, secret: apiResponse }),
      })

      render(<SecretCard secret={secret} />)

      // Click resume button
      const resumeButton = screen.getByRole('button', { name: /resume/i })
      await user.click(resumeButton)

      // Wait for state update
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/secrets/test-secret-1/toggle-pause'),
          expect.any(Object)
        )
      })

      // CRITICAL: Should show "Active" not "Disabled"
      await waitFor(() => {
        expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
      })

      // Should NOT show "Disabled"
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()

      // Should NOT show "Server share deleted"
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
    })
  })

  describe('State Preservation Edge Cases', () => {
    it('should handle empty string serverShare as disabled', () => {
      const secret = createTestSecret({ serverShare: '' as any })

      render(<SecretCard secret={secret} />)

      // Empty string should be treated as disabled
      expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0)
    })

    it('should handle undefined serverShare as disabled', () => {
      const secret = createTestSecret({ serverShare: undefined as any })

      render(<SecretCard secret={secret} />)

      // Undefined should be treated as disabled
      expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0)
    })

    it('should preserve all other fields during check-in', async () => {
      const user = userEvent.setup()
      const secret = createTestSecret()

      const apiResponse = createApiResponse({
        last_check_in: new Date().toISOString(),
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, secret: apiResponse }),
      })

      render(<SecretCard secret={secret} />)

      const checkInButton = screen.getByRole('button', { name: /check in/i })
      await user.click(checkInButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      // Title should still be displayed (may appear in mobile and desktop layouts)
      expect(screen.getAllByText('Test Secret').length).toBeGreaterThan(0)

      // Recipient should still be displayed
      expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0)
    })
  })

  describe('Optimistic Updates', () => {
    it('should not show disabled state during loading', async () => {
      const user = userEvent.setup()
      const secret = createTestSecret()

      // Mock slow API response
      global.fetch = vi.fn().mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, secret: createApiResponse() })
        }), 100))
      )

      render(<SecretCard secret={secret} />)

      const checkInButton = screen.getByRole('button', { name: /check in/i })
      await user.click(checkInButton)

      // During loading, should NOT show disabled
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      }, { timeout: 200 })
    })
  })
})
