/**
 * Test Suite: Secret Card Unpause Check-in Display
 *
 * Verifies that when a secret is unpaused, the UI correctly updates to show
 * the new check-in time, matching the behavior of the Check-in button.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SecretCard } from '@/components/secret-card'
import type { Secret } from '@/types'
import type { ApiSecret } from '@/lib/db/secret-mapper'

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
  status: 'paused',
  serverShare: 'encrypted-server-share-data',
  iv: 'test-iv',
  authTag: 'test-auth-tag',
  sssSharesTotal: 3,
  sssThreshold: 2,
  isTriggered: false,
  lastCheckIn: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) as any, // 40 days ago (old check-in)
  nextCheckIn: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) as any, // 10 days ago (expired)
  triggeredAt: null,
  createdAt: new Date() as any,
  updatedAt: new Date() as any,
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
  server_share: 'encrypted-server-share-data',
  iv: 'test-iv',
  auth_tag: 'test-auth-tag',
  sss_shares_total: 3,
  sss_threshold: 2,
  is_triggered: false,
  last_check_in: new Date().toISOString(), // NEW check-in time (now)
  next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  triggered_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('SecretCard - Unpause Check-in Display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('should update last check-in time display after unpausing', async () => {
    const user = userEvent.setup()
    const secret = createTestSecret()

    // Mock successful unpause API response with updated check-in times
    const apiResponse = createApiResponse()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, secret: apiResponse }),
    })

    render(<SecretCard secret={secret} />)

    // Verify initial state shows old check-in time (appears in both mobile and desktop layouts)
    const initialCheckinElements = screen.getAllByText(/Last checkin:/i)
    expect(initialCheckinElements.some(el =>
      el.textContent?.includes('month ago')
    )).toBe(true)

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

    // CRITICAL: Should update to show new check-in time ("just now" or "a few seconds ago")
    await waitFor(() => {
      const lastCheckinText = screen.getAllByText(/Last checkin:/i)
      expect(lastCheckinText.length).toBeGreaterThan(0)
      // Should NOT still show "40 days ago"
      expect(lastCheckinText.some(el => el.textContent?.includes('40 days ago'))).toBe(false)
      // Should show recent time like "just now" or "a few seconds ago"
      expect(lastCheckinText.some(el =>
        el.textContent?.match(/(just now|a few seconds ago|seconds ago)/i)
      )).toBe(true)
    })
  })

  it('should update next check-in time display after unpausing', async () => {
    const user = userEvent.setup()
    const secret = createTestSecret()

    // Mock successful unpause API response with updated check-in times
    const apiResponse = createApiResponse()

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

    // Should update to show new next check-in time (29-30 days from now, depending on timing)
    await waitFor(() => {
      const triggerElements = screen.getAllByText(/Triggers in/i)
      expect(triggerElements.some(el =>
        el.textContent?.match(/Triggers in (29|30) days/)
      )).toBe(true)
    })
  })

  it('should match Check-in button behavior for time display updates', async () => {
    const user = userEvent.setup()

    // Test 1: Check-in button updates display
    const checkInSecret = createTestSecret({
      status: 'active',
      lastCheckIn: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
    })

    const checkInApiResponse = createApiResponse({
      status: 'active',
      last_check_in: new Date().toISOString(),
    })

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, secret: checkInApiResponse }),
    })

    const { unmount } = render(<SecretCard secret={checkInSecret} />)

    const checkInButton = screen.getByRole('button', { name: /check in/i })
    await user.click(checkInButton)

    await waitFor(() => {
      expect(screen.getAllByText(/Last checkin:.*(just now|a few seconds ago|seconds ago)/i).length).toBeGreaterThan(0)
    })

    unmount()

    // Test 2: Unpause button should behave identically
    const unpauseSecret = createTestSecret({
      status: 'paused',
      lastCheckIn: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
    })

    const unpauseApiResponse = createApiResponse({
      status: 'active',
      last_check_in: new Date().toISOString(),
    })

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, secret: unpauseApiResponse }),
    })

    render(<SecretCard secret={unpauseSecret} />)

    const resumeButton = screen.getByRole('button', { name: /resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(screen.getAllByText(/Last checkin:.*(just now|a few seconds ago|seconds ago)/i).length).toBeGreaterThan(0)
    })
  })

  it('should show last check-in text even when secret is paused', () => {
    const secret = createTestSecret({
      status: 'paused',
      lastCheckIn: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    })

    render(<SecretCard secret={secret} />)

    // Paused secrets DO show last check-in time (appears in both mobile and desktop)
    const lastCheckinElements = screen.getAllByText(/Last checkin:/i)
    expect(lastCheckinElements.length).toBeGreaterThan(0)
    expect(lastCheckinElements.some(el => el.textContent?.includes('month ago'))).toBe(true)
  })

  it('should update last check-in text after unpause completes', async () => {
    const user = userEvent.setup()
    const secret = createTestSecret({
      status: 'paused',
      lastCheckIn: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    })

    const apiResponse = createApiResponse()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, secret: apiResponse }),
    })

    render(<SecretCard secret={secret} />)

    // Verify old check-in time while paused
    const oldCheckinElements = screen.getAllByText(/Last checkin:/i)
    expect(oldCheckinElements.some(el => el.textContent?.includes('month ago'))).toBe(true)

    // Click resume
    const resumeButton = screen.getByRole('button', { name: /resume/i })
    await user.click(resumeButton)

    // Should update last check-in time after resume
    await waitFor(() => {
      const updatedCheckinElements = screen.getAllByText(/Last checkin:/i)
      expect(updatedCheckinElements.some(el =>
        el.textContent?.match(/(just now|a few seconds ago|seconds ago)/i)
      )).toBe(true)
    })
  })
})
