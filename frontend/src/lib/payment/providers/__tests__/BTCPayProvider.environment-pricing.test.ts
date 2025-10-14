import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { BTCPayProvider } from "../BTCPayProvider"

describe("BTCPayProvider - Environment-Based Pricing", () => {
  let provider: BTCPayProvider
  const originalEnv = process.env.NEXT_PUBLIC_ENV

  beforeEach(() => {
    provider = new BTCPayProvider({
      serverUrl: "https://test.btcpay.com",
      apiKey: "test-key",
      storeId: "test-store",
    })
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENV = originalEnv
  })

  describe("Dev environment", () => {
    it("should return test pricing when NEXT_PUBLIC_ENV is 'local'", async () => {
      process.env.NEXT_PUBLIC_ENV = "local"

      const prices = await provider.listPrices()

      expect(prices).toHaveLength(2)
      expect(prices[0].unitAmount).toBe(0.0000001)
      expect(prices[1].unitAmount).toBe(0.000001)
    })

    it("should return test pricing when NEXT_PUBLIC_ENV is 'development'", async () => {
      process.env.NEXT_PUBLIC_ENV = "development"

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0000001)
      expect(prices[1].unitAmount).toBe(0.000001)
    })

    it("should return test pricing when NEXT_PUBLIC_ENV is 'dev'", async () => {
      process.env.NEXT_PUBLIC_ENV = "dev"

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0000001)
      expect(prices[1].unitAmount).toBe(0.000001)
    })
  })

  describe("Staging environment", () => {
    it("should return test pricing when NEXT_PUBLIC_ENV is 'staging'", async () => {
      process.env.NEXT_PUBLIC_ENV = "staging"

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0000001)
      expect(prices[1].unitAmount).toBe(0.000001)
    })

    it("should return test pricing when NEXT_PUBLIC_ENV is 'stage'", async () => {
      process.env.NEXT_PUBLIC_ENV = "stage"

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0000001)
      expect(prices[1].unitAmount).toBe(0.000001)
    })
  })

  describe("Production environment", () => {
    it("should return production pricing when NEXT_PUBLIC_ENV is 'production'", async () => {
      process.env.NEXT_PUBLIC_ENV = "production"

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0002)
      expect(prices[1].unitAmount).toBe(0.002)
    })

    it("should return production pricing when NEXT_PUBLIC_ENV is 'prod'", async () => {
      process.env.NEXT_PUBLIC_ENV = "prod"

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0002)
      expect(prices[1].unitAmount).toBe(0.002)
    })

    it("should return production pricing when NEXT_PUBLIC_ENV is undefined", async () => {
      delete process.env.NEXT_PUBLIC_ENV

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0002)
      expect(prices[1].unitAmount).toBe(0.002)
    })

    it("should return production pricing when NEXT_PUBLIC_ENV is empty string", async () => {
      process.env.NEXT_PUBLIC_ENV = ""

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0002)
      expect(prices[1].unitAmount).toBe(0.002)
    })

    it("should return production pricing when NEXT_PUBLIC_ENV is unrecognized value", async () => {
      process.env.NEXT_PUBLIC_ENV = "unknown"

      const prices = await provider.listPrices()

      expect(prices[0].unitAmount).toBe(0.0002)
      expect(prices[1].unitAmount).toBe(0.002)
    })
  })

  describe("Test pricing values", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENV = "local"
    })

    it("should have monthly test pricing of 10 sats (0.0000001 BTC)", async () => {
      const prices = await provider.listPrices()
      const monthlyPrice = prices.find((p) => p.interval === "month")

      expect(monthlyPrice).toBeDefined()
      expect(monthlyPrice!.unitAmount).toBe(0.0000001)
    })

    it("should have yearly test pricing of 100 sats (0.000001 BTC)", async () => {
      const prices = await provider.listPrices()
      const yearlyPrice = prices.find((p) => p.interval === "year")

      expect(yearlyPrice).toBeDefined()
      expect(yearlyPrice!.unitAmount).toBe(0.000001)
    })

    it("should maintain 10x ratio between monthly and yearly pricing", async () => {
      const prices = await provider.listPrices()
      const monthlyPrice = prices.find((p) => p.interval === "month")!
      const yearlyPrice = prices.find((p) => p.interval === "year")!

      expect(yearlyPrice.unitAmount).toBe(monthlyPrice.unitAmount * 10)
    })
  })

  describe("Production pricing values", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENV = "production"
    })

    it("should maintain production monthly pricing at 0.0002 BTC", async () => {
      const prices = await provider.listPrices()
      const monthlyPrice = prices.find((p) => p.interval === "month")

      expect(monthlyPrice).toBeDefined()
      expect(monthlyPrice!.unitAmount).toBe(0.0002)
    })

    it("should maintain production yearly pricing at 0.002 BTC", async () => {
      const prices = await provider.listPrices()
      const yearlyPrice = prices.find((p) => p.interval === "year")

      expect(yearlyPrice).toBeDefined()
      expect(yearlyPrice!.unitAmount).toBe(0.002)
    })

    it("should maintain 10x ratio in production pricing", async () => {
      const prices = await provider.listPrices()
      const monthlyPrice = prices.find((p) => p.interval === "month")!
      const yearlyPrice = prices.find((p) => p.interval === "year")!

      expect(yearlyPrice.unitAmount).toBe(monthlyPrice.unitAmount * 10)
    })
  })
})
