import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-config", () => ({
  authConfig: {},
}))

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/csrf", () => ({
  requireCSRFProtection: vi.fn(() => ({ valid: true })),
  createCSRFErrorResponse: vi.fn(),
}))

vi.mock("@/lib/payment", () => ({
  getCryptoPaymentProvider: vi.fn(() => ({
    createCustomer: vi.fn(() => Promise.resolve("cust_123")),
    createCheckoutSession: vi.fn(() =>
      Promise.resolve({
        id: "session_123",
        url: "https://btcpay.keyfate.com/checkout/session_123",
      }),
    ),
    convertToProviderCurrency: vi.fn((amount: number) =>
      Promise.resolve(amount / 100000),
    ),
  })),
}))

describe("BTCPay Checkout Pricing", () => {
  const mockSession = {
    user: {
      id: "user123",
      email: "test@example.com",
      emailVerified: new Date(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const { getServerSession } = require("next-auth/next")
    getServerSession.mockResolvedValue(mockSession)
  })

  describe("Environment-Based Pricing", () => {
    it("should use test pricing for staging environment", async () => {
      const originalEnv = process.env.NEXT_PUBLIC_SITE_URL
      process.env.NEXT_PUBLIC_SITE_URL = "https://staging.keyfate.com"

      const { POST } = await import("@/app/api/create-btcpay-checkout/route")

      const request = new NextRequest(
        "https://staging.keyfate.com/api/create-btcpay-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: 90, // Original amount passed from frontend
            currency: "USD",
            mode: "subscription",
            interval: "year",
          }),
        },
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty("url")

      // Verify that the payment provider was called with test pricing ($5)
      const { getCryptoPaymentProvider } = require("@/lib/payment")
      const provider = getCryptoPaymentProvider()
      expect(provider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: expect.any(Number),
          metadata: expect.objectContaining({
            original_amount: "5", // Test pricing for yearly
          }),
        }),
      )

      process.env.NEXT_PUBLIC_SITE_URL = originalEnv
    })

    it("should use test pricing for monthly interval in staging", async () => {
      const originalEnv = process.env.NEXT_PUBLIC_SITE_URL
      process.env.NEXT_PUBLIC_SITE_URL = "https://staging.keyfate.com"

      const { POST } = await import("@/app/api/create-btcpay-checkout/route")

      const request = new NextRequest(
        "https://staging.keyfate.com/api/create-btcpay-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: 9, // Original amount
            currency: "USD",
            mode: "subscription",
            interval: "month",
          }),
        },
      )

      const response = await POST(request)
      expect(response.status).toBe(200)

      const { getCryptoPaymentProvider } = require("@/lib/payment")
      const provider = getCryptoPaymentProvider()
      expect(provider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            original_amount: "2", // Test pricing for monthly
          }),
        }),
      )

      process.env.NEXT_PUBLIC_SITE_URL = originalEnv
    })

    it("should use production pricing for production environment", async () => {
      const originalEnv = process.env.NEXT_PUBLIC_SITE_URL
      process.env.NEXT_PUBLIC_SITE_URL = "https://keyfate.com"

      const { POST } = await import("@/app/api/create-btcpay-checkout/route")

      const request = new NextRequest(
        "https://keyfate.com/api/create-btcpay-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: 90,
            currency: "USD",
            mode: "subscription",
            interval: "year",
          }),
        },
      )

      const response = await POST(request)
      expect(response.status).toBe(200)

      const { getCryptoPaymentProvider } = require("@/lib/payment")
      const provider = getCryptoPaymentProvider()
      expect(provider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            original_amount: "90", // Production pricing
          }),
        }),
      )

      process.env.NEXT_PUBLIC_SITE_URL = originalEnv
    })
  })

  describe("GET Request with redirect_after_auth", () => {
    it("should redirect to BTCPay URL after authentication", async () => {
      const { GET } = await import("@/app/api/create-btcpay-checkout/route")

      const url = new URL(
        "https://staging.keyfate.com/api/create-btcpay-checkout?amount=90&currency=USD&mode=subscription&interval=year&redirect_after_auth=true",
      )
      const request = new NextRequest(url, { method: "GET" })

      const response = await GET(request)

      // Should redirect, not return JSON
      expect(response.status).toBe(307) // Redirect status
      expect(response.headers.get("location")).toContain("btcpay")
    })

    it("should redirect to pricing page if amount is missing", async () => {
      const { GET } = await import("@/app/api/create-btcpay-checkout/route")

      const url = new URL(
        "https://staging.keyfate.com/api/create-btcpay-checkout?redirect_after_auth=true",
      )
      const request = new NextRequest(url, { method: "GET" })

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("/pricing")
    })

    it("should redirect to pricing page if redirect_after_auth is missing", async () => {
      const { GET } = await import("@/app/api/create-btcpay-checkout/route")

      const url = new URL(
        "https://staging.keyfate.com/api/create-btcpay-checkout?amount=90&currency=USD",
      )
      const request = new NextRequest(url, { method: "GET" })

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toContain("/pricing")
    })
  })

  describe("BTC Conversion with Test Pricing", () => {
    it("should convert test pricing to lower BTC amounts", async () => {
      const originalEnv = process.env.NEXT_PUBLIC_SITE_URL
      process.env.NEXT_PUBLIC_SITE_URL = "https://staging.keyfate.com"

      const { POST } = await import("@/app/api/create-btcpay-checkout/route")

      const request = new NextRequest(
        "https://staging.keyfate.com/api/create-btcpay-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: 90,
            currency: "USD",
            mode: "subscription",
            interval: "year",
          }),
        },
      )

      await POST(request)

      const { getCryptoPaymentProvider } = require("@/lib/payment")
      const provider = getCryptoPaymentProvider()

      // Verify conversion was called with test amount ($5) instead of $90
      expect(provider.convertToProviderCurrency).toHaveBeenCalledWith(
        5, // Test pricing
        "USD",
      )

      process.env.NEXT_PUBLIC_SITE_URL = originalEnv
    })
  })

  describe("Authorization", () => {
    it("should return 401 if user is not authenticated", async () => {
      const { getServerSession } = require("next-auth/next")
      getServerSession.mockResolvedValueOnce(null)

      const { POST } = await import("@/app/api/create-btcpay-checkout/route")

      const request = new NextRequest(
        "https://staging.keyfate.com/api/create-btcpay-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: 90,
            currency: "USD",
            mode: "subscription",
            interval: "year",
          }),
        },
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("Unauthorized")
    })
  })

  describe("Metadata Tracking", () => {
    it("should include user_id and billing_interval in metadata", async () => {
      const { POST } = await import("@/app/api/create-btcpay-checkout/route")

      const request = new NextRequest(
        "https://staging.keyfate.com/api/create-btcpay-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: 90,
            currency: "USD",
            mode: "subscription",
            interval: "year",
          }),
        },
      )

      await POST(request)

      const { getCryptoPaymentProvider } = require("@/lib/payment")
      const provider = getCryptoPaymentProvider()

      expect(provider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            user_id: "user123",
            billing_interval: "year",
            original_currency: "USD",
          }),
        }),
      )
    })
  })
})
