import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  generateOTP,
  createOTPToken,
  validateOTPToken,
  invalidateOTPTokens,
  checkOTPRateLimit,
} from "../otp"

vi.mock("@/lib/db/drizzle", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    set: vi.fn(),
    transaction: vi.fn(),
  }

  return {
    getDatabase: vi.fn(() => Promise.resolve(mockDb)),
    db: mockDb,
  }
})

describe("OTP Generation", () => {
  describe("generateOTP", () => {
    it("should generate a 6-digit numeric code", () => {
      const otp = generateOTP()

      expect(otp).toBeDefined()
      expect(typeof otp).toBe("string")
      expect(otp.length).toBe(6)
      expect(/^\d{6}$/.test(otp)).toBe(true)
    })

    it("should pad codes to 6 digits", () => {
      const otp = generateOTP()

      expect(otp.length).toBe(6)
      expect(otp.startsWith("0") || Number(otp) >= 100000).toBe(true)
    })

    it("should generate different codes on subsequent calls", () => {
      const codes = new Set()
      for (let i = 0; i < 100; i++) {
        codes.add(generateOTP())
      }

      expect(codes.size).toBeGreaterThan(90)
    })

    it("should have uniform distribution", () => {
      const codes: number[] = []
      for (let i = 0; i < 1000; i++) {
        codes.push(Number(generateOTP()))
      }

      const avg = codes.reduce((a, b) => a + b, 0) / codes.length
      expect(avg).toBeGreaterThan(400000)
      expect(avg).toBeLessThan(600000)
    })

    it("should not produce predictable patterns", () => {
      const otp1 = generateOTP()
      const otp2 = generateOTP()
      const otp3 = generateOTP()

      const num1 = Number(otp1)
      const num2 = Number(otp2)
      const num3 = Number(otp3)

      expect(Math.abs(num2 - num1)).not.toBe(1)
      expect(Math.abs(num3 - num2)).not.toBe(1)
    })
  })

  describe("generateOTP collision handling", () => {
    it("should retry on collision", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ token: "123456" }]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              identifier: "test@example.com",
              token: "123456",
              expires: new Date(Date.now() + 10 * 60 * 1000),
              purpose: "authentication",
              attemptCount: 0,
            },
          ]),
        }),
      } as any)

      const result = await createOTPToken("test@example.com", "authentication")

      expect(result.success).toBe(true)
      expect(result.code).toBeDefined()
      expect(result.code?.length).toBe(6)
    })

    it("should fail after 3 collision attempts", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ token: "123456" }]),
          }),
        }),
      } as any)

      const result = await createOTPToken("test@example.com", "authentication")

      expect(result.success).toBe(false)
      expect(result.error).toContain("collision")
    })
  })
})

