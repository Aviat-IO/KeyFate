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

      // Test pricing is $0.50 or $1, production is $9 or $90
      if (pricing.monthly === 0.5) {
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

    it("should have test pricing significantly cheaper than production minimums", () => {
      // Ensure test prices would be < $2 for reasonable testing
      const pricing = getPricing()

      // Either we're in test mode (< $2) or production mode (> $5)
      const isCheapTest = pricing.monthly < 2 && pricing.yearly < 2
      const isExpensiveProd = pricing.monthly > 5 && pricing.yearly > 5

      expect(isCheapTest || isExpensiveProd).toBe(true)
    })
  })
})
