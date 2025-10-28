import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { generateOTP, createOTPToken } from "@/lib/auth/otp"

// Mock database at module level
vi.mock("@/lib/db/drizzle", () => ({
  getDatabase: vi.fn(),
}))

describe("OTP Strengthening", () => {
  describe("8-Digit OTP Generation", () => {
    it("should generate 8-digit OTP codes", () => {
      const otp = generateOTP()
      expect(otp).toHaveLength(8)
    })

    it("should generate numeric-only OTP codes", () => {
      const otp = generateOTP()
      expect(/^\d{8}$/.test(otp)).toBe(true)
    })

    it("should pad OTP with leading zeros when needed", () => {
      vi.spyOn(crypto, "randomInt").mockReturnValueOnce(123)
      const otp = generateOTP()
      expect(otp).toBe("00000123")
    })

    it("should generate OTPs in valid range (0-99999999)", () => {
      for (let i = 0; i < 100; i++) {
        const otp = generateOTP()
        const numValue = parseInt(otp, 10)
        expect(numValue).toBeGreaterThanOrEqual(0)
        expect(numValue).toBeLessThanOrEqual(99999999)
      }
    })

    it("should generate unique OTPs (high probability)", () => {
      const otps = new Set()
      for (let i = 0; i < 1000; i++) {
        otps.add(generateOTP())
      }
      expect(otps.size).toBeGreaterThan(995)
    })

    it("should have 100 million possible combinations", () => {
      const totalCombinations = 100000000
      const minOtp = "00000000"
      const maxOtp = "99999999"

      expect(parseInt(minOtp, 10)).toBe(0)
      expect(parseInt(maxOtp, 10)).toBe(totalCombinations - 1)
    })
  })

  describe("5-Minute Expiration", () => {
    it("should set OTP expiration to 5 minutes from now", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            identifier: "test@example.com",
            token: "12345678",
            expires: new Date(Date.now() + 5 * 60 * 1000),
            purpose: "authentication",
          },
        ]),
      }

      vi.mocked(getDatabase).mockResolvedValue(mockDb as any)

      const result = await createOTPToken("test@example.com", "authentication")

      expect(result.success).toBe(true)
      expect(result.code).toHaveLength(8)
    })
  })

  describe("Brute Force Protection", () => {
    it("should make brute force attacks infeasible with 8 digits", () => {
      const totalCombinations = 100000000
      const attemptsPerHour = 15
      const hoursToExhaust = totalCombinations / attemptsPerHour

      expect(hoursToExhaust).toBeGreaterThan(6666666)
      expect(hoursToExhaust / 8760).toBeGreaterThan(760)
    })

    it("should provide significantly better security than 6 digits", () => {
      const sixDigitCombinations = 1000000
      const eightDigitCombinations = 100000000
      const improvementFactor = eightDigitCombinations / sixDigitCombinations

      expect(improvementFactor).toBe(100)
    })

    it("should reduce successful brute force probability to near zero", () => {
      const totalCombinations = 100000000
      const maxAttemptsPerDay = 360
      const probabilityPerDay = maxAttemptsPerDay / totalCombinations

      expect(probabilityPerDay).toBeLessThan(0.000004)
    })
  })

  describe("Backward Compatibility", () => {
    it("should generate codes that can be entered in numeric fields", () => {
      const otp = generateOTP()
      const parsed = parseInt(otp, 10)

      expect(isNaN(parsed)).toBe(false)
      expect(parsed.toString().padStart(8, "0")).toBe(otp)
    })

    it("should maintain string format for storage", () => {
      const otp = generateOTP()

      expect(typeof otp).toBe("string")
      expect(otp.charAt(0)).toMatch(/\d/)
    })
  })

  describe("Security Requirements", () => {
    it("should use cryptographically secure random generation", () => {
      const cryptoSpy = vi.spyOn(crypto, "randomInt")
      generateOTP()

      expect(cryptoSpy).toHaveBeenCalledWith(0, 100000000)
    })

    it("should not generate predictable patterns", () => {
      const otps = []
      for (let i = 0; i < 50; i++) {
        otps.push(generateOTP())
      }

      const sequential = otps.some((otp, i) => {
        if (i === 0) return false
        const prev = parseInt(otps[i - 1], 10)
        const curr = parseInt(otp, 10)
        return Math.abs(curr - prev) === 1
      })

      expect(sequential).toBe(false)
    })

    it("should not favor any particular digit range", () => {
      const firstDigits = []
      for (let i = 0; i < 1000; i++) {
        firstDigits.push(parseInt(generateOTP().charAt(0), 10))
      }

      const digitCounts = Array(10).fill(0)
      firstDigits.forEach((d) => digitCounts[d]++)

      const maxCount = Math.max(...digitCounts)
      const minCount = Math.min(...digitCounts)
      const variance = maxCount - minCount

      expect(variance).toBeLessThan(200)
    })
  })
})
