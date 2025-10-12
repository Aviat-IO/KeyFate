import type { Secret } from "@/types"

export function createMockSecret(overrides?: Partial<Secret>): Secret {
  const baseSecret: Secret = {
    id: "test-secret-123",
    title: "Test Secret",
    recipientName: "John Doe",
    recipientEmail: "john@example.com",
    recipientPhone: "+1234567890",
    recipients: [
      {
        id: "recipient-1",
        secretId: "test-secret-123",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    status: "active",
    nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    lastCheckIn: new Date(Date.now() - 24 * 60 * 60 * 1000),
    triggeredAt: null,
    serverShare: "encrypted-share-data",
    userId: "user-123",
    createdAt: new Date(),
    updatedAt: new Date(),
    checkInDays: 7,
    contactMethod: "email",
    authTag: "auth-tag-data",
    iv: "iv-data",
    sssSharesTotal: 3,
    sssThreshold: 2,
  }
  return { ...baseSecret, ...overrides }
}

export function createMockApiSecret(
  overrides?: Record<string, any>,
): Record<string, any> {
  return {
    id: "test-secret-123",
    title: "Test Secret",
    recipient_name: "John Doe",
    recipient_email: "john@example.com",
    recipient_phone: "+1234567890",
    recipients: [
      {
        id: "recipient-1",
        secret_id: "test-secret-123",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    status: "active",
    next_check_in: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    last_check_in: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    triggered_at: null,
    server_share: "encrypted-share-data",
    user_id: "user-123",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    check_in_days: 7,
    contact_method: "email",
    auth_tag: "auth-tag-data",
    iv: "iv-data",
    sss_shares_total: 3,
    sss_threshold: 2,
    ...overrides,
  }
}
