/**
 * Test Suite: Secret Mapper - API Format Conversion
 *
 * Validates that mapApiSecretToDrizzleShape correctly converts
 * snake_case API responses to camelCase Drizzle format
 *
 * This is the core fix for the check-in/pause state bug
 */

import { describe, it, expect } from 'vitest'
import { mapApiSecretToDrizzleShape, type ApiSecret } from '../secret-mapper'

describe('Secret Mapper - API Format Conversion', () => {
  const createApiSecret = (): ApiSecret => ({
    id: 'test-id-123',
    user_id: 'user-456',
    title: 'Test Secret',
    recipients: [{
      id: 'recipient-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    }],
    check_in_days: 30,
    status: 'active',
    server_share: 'encrypted-server-share-data',
    iv: 'initialization-vector',
    auth_tag: 'auth-tag-value',
    sss_shares_total: 3,
    sss_threshold: 2,
    is_triggered: false,
    last_check_in: '2024-01-01T10:00:00.000Z',
    next_check_in: '2024-02-01T10:00:00.000Z',
    triggered_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
  })

  describe('Field Name Conversion', () => {
    it('should convert server_share to serverShare', () => {
      const apiSecret = createApiSecret()
      const drizzleSecret = mapApiSecretToDrizzleShape(apiSecret)

      // Critical field for the bug fix
      expect(drizzleSecret.serverShare).toBe('encrypted-server-share-data')
      expect(drizzleSecret).toHaveProperty('serverShare')
      expect(drizzleSecret).not.toHaveProperty('server_share')
    })

    it('should convert user_id to userId', () => {
      const apiSecret = createApiSecret()
      const drizzleSecret = mapApiSecretToDrizzleShape(apiSecret)

      expect(drizzleSecret.userId).toBe('user-456')
      expect(drizzleSecret).toHaveProperty('userId')
      expect(drizzleSecret).not.toHaveProperty('user_id')
    })

    it('should convert recipients array', () => {
      const apiSecret = createApiSecret()
      const drizzleSecret = mapApiSecretToDrizzleShape(apiSecret)

      expect(drizzleSecret.recipients).toHaveLength(1)
      expect(drizzleSecret.recipients[0].name).toBe('John Doe')
      expect(drizzleSecret).toHaveProperty('recipients')
    })

    it('should convert check_in_days to checkInDays', () => {
      const apiSecret = createApiSecret()
      const drizzleSecret = mapApiSecretToDrizzleShape(apiSecret)

      expect(drizzleSecret.checkInDays).toBe(30)
      expect(drizzleSecret).toHaveProperty('checkInDays')
      expect(drizzleSecret).not.toHaveProperty('check_in_days')
    })

    it('should convert last_check_in to lastCheckIn', () => {
      const apiSecret = createApiSecret()
      const drizzleSecret = mapApiSecretToDrizzleShape(apiSecret)

      expect(drizzleSecret.lastCheckIn).toBeInstanceOf(Date)
      expect(drizzleSecret.lastCheckIn?.toISOString()).toBe('2024-01-01T10:00:00.000Z')
      expect(drizzleSecret).toHaveProperty('lastCheckIn')
      expect(drizzleSecret).not.toHaveProperty('last_check_in')
    })

    it('should convert next_check_in to nextCheckIn', () => {
      const apiSecret = createApiSecret()
      const drizzleSecret = mapApiSecretToDrizzleShape(apiSecret)

      expect(drizzleSecret.nextCheckIn).toBeInstanceOf(Date)
      expect(drizzleSecret.nextCheckIn?.toISOString()).toBe('2024-02-01T10:00:00.000Z')
      expect(drizzleSecret).toHaveProperty('nextCheckIn')
      expect(drizzleSecret).not.toHaveProperty('next_check_in')
    })
  })

  describe('Bug Fix Validation', () => {
    it('should preserve serverShare when converting check-in response', () => {
      // Simulate API response from check-in endpoint
      const checkInResponse = createApiSecret()
      checkInResponse.last_check_in = new Date().toISOString()

      const converted = mapApiSecretToDrizzleShape(checkInResponse)

      // BUG FIX: serverShare must be preserved after conversion
      expect(converted.serverShare).toBe('encrypted-server-share-data')
      expect(converted.serverShare).not.toBeNull()
      expect(converted.serverShare).not.toBeUndefined()
    })

    it('should preserve serverShare when converting pause response', () => {
      // Simulate API response from toggle-pause endpoint
      const pauseResponse = createApiSecret()
      pauseResponse.status = 'paused'

      const converted = mapApiSecretToDrizzleShape(pauseResponse)

      // BUG FIX: serverShare must be preserved after conversion
      expect(converted.serverShare).toBe('encrypted-server-share-data')
      expect(converted.serverShare).not.toBeNull()
    })

    it('should correctly handle null serverShare', () => {
      const apiSecret = createApiSecret()
      apiSecret.server_share = null

      const converted = mapApiSecretToDrizzleShape(apiSecret)

      // Should correctly map null value
      expect(converted.serverShare).toBeNull()
      expect(converted).toHaveProperty('serverShare')
    })

    it('should correctly handle undefined serverShare', () => {
      const apiSecret = createApiSecret()
      apiSecret.server_share = undefined as any

      const converted = mapApiSecretToDrizzleShape(apiSecret)

      // Should handle undefined gracefully
      expect(converted.serverShare).toBeUndefined()
    })
  })

  describe('Date Conversion', () => {
    it('should convert ISO strings to Date objects', () => {
      const apiSecret = createApiSecret()
      const converted = mapApiSecretToDrizzleShape(apiSecret)

      expect(converted.lastCheckIn).toBeInstanceOf(Date)
      expect(converted.nextCheckIn).toBeInstanceOf(Date)
      expect(converted.createdAt).toBeInstanceOf(Date)
      expect(converted.updatedAt).toBeInstanceOf(Date)
    })

    it('should handle null dates correctly', () => {
      const apiSecret = createApiSecret()
      apiSecret.last_check_in = null
      apiSecret.triggered_at = null

      const converted = mapApiSecretToDrizzleShape(apiSecret)

      expect(converted.lastCheckIn).toBeNull()
      expect(converted.triggeredAt).toBeNull()
    })
  })

  describe('All Fields Conversion', () => {
    it('should convert all snake_case fields to camelCase', () => {
      const apiSecret = createApiSecret()
      const converted = mapApiSecretToDrizzleShape(apiSecret)

      // Verify all expected camelCase fields exist
      expect(converted).toHaveProperty('id')
      expect(converted).toHaveProperty('userId')
      expect(converted).toHaveProperty('title')
      expect(converted).toHaveProperty('recipients')
      expect(converted).toHaveProperty('checkInDays')
      expect(converted).toHaveProperty('status')
      expect(converted).toHaveProperty('serverShare')
      expect(converted).toHaveProperty('iv')
      expect(converted).toHaveProperty('authTag')
      expect(converted).toHaveProperty('sssSharesTotal')
      expect(converted).toHaveProperty('sssThreshold')
      expect(converted).toHaveProperty('triggeredAt')
      expect(converted).toHaveProperty('lastCheckIn')
      expect(converted).toHaveProperty('nextCheckIn')
      expect(converted).toHaveProperty('createdAt')
      expect(converted).toHaveProperty('updatedAt')
    })

    it('should not have any snake_case fields in output', () => {
      const apiSecret = createApiSecret()
      const converted: any = mapApiSecretToDrizzleShape(apiSecret)

      // Verify no snake_case fields remain
      expect(converted).not.toHaveProperty('user_id')
      expect(converted).not.toHaveProperty('check_in_days')
      expect(converted).not.toHaveProperty('server_share')
      expect(converted).not.toHaveProperty('auth_tag')
      expect(converted).not.toHaveProperty('sss_shares_total')
      expect(converted).not.toHaveProperty('sss_threshold')
      expect(converted).not.toHaveProperty('last_check_in')
      expect(converted).not.toHaveProperty('next_check_in')
      expect(converted).not.toHaveProperty('triggered_at')
      expect(converted).not.toHaveProperty('created_at')
      expect(converted).not.toHaveProperty('updated_at')
    })
  })

  describe('Value Preservation', () => {
    it('should preserve all field values during conversion', () => {
      const apiSecret = createApiSecret()
      const converted = mapApiSecretToDrizzleShape(apiSecret)

      // Verify values are preserved
      expect(converted.id).toBe(apiSecret.id)
      expect(converted.userId).toBe(apiSecret.user_id)
      expect(converted.title).toBe(apiSecret.title)
      expect(converted.recipients).toHaveLength(1)
      expect(converted.recipients[0].name).toBe('John Doe')
      expect(converted.checkInDays).toBe(apiSecret.check_in_days)
      expect(converted.status).toBe(apiSecret.status)
      expect(converted.serverShare).toBe(apiSecret.server_share)
      expect(converted.iv).toBe(apiSecret.iv)
      expect(converted.authTag).toBe(apiSecret.auth_tag)
      expect(converted.sssSharesTotal).toBe(apiSecret.sss_shares_total)
      expect(converted.sssThreshold).toBe(apiSecret.sss_threshold)
    })
  })
})
