import { describe, it, expect, vi } from "vitest"
import { getPricing, getAmount, isTestPricing } from "@/lib/pricing"

describe("Pricing Utility", () => {
  describe("Pricing Tiers", () => {
    it("should return pricing with monthly and yearly amounts", () => {
      const pricing = getPricing()
      expect(pricing).toHaveProperty("monthly")
      expect(pricing).toHaveProperty("yearly")
      expect(typeof pricing.monthly).toBe("number")
      expect(typeof pricing.yearly).toBe("number")
    })

    it("should return positive non-zero prices", () => {
      const pricing = getPricing()
      expect(pricing.monthly).toBeGreaterThan(0)
      expect(pricing.yearly).toBeGreaterThan(0)
    })

    it("should have yearly price less than 12x monthly (discount applied)", () => {
      const pricing = getPricing()
      expect(pricing.yearly).toBeLessThan(pricing.monthly * 12)
    })
  })

  describe("getAmount", () => {
    it("should return monthly amount from pricing", () => {
      const pricing = getPricing()
      const monthly = getAmount("monthly")
      expect(monthly).toBe(pricing.monthly)
    })

    it("should return yearly amount from pricing", () => {
      const pricing = getPricing()
      const yearly = getAmount("yearly")
      expect(yearly).toBe(pricing.yearly)
    })

    it("should accept valid period parameters", () => {
      expect(() => getAmount("monthly")).not.toThrow()
      expect(() => getAmount("yearly")).not.toThrow()
    })
  })

  describe("Test Pricing Detection", () => {
    it("should return boolean for isTestPricing", () => {
      const result = isTestPricing()
      expect(typeof result).toBe("boolean")
    })

    it("should have isTestPricing inverse of production check", () => {
      // In current environment, should be consistent
      const pricing = getPricing()
      const isTest = isTestPricing()

      // Test pricing is $2 or $5, production is $9 or $90
      if (pricing.monthly === 2) {
        expect(isTest).toBe(true)
      } else if (pricing.monthly === 9) {
        expect(isTest).toBe(false)
      }
    })
  })

  describe("Bitcoin Conversion Context", () => {
    it("should provide reasonable amounts for BTC conversion", () => {
      const pricing = getPricing()

      // At ~$100,000/BTC, amounts should be reasonable
      const approxBTCPrice = 100000
      const monthlySats = (pricing.monthly / approxBTCPrice) * 100000000
      const yearlySats = (pricing.yearly / approxBTCPrice) * 100000000

      // Should be less than 100k sats
      expect(monthlySats).toBeLessThan(100000)
      expect(yearlySats).toBeLessThan(100000)

      // Should be more than 10 sats (non-trivial)
      expect(monthlySats).toBeGreaterThan(10)
      expect(yearlySats).toBeGreaterThan(10)
    })

    it("should have test pricing significantly cheaper than production", () => {
      // Ensure test prices are reasonable for testing but cheaper than production
      const pricing = getPricing()

      // Either we're in test mode ($2-$5) or production mode ($9-$90)
      const isReasonableTest = pricing.monthly >= 2 && pricing.monthly < 9
      const isProduction = pricing.monthly === 9 && pricing.yearly === 90

      expect(isReasonableTest || isProduction).toBe(true)
    })
  })
})
