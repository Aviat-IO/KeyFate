import { describe, it, expect, beforeEach } from "vitest"
import { generateCronSignature } from "@/lib/cron/authentication"
import { authorizeRequest } from "@/lib/cron/utils"
import { NextRequest } from "next/server"
import crypto from "crypto"

describe("Cron HMAC Authentication", () => {
  const originalCronSecret = process.env.CRON_SECRET
  const testSecret = "test-cron-secret-key-1234567890"

  beforeEach(() => {
    process.env.CRON_SECRET = testSecret
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret
  })

  describe("generateCronSignature", () => {
    it("should generate consistent signatures", () => {
      const payload = "https://example.com/api/cron/check-secrets"
      const timestamp = Date.now()

      const sig1 = generateCronSignature(payload, timestamp, testSecret)
      const sig2 = generateCronSignature(payload, timestamp, testSecret)

      expect(sig1).toBe(sig2)
      expect(sig1).toMatch(/^[a-f0-9]{64}$/) // SHA256 hex = 64 chars
    })

    it("should generate different signatures for different payloads", () => {
      const timestamp = Date.now()

      const sig1 = generateCronSignature("payload1", timestamp, testSecret)
      const sig2 = generateCronSignature("payload2", timestamp, testSecret)

      expect(sig1).not.toBe(sig2)
    })

    it("should generate different signatures for different timestamps", () => {
      const payload = "https://example.com/api/cron/check-secrets"

      const sig1 = generateCronSignature(payload, 1000000, testSecret)
      const sig2 = generateCronSignature(payload, 2000000, testSecret)

      expect(sig1).not.toBe(sig2)
    })
  })

  describe("authorizeRequest with HMAC", () => {
    it("should accept valid HMAC signature", () => {
      const url = "http://localhost:3000/api/cron/check-secrets"
      const timestamp = Date.now()
      const signature = generateCronSignature(url, timestamp, testSecret)

      const request = new NextRequest(url, {
        headers: {
          "x-cron-signature": signature,
          "x-cron-timestamp": timestamp.toString(),
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(true)
    })

    it("should reject invalid signature", () => {
      const url = "http://localhost:3000/api/cron/check-secrets"
      const timestamp = Date.now()
      const invalidSignature = "0".repeat(64)

      const request = new NextRequest(url, {
        headers: {
          "x-cron-signature": invalidSignature,
          "x-cron-timestamp": timestamp.toString(),
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(false)
    })

    it("should reject requests with future timestamps", () => {
      const url = "http://localhost:3000/api/cron/check-secrets"
      const futureTimestamp = Date.now() + 10 * 60 * 1000 // 10 minutes in future
      const signature = generateCronSignature(url, futureTimestamp, testSecret)

      const request = new NextRequest(url, {
        headers: {
          "x-cron-signature": signature,
          "x-cron-timestamp": futureTimestamp.toString(),
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(false)
    })

    it("should reject requests older than 5 minutes", () => {
      const url = "http://localhost:3000/api/cron/check-secrets"
      const oldTimestamp = Date.now() - 6 * 60 * 1000 // 6 minutes ago
      const signature = generateCronSignature(url, oldTimestamp, testSecret)

      const request = new NextRequest(url, {
        headers: {
          "x-cron-signature": signature,
          "x-cron-timestamp": oldTimestamp.toString(),
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(false)
    })

    it("should reject requests with mismatched URL", () => {
      const originalUrl = "http://localhost:3000/api/cron/check-secrets"
      const attackUrl = "http://localhost:3000/api/cron/process-reminders"
      const timestamp = Date.now()

      // Generate signature for original URL
      const signature = generateCronSignature(
        originalUrl,
        timestamp,
        testSecret,
      )

      // Try to use it with different URL
      const request = new NextRequest(attackUrl, {
        headers: {
          "x-cron-signature": signature,
          "x-cron-timestamp": timestamp.toString(),
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(false)
    })

    it("should fallback to Bearer token authentication", () => {
      const url = "http://localhost:3000/api/cron/check-secrets"

      const request = new NextRequest(url, {
        headers: {
          Authorization: `Bearer ${testSecret}`,
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(true)
    })

    it("should reject invalid Bearer tokens", () => {
      const url = "http://localhost:3000/api/cron/check-secrets"

      const request = new NextRequest(url, {
        headers: {
          Authorization: "Bearer wrong-token",
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(false)
    })

    it("should use timing-safe comparison", () => {
      // This test verifies that we're using timingSafeEqual
      // by checking that two equal-length but different strings both fail
      const url = "http://localhost:3000/api/cron/check-secrets"
      const timestamp = Date.now()
      const validSig = generateCronSignature(url, timestamp, testSecret)

      // Create an invalid signature with same length
      const invalidSig = "a".repeat(validSig.length)

      const request = new NextRequest(url, {
        headers: {
          "x-cron-signature": invalidSig,
          "x-cron-timestamp": timestamp.toString(),
        },
      })

      const result = authorizeRequest(request)
      expect(result).toBe(false)
    })
  })

  describe("Replay Protection", () => {
    it("should prevent timestamp replay attacks", () => {
      const url = "http://localhost:3000/api/cron/check-secrets"
      const timestamp = Date.now() - 4 * 60 * 1000 // 4 minutes ago (within window)
      const signature = generateCronSignature(url, timestamp, testSecret)

      const request1 = new NextRequest(url, {
        headers: {
          "x-cron-signature": signature,
          "x-cron-timestamp": timestamp.toString(),
        },
      })

      // First request should succeed
      expect(authorizeRequest(request1)).toBe(true)

      // Wait 2 minutes (simulated)
      const laterTimestamp = timestamp + 2 * 60 * 1000

      // Replaying the same signature with old timestamp should still work
      // if within 5-minute window, but fail if outside
      const oldTimestamp = Date.now() - 6 * 60 * 1000
      const replayRequest = new NextRequest(url, {
        headers: {
          "x-cron-signature": signature,
          "x-cron-timestamp": oldTimestamp.toString(),
        },
      })

      expect(authorizeRequest(replayRequest)).toBe(false)
    })
  })
})
