import { describe, it, expect, vi, beforeEach } from "vitest"

const mockWhere = vi.fn()
const mockFrom = vi.fn(() => ({ where: mockWhere }))
const mockSelect = vi.fn(() => ({ from: mockFrom }))
const mockDb = { select: mockSelect }

vi.mock("$lib/db/drizzle", () => ({
  getDatabase: vi.fn(async () => mockDb),
}))

vi.mock("$lib/db/schema", () => ({
  secrets: {},
  secretRecipients: {},
  disclosureLog: {
    secretId: "disclosureLog.secretId",
    status: "disclosureLog.status",
  },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
    { raw: vi.fn() },
  ),
}))

import { hasBeenDisclosed } from "../secrets"
import { eq } from "drizzle-orm"
import { disclosureLog } from "$lib/db/schema"

describe("hasBeenDisclosed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns false when sentCount is 0", async () => {
    mockWhere.mockResolvedValue([{ sentCount: 0 }])

    const result = await hasBeenDisclosed("secret-123")

    expect(result).toBe(false)
  })

  it("returns true when sentCount > 0", async () => {
    mockWhere.mockResolvedValue([{ sentCount: 3 }])

    const result = await hasBeenDisclosed("secret-abc")

    expect(result).toBe(true)
  })

  it("returns false when query returns empty array (no log entries)", async () => {
    mockWhere.mockResolvedValue([])

    const result = await hasBeenDisclosed("secret-none")

    expect(result).toBe(false)
  })

  it("returns false when sentCount is null", async () => {
    mockWhere.mockResolvedValue([{ sentCount: null }])

    const result = await hasBeenDisclosed("secret-null")

    expect(result).toBe(false)
  })

  it("passes the correct secretId to the query", async () => {
    mockWhere.mockResolvedValue([{ sentCount: 0 }])

    await hasBeenDisclosed("my-specific-secret-id")

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith(disclosureLog)
    expect(mockWhere).toHaveBeenCalledTimes(1)
    expect(eq).toHaveBeenCalledWith(
      disclosureLog.secretId,
      "my-specific-secret-id",
    )
  })
})
