/**
 * Integration Tests: Secret Card State Management
 *
 * Tests that verify the fix for the check-in/pause state bug
 * where API responses in snake_case format were causing serverShare field loss
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SecretCard } from '../secret-card'
import type { Secret } from '@/types'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock the config context
vi.mock('@/contexts/ConfigContext', () => ({
  useConfig: () => ({
    config: { siteUrl: 'http://localhost:3000' },
  }),
}))

describe('SecretCard Integration - State Management Fix', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const createMockSecret = (overrides?: Partial<Secret>): Secret => ({
    id: 'test-secret-123',
    userId: 'user-456',
    title: 'My Important Secret',
    recipientName: 'Jane Smith',
    recipientEmail: 'jane@example.com',
    recipientPhone: null,
    contactMethod: 'email',
    checkInDays: 30,
    status: 'active',
    serverShare: 'encrypted-server-share-data-abc123', // HAS server share
    iv: 'initialization-vector',
    authTag: 'auth-tag-data',
    sssSharesTotal: 3,
    sssThreshold: 2,
    isTriggered: false,
    lastCheckIn: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    nextCheckIn: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    triggeredAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    ...overrides,
  })

  describe('Check-in Action', () => {
    it('should preserve serverShare field after check-in', async () => {
      const secret = createMockSecret()

      // Mock successful check-in API response (returns snake_case format)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          secret: {
            id: 'test-secret-123',
            user_id: 'user-456',
            title: 'My Important Secret',
            recipient_name: 'Jane Smith',
            recipient_email: 'jane@example.com',
            recipient_phone: null,
            contact_method: 'email',
            check_in_days: 30,
            status: 'active',
            server_share: 'encrypted-server-share-data-abc123', // API returns snake_case!
            iv: 'initialization-vector',
            auth_tag: 'auth-tag-data',
            sss_shares_total: 3,
            sss_threshold: 2,
            is_triggered: false,
            last_check_in: new Date().toISOString(), // Updated timestamp
            next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            triggered_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: new Date().toISOString(),
          },
        }),
      })

      render(<SecretCard secret={secret} />)

      // Verify initial state is NOT disabled
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()

      // Find and click the check-in button
      const checkInButton = screen.getByRole('button', { name: /check in/i })
      await userEvent.click(checkInButton)

      // Wait for the API call and state update
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/secrets/test-secret-123/check-in'),
          expect.objectContaining({ method: 'POST' })
        )
      })

      // CRITICAL: After check-in, should NOT show "Disabled" status
      await waitFor(() => {
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
        expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
      })

      // Should show normal active state
      const statusBadge = screen.getAllByText(/Active|Upcoming|Urgent/i)
      expect(statusBadge.length).toBeGreaterThan(0)
    })

    it('should update lastCheckIn timestamp without breaking other fields', async () => {
      const secret = createMockSecret()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          secret: {
            id: 'test-secret-123',
            user_id: 'user-456',
            title: 'My Important Secret',
            recipient_name: 'Jane Smith',
            recipient_email: 'jane@example.com',
            recipient_phone: null,
            contact_method: 'email',
            check_in_days: 30,
            status: 'active',
            server_share: 'encrypted-server-share-data-abc123',
            iv: 'initialization-vector',
            auth_tag: 'auth-tag-data',
            sss_shares_total: 3,
            sss_threshold: 2,
            is_triggered: false,
            last_check_in: new Date().toISOString(),
            next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            triggered_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: new Date().toISOString(),
          },
        }),
      })

      render(<SecretCard secret={secret} />)

      const checkInButton = screen.getByRole('button', { name: /check in/i })
      await userEvent.click(checkInButton)

      await waitFor(() => {
        // Title should remain unchanged
        expect(screen.getByText('My Important Secret')).toBeInTheDocument()
        // Recipient should remain unchanged
        expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument()
        // Should not be disabled
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      })
    })
  })

  describe('Pause Action', () => {
    it('should preserve serverShare field after pausing', async () => {
      const secret = createMockSecret({ status: 'active' })

      // Mock successful pause API response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          secret: {
            id: 'test-secret-123',
            user_id: 'user-456',
            title: 'My Important Secret',
            recipient_name: 'Jane Smith',
            recipient_email: 'jane@example.com',
            recipient_phone: null,
            contact_method: 'email',
            check_in_days: 30,
            status: 'paused', // Status changed to paused
            server_share: 'encrypted-server-share-data-abc123', // Server share preserved!
            iv: 'initialization-vector',
            auth_tag: 'auth-tag-data',
            sss_shares_total: 3,
            sss_threshold: 2,
            is_triggered: false,
            last_check_in: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            next_check_in: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            triggered_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: new Date().toISOString(),
          },
        }),
      })

      render(<SecretCard secret={secret} />)

      // Click pause button
      const pauseButton = screen.getByRole('button', { name: /pause/i })
      await userEvent.click(pauseButton)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/secrets/test-secret-123/toggle-pause'),
          expect.objectContaining({ method: 'POST' })
        )
      })

      // Should show "Paused" status, NOT "Disabled"
      await waitFor(() => {
        expect(screen.getByText('Paused')).toBeInTheDocument()
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
        expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
      })
    })

    it('should preserve serverShare field after resuming', async () => {
      const secret = createMockSecret({ status: 'paused' })

      // Mock successful resume API response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          secret: {
            id: 'test-secret-123',
            user_id: 'user-456',
            title: 'My Important Secret',
            recipient_name: 'Jane Smith',
            recipient_email: 'jane@example.com',
            recipient_phone: null,
            contact_method: 'email',
            check_in_days: 30,
            status: 'active', // Status changed back to active
            server_share: 'encrypted-server-share-data-abc123', // Server share preserved!
            iv: 'initialization-vector',
            auth_tag: 'auth-tag-data',
            sss_shares_total: 3,
            sss_threshold: 2,
            is_triggered: false,
            last_check_in: new Date().toISOString(), // Resume applies check-in
            next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            triggered_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: new Date().toISOString(),
          },
        }),
      })

      render(<SecretCard secret={secret} />)

      // Click resume button
      const resumeButton = screen.getByRole('button', { name: /resume/i })
      await userEvent.click(resumeButton)

      await waitFor(() => {
        // Should show active state, NOT disabled
        expect(screen.queryByText('Paused')).not.toBeInTheDocument()
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
        expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
      })
    })
  })

  describe('Disabled State Validation', () => {
    it('should correctly show disabled state when serverShare is actually null', () => {
      const secretWithoutServerShare = createMockSecret({ serverShare: null })

      render(<SecretCard secret={secretWithoutServerShare} />)

      // Should show disabled state
      expect(screen.getByText('Disabled')).toBeInTheDocument()
      expect(screen.getByText('Server share deleted')).toBeInTheDocument()
    })

    it('should NOT show disabled state when serverShare exists', () => {
      const secretWithServerShare = createMockSecret({
        serverShare: 'valid-encrypted-data',
      })

      render(<SecretCard secret={secretWithServerShare} />)

      // Should NOT show disabled state
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      expect(screen.queryByText('Server share deleted')).not.toBeInTheDocument()
    })

    it('should correctly identify triggered secrets', () => {
      const triggeredSecret = createMockSecret({
        isTriggered: true,
        triggeredAt: new Date(),
        status: 'triggered',
      })

      render(<SecretCard secret={triggeredSecret} />)

      // Should show "Sent" status for triggered secrets
      expect(screen.getByText('Sent')).toBeInTheDocument()
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
    })
  })

  describe('API Error Handling', () => {
    it('should handle check-in API errors gracefully', async () => {
      const secret = createMockSecret()

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Database error' }),
      })

      render(<SecretCard secret={secret} />)

      const checkInButton = screen.getByRole('button', { name: /check in/i })
      await userEvent.click(checkInButton)

      // Should not crash and should maintain original state
      await waitFor(() => {
        expect(screen.getByText('My Important Secret')).toBeInTheDocument()
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      })
    })

    it('should handle pause API errors gracefully', async () => {
      const secret = createMockSecret()

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Secret not found' }),
      })

      render(<SecretCard secret={secret} />)

      const pauseButton = screen.getByRole('button', { name: /pause/i })
      await userEvent.click(pauseButton)

      // Should not crash and should maintain original state
      await waitFor(() => {
        expect(screen.getByText('My Important Secret')).toBeInTheDocument()
        expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
      })
    })
  })
})
