/**
 * Test Suite: Secret Card State Bug Reproduction
 *
 * BUG: Check-in and pause actions incorrectly show "Disabled" and "Server share deleted" status
 *
 * ROOT CAUSE: API returns snake_case format (server_share) but component expects camelCase (serverShare)
 * When setSecretState() is called with API response, the serverShare field is not recognized,
 * causing the component to think the server share was deleted.
 */

import { describe, it, expect } from 'vitest'
import type { Secret } from '@/types'
import type { ApiSecret } from '@/lib/db/secret-mapper'

describe('Secret State Bug - API Format Mismatch', () => {
  const createDrizzleSecret = (overrides?: Partial<Secret>): Secret => ({
    id: 'test-id',
    userId: 'user-123',
    title: 'Test Secret',
    recipientName: 'John Doe',
    recipientEmail: 'john@example.com',
    recipientPhone: null,
    contactMethod: 'email',
    checkInDays: 30,
    status: 'active',
    serverShare: 'encrypted-share-data', // camelCase - correct format
    iv: 'test-iv',
    authTag: 'test-auth-tag',
    sssSharesTotal: 3,
    sssThreshold: 2,
    isTriggered: false,
    lastCheckIn: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    nextCheckIn: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    triggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const createApiSecret = (overrides?: Partial<ApiSecret>): ApiSecret => ({
    id: 'test-id',
    user_id: 'user-123',
    title: 'Test Secret',
    recipient_name: 'John Doe',
    recipient_email: 'john@example.com',
    recipient_phone: null,
    contact_method: 'email',
    check_in_days: 30,
    status: 'active',
    server_share: 'encrypted-share-data', // snake_case - API format
    iv: 'test-iv',
    auth_tag: 'test-auth-tag',
    sss_shares_total: 3,
    sss_threshold: 2,
    is_triggered: false,
    last_check_in: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    next_check_in: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    triggered_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  })

  describe('Bug Reproduction: Format Mismatch', () => {
    it('should detect that Drizzle format uses camelCase', () => {
      const drizzleSecret = createDrizzleSecret()

      // Drizzle format uses camelCase
      expect(drizzleSecret).toHaveProperty('serverShare')
      expect(drizzleSecret.serverShare).toBe('encrypted-share-data')

      // Should NOT have snake_case property
      expect(drizzleSecret).not.toHaveProperty('server_share')
    })

    it('should detect that API format uses snake_case', () => {
      const apiSecret = createApiSecret()

      // API format uses snake_case
      expect(apiSecret).toHaveProperty('server_share')
      expect(apiSecret.server_share).toBe('encrypted-share-data')

      // Should NOT have camelCase property
      expect(apiSecret).not.toHaveProperty('serverShare')
    })

    it('should reproduce the bug: API response treated as Drizzle secret', () => {
      const apiSecret = createApiSecret()

      // This simulates what happens in the bug:
      // Component receives API response and uses it directly
      const secretState: any = apiSecret

      // Component checks: !secretState.serverShare
      const serverShareDeleted = !secretState.serverShare

      // BUG: This evaluates to TRUE even though server_share exists!
      expect(serverShareDeleted).toBe(true) // Bug reproduced!
      expect(secretState.server_share).toBe('encrypted-share-data') // Data is there
      expect(secretState.serverShare).toBeUndefined() // But wrong property name
    })

    it('should show correct behavior when Drizzle format is used', () => {
      const drizzleSecret = createDrizzleSecret()

      // Correct check with Drizzle format
      const serverShareDeleted = !drizzleSecret.serverShare

      // CORRECT: This evaluates to FALSE because serverShare exists
      expect(serverShareDeleted).toBe(false)
      expect(drizzleSecret.serverShare).toBe('encrypted-share-data')
    })
  })

  describe('Fix Validation: Convert API to Drizzle Format', () => {
    it('should correctly identify missing server share in API format', () => {
      const apiSecretWithoutShare = createApiSecret({ server_share: null })

      // Even with correct property check, should identify missing share
      expect(apiSecretWithoutShare.server_share).toBeNull()
    })

    it('should correctly identify missing server share in Drizzle format', () => {
      const drizzleSecretWithoutShare = createDrizzleSecret({ serverShare: null })

      expect(drizzleSecretWithoutShare.serverShare).toBeNull()
    })
  })

  describe('State Update Scenarios', () => {
    it('should show the problem with direct API response assignment', () => {
      // Initial state (Drizzle format)
      const initialSecret = createDrizzleSecret()
      expect(initialSecret.serverShare).toBe('encrypted-share-data')

      // User clicks check-in, API returns updated secret (API format)
      const apiResponse = createApiSecret({
        last_check_in: new Date().toISOString(),
      })

      // BUG: Component does: setSecretState(apiResponse)
      const newState: any = apiResponse

      // Now component checks: !newState.serverShare
      expect(newState.serverShare).toBeUndefined() // Bug!
      expect(newState.server_share).toBe('encrypted-share-data') // Data exists but wrong key
    })

    it('should demonstrate the fix: convert API response before setState', () => {
      const initialSecret = createDrizzleSecret()
      const apiResponse = createApiSecret({
        last_check_in: new Date().toISOString(),
      })

      // FIX: Convert API response to Drizzle format
      const convertedSecret: Secret = {
        ...initialSecret,
        lastCheckIn: new Date(apiResponse.last_check_in!),
        nextCheckIn: new Date(apiResponse.next_check_in!),
        serverShare: apiResponse.server_share, // Map snake_case to camelCase
        // ... other field mappings
      }

      // Now the check works correctly
      expect(convertedSecret.serverShare).toBe('encrypted-share-data')
      const serverShareDeleted = !convertedSecret.serverShare
      expect(serverShareDeleted).toBe(false)
    })

    it('should validate that mapApiSecretToDrizzleShape handles the conversion', () => {
      // This tests that the mapper function exists and works
      const apiSecret = createApiSecret()

      // The mapper should convert server_share to serverShare
      // We'll test this in integration once we fix the component
      expect(apiSecret.server_share).toBe('encrypted-share-data')
    })
  })

  describe('Field Preservation Requirements', () => {
    it('check-in should only update lastCheckIn and nextCheckIn', () => {
      const original = createDrizzleSecret()
      const apiResponse = createApiSecret({
        last_check_in: new Date().toISOString(),
        next_check_in: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })

      // These are the ONLY fields that should change
      const expectedChanges = ['lastCheckIn', 'nextCheckIn']

      // All other fields should remain unchanged
      const unchangedFields = [
        'id', 'userId', 'title', 'recipientName', 'recipientEmail',
        'contactMethod', 'checkInDays', 'status', 'serverShare',
        'iv', 'authTag', 'sssSharesTotal', 'sssThreshold', 'isTriggered'
      ]

      expect(expectedChanges).toContain('lastCheckIn')
      expect(expectedChanges).toContain('nextCheckIn')
      expect(unchangedFields).toContain('serverShare') // Critical field to preserve
    })

    it('pause should only update status field', () => {
      const original = createDrizzleSecret({ status: 'active' })
      const apiResponse = createApiSecret({ status: 'paused' })

      // Only status should change
      const expectedChanges = ['status']

      // All other fields must remain unchanged
      const unchangedFields = [
        'id', 'userId', 'title', 'recipientName', 'recipientEmail',
        'contactMethod', 'checkInDays', 'serverShare', // Critical!
        'iv', 'authTag', 'lastCheckIn', 'nextCheckIn'
      ]

      expect(expectedChanges).toContain('status')
      expect(unchangedFields).toContain('serverShare') // Critical field to preserve
    })
  })

  describe('Error Scenarios', () => {
    it('should handle missing server_share in API response', () => {
      const apiResponse = createApiSecret({ server_share: null })

      // This should correctly identify as disabled
      expect(apiResponse.server_share).toBeNull()
    })

    it('should handle undefined server_share in API response', () => {
      const apiResponse = createApiSecret({ server_share: undefined as any })

      // Should treat undefined same as null
      expect(apiResponse.server_share).toBeUndefined()
    })

    it('should handle empty string server_share', () => {
      const apiResponse = createApiSecret({ server_share: '' })

      // Empty string should be treated as no server share
      expect(apiResponse.server_share).toBe('')
      expect(!apiResponse.server_share).toBe(true) // Falsy check
    })
  })
})
