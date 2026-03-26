/**
 * Tests for pricing utility
 *
 * Ported from frontend/__tests__/lib/pricing.test.ts
 * The pricing module uses process.env.NEXT_PUBLIC_SITE_URL to detect production.
 * In test environment, isProduction() returns false, so we get TEST_PRICES.
 */

import { describe, it, expect } from "vitest"
import { getPricing, getAmount, isTestPricing } from "$lib/pricing"

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

    it("should have yearly and monthly at reasonable levels", () => {
      const pricing = getPricing()
      // In production: yearly should be less than 12x monthly (discount)
      // In test: monthly and yearly optimized for different payment methods
      const isProductionDiscount = pricing.yearly < pricing.monthly * 12
      const isTestPrices = pricing.monthly === 0.1 && pricing.yearly === 9

      expect(isProductionDiscount || isTestPrices).toBe(true)
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

      // Test pricing is $0.10 or $9, production is $9 or $90
      if (pricing.monthly === 0.1) {
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

    it("should have test pricing at reasonable levels", () => {
      // Ensure test prices meet BTCPay minimums
      const pricing = getPricing()

      // Either we're in test mode ($0.10/$9) or production mode ($9/$90)
      const isReasonableTest = pricing.monthly === 0.1 && pricing.yearly === 9
      const isProduction = pricing.monthly === 9 && pricing.yearly === 90

      expect(isReasonableTest || isProduction).toBe(true)
    })
  })
})
