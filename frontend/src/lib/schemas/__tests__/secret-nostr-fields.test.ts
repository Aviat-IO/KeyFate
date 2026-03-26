/**
 * Tests for the Nostr-related fields added to secretSchema.
 *
 * Verifies that enable_nostr_shares, enable_bitcoin_timelock,
 * and recipient_nostr_pubkeys pass through Zod validation correctly.
 */

import { describe, it, expect } from "vitest"
import { secretSchema } from "../secret"

function validBase() {
  return {
    title: "Test Secret",
    server_share: "deadbeef",
    recipients: [{ name: "Alice", email: "alice@example.com" }],
    check_in_days: 30,
    sss_shares_total: 3,
    sss_threshold: 2,
  }
}

describe("secretSchema Nostr fields", () => {
  it("should accept payload without Nostr fields (backward compatible)", () => {
    const result = secretSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it("should accept enable_nostr_shares: true", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      enable_nostr_shares: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enable_nostr_shares).toBe(true)
    }
  })

  it("should accept enable_nostr_shares: false", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      enable_nostr_shares: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enable_nostr_shares).toBe(false)
    }
  })

  it("should accept enable_bitcoin_timelock: true", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      enable_bitcoin_timelock: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enable_bitcoin_timelock).toBe(true)
    }
  })

  it("should accept recipient_nostr_pubkeys array", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      enable_nostr_shares: true,
      recipient_nostr_pubkeys: [
        { email: "alice@example.com", npub: "npub1abc123" },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recipient_nostr_pubkeys).toHaveLength(1)
      expect(result.data.recipient_nostr_pubkeys![0].npub).toBe("npub1abc123")
    }
  })

  it("should accept empty recipient_nostr_pubkeys array", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      recipient_nostr_pubkeys: [],
    })
    expect(result.success).toBe(true)
  })

  it("should reject recipient_nostr_pubkeys with empty npub", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      recipient_nostr_pubkeys: [{ email: "alice@example.com", npub: "" }],
    })
    expect(result.success).toBe(false)
  })

  it("should accept recipient_nostr_pubkeys with empty email", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      recipient_nostr_pubkeys: [{ email: "", npub: "npub1abc123" }],
    })
    expect(result.success).toBe(true)
  })

  it("should reject enable_nostr_shares with non-boolean value", () => {
    const result = secretSchema.safeParse({
      ...validBase(),
      enable_nostr_shares: "yes",
    })
    expect(result.success).toBe(false)
  })

  it("should leave Nostr fields undefined when not provided", () => {
    const result = secretSchema.safeParse(validBase())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enable_nostr_shares).toBeUndefined()
      expect(result.data.enable_bitcoin_timelock).toBeUndefined()
      expect(result.data.recipient_nostr_pubkeys).toBeUndefined()
    }
  })
})