describe("OTP Storage and Retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createOTPToken", () => {
    it("should store OTP with correct metadata", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              identifier: "test@example.com",
              token: "123456",
              expires: new Date(Date.now() + 10 * 60 * 1000),
              purpose: "authentication",
              attemptCount: 0,
            },
          ]),
        }),
      } as any)

      const result = await createOTPToken("test@example.com", "authentication")

      expect(result.success).toBe(true)
      expect(result.code).toBeDefined()
      expect(result.code?.length).toBe(6)
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it("should invalidate previous unused OTPs", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              identifier: "test@example.com",
              token: "123456",
              expires: new Date(Date.now() + 10 * 60 * 1000),
              purpose: "authentication",
              attemptCount: 0,
            },
          ]),
        }),
      } as any)

      await createOTPToken("test@example.com", "authentication")

      expect(mockDb.update).toHaveBeenCalled()
    })

    it("should set expiration to 10 minutes", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      const now = Date.now()
      const expectedExpiry = new Date(now + 10 * 60 * 1000)

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      let insertedExpiry: Date | undefined

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockImplementation((data: any) => {
          insertedExpiry = data.expires
          return {
            returning: vi.fn().mockResolvedValue([
              {
                identifier: "test@example.com",
                token: "123456",
                expires: data.expires,
                purpose: "authentication",
                attemptCount: 0,
              },
            ]),
          }
        }),
      } as any)

      await createOTPToken("test@example.com", "authentication")

      expect(insertedExpiry).toBeDefined()
      const expiryTime = insertedExpiry!.getTime()
      expect(expiryTime).toBeGreaterThanOrEqual(expectedExpiry.getTime() - 1000)
      expect(expiryTime).toBeLessThanOrEqual(expectedExpiry.getTime() + 1000)
    })
  })

  describe("validateOTPToken", () => {
    it("should validate correct OTP", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      const futureDate = new Date(Date.now() + 10 * 60 * 1000)

      vi.mocked(mockDb.transaction).mockImplementation(
        async (callback: any) => {
          const txMock = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([
                      {
                        identifier: "test@example.com",
                        token: "123456",
                        expires: futureDate,
                        purpose: "authentication",
                        attemptCount: 0,
                      },
                    ]),
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
              }),
            }),
          }
          return callback(txMock)
        },
      )

      const result = await validateOTPToken("test@example.com", "123456")

      expect(result.success).toBe(true)
      expect(result.valid).toBe(true)
    })

    it("should reject invalid OTP", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.transaction).mockImplementation(
        async (callback: any) => {
          const txMock = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }
          return callback(txMock)
        },
      )

      const result = await validateOTPToken("test@example.com", "999999")

      expect(result.success).toBe(false)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Invalid")
    })

    it("should reject expired OTP", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      const pastDate = new Date(Date.now() - 1000)

      vi.mocked(mockDb.transaction).mockImplementation(
        async (callback: any) => {
          const txMock = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([
                      {
                        identifier: "test@example.com",
                        token: "123456",
                        expires: pastDate,
                        purpose: "authentication",
                        attemptCount: 0,
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }
          return callback(txMock)
        },
      )

      const result = await validateOTPToken("test@example.com", "123456")

      expect(result.success).toBe(false)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("expired")
    })

    it("should reject OTP after max attempts", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      const futureDate = new Date(Date.now() + 10 * 60 * 1000)

      vi.mocked(mockDb.transaction).mockImplementation(
        async (callback: any) => {
          const txMock = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([
                      {
                        identifier: "test@example.com",
                        token: "123456",
                        expires: futureDate,
                        purpose: "authentication",
                        attemptCount: 5,
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }
          return callback(txMock)
        },
      )

      const result = await validateOTPToken("test@example.com", "123456")

      expect(result.success).toBe(false)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("attempts")
    })

    it("should handle concurrent validation attempts atomically", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      const futureDate = new Date(Date.now() + 10 * 60 * 1000)
      let validationCount = 0

      vi.mocked(mockDb.transaction).mockImplementation(
        async (callback: any) => {
          validationCount++
          if (validationCount === 1) {
            const txMock = {
              select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      for: vi.fn().mockResolvedValue([
                        {
                          identifier: "test@example.com",
                          token: "123456",
                          expires: futureDate,
                          purpose: "authentication",
                          attemptCount: 0,
                        },
                      ]),
                    }),
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue(undefined),
                }),
              }),
            }
            return callback(txMock)
          } else {
            const txMock = {
              select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      for: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }
            return callback(txMock)
          }
        },
      )

      const [result1, result2] = await Promise.all([
        validateOTPToken("test@example.com", "123456"),
        validateOTPToken("test@example.com", "123456"),
      ])

      const successCount = (result1.success ? 1 : 0) + (result2.success ? 1 : 0)
      expect(successCount).toBe(1)
    })
  })

  describe("invalidateOTPTokens", () => {
    it("should mark old OTPs as expired", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      await invalidateOTPTokens("test@example.com")

      expect(mockDb.update).toHaveBeenCalled()
    })
  })
})

describe("OTP Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("checkOTPRateLimit", () => {
    it("should allow requests under rate limit", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      const futureWindowEnd = new Date(Date.now() + 30 * 60 * 1000)

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "test-id",
                email: "test@example.com",
                requestCount: 9,
                windowStart: new Date(),
                windowEnd: futureWindowEnd,
              },
            ]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      const result = await checkOTPRateLimit("test@example.com")

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(0)
    })

    it("should block requests over rate limit", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                email: "test@example.com",
                requestCount: 10,
                windowEnd: new Date(Date.now() + 30 * 60 * 1000),
              },
            ]),
          }),
        }),
      } as any)

      const result = await checkOTPRateLimit("test@example.com")

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.resetAt).toBeDefined()
    })

    it("should reset rate limit after window expires", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                email: "test@example.com",
                requestCount: 3,
                windowEnd: new Date(Date.now() - 1000),
              },
            ]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      const result = await checkOTPRateLimit("test@example.com")

      expect(result.allowed).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("should create new rate limit record for first request", async () => {
      const { getDatabase } = await import("@/lib/db/drizzle")
      const mockDb = await getDatabase()

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              email: "test@example.com",
              requestCount: 1,
              windowStart: new Date(),
              windowEnd: new Date(Date.now() + 60 * 60 * 1000),
            },
          ]),
        }),
      } as any)

      const result = await checkOTPRateLimit("test@example.com")

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })
})
