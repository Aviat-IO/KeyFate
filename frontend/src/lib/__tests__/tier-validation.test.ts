import { describe, expect, it } from "vitest"
import {
  canAccessMessageTemplates,
  canConfigureThreshold,
  canAccessAuditLogs,
  getMaxShares,
  getMaxThreshold,
  getMinThreshold,
  isValidThreshold,
} from "../tier-validation"

describe("canAccessMessageTemplates", () => {
  it("should return true for Pro tier", () => {
    expect(canAccessMessageTemplates("pro")).toBe(true)
  })

  it("should return false for Free tier", () => {
    expect(canAccessMessageTemplates("free")).toBe(false)
  })
})

describe("canConfigureThreshold", () => {
  it("should return true for Pro tier", () => {
    expect(canConfigureThreshold("pro")).toBe(true)
  })

  it("should return false for Free tier", () => {
    expect(canConfigureThreshold("free")).toBe(false)
  })
})

describe("canAccessAuditLogs", () => {
  it("should return true for Pro tier", () => {
    expect(canAccessAuditLogs("pro")).toBe(true)
  })

  it("should return false for Free tier", () => {
    expect(canAccessAuditLogs("free")).toBe(false)
  })
})

describe("getMaxShares", () => {
  it("should return 7 for Pro tier", () => {
    expect(getMaxShares("pro")).toBe(7)
  })

  it("should return 3 for Free tier", () => {
    expect(getMaxShares("free")).toBe(3)
  })
})

describe("getMaxThreshold", () => {
  it("should return totalShares when under tier limit", () => {
    expect(getMaxThreshold("pro", 5)).toBe(5)
    expect(getMaxThreshold("free", 3)).toBe(3)
  })

  it("should return tier max when totalShares exceeds it", () => {
    expect(getMaxThreshold("free", 5)).toBe(3)
    expect(getMaxThreshold("pro", 10)).toBe(7)
  })
})

describe("getMinThreshold", () => {
  it("should always return 2", () => {
    expect(getMinThreshold()).toBe(2)
  })
})

describe("isValidThreshold", () => {
  describe("Pro tier", () => {
    it("should accept valid 2-of-3", () => {
      expect(isValidThreshold("pro", 2, 3)).toBe(true)
    })

    it("should accept valid 3-of-5", () => {
      expect(isValidThreshold("pro", 3, 5)).toBe(true)
    })

    it("should accept valid 4-of-7", () => {
      expect(isValidThreshold("pro", 4, 7)).toBe(true)
    })

    it("should accept valid 7-of-7", () => {
      expect(isValidThreshold("pro", 7, 7)).toBe(true)
    })

    it("should reject threshold > totalShares", () => {
      expect(isValidThreshold("pro", 5, 3)).toBe(false)
    })

    it("should reject threshold < 2", () => {
      expect(isValidThreshold("pro", 1, 5)).toBe(false)
    })

    it("should reject totalShares > 7", () => {
      expect(isValidThreshold("pro", 5, 10)).toBe(false)
    })

    it("should reject totalShares < 3", () => {
      expect(isValidThreshold("pro", 2, 2)).toBe(false)
    })
  })

  describe("Free tier", () => {
    it("should accept 2-of-3", () => {
      expect(isValidThreshold("free", 2, 3)).toBe(true)
    })

    it("should accept 3-of-3", () => {
      expect(isValidThreshold("free", 3, 3)).toBe(true)
    })

    it("should reject totalShares > 3", () => {
      expect(isValidThreshold("free", 2, 5)).toBe(false)
    })

    it("should reject threshold < 2", () => {
      expect(isValidThreshold("free", 1, 3)).toBe(false)
    })

    it("should reject threshold > totalShares", () => {
      expect(isValidThreshold("free", 4, 3)).toBe(false)
    })
  })
})
