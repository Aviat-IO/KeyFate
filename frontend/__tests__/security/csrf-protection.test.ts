import { describe, it, expect, vi } from "vitest"

// Mock the database - CSRF tests don't need real DB, just test HTTP layer
vi.mock("@/lib/db/drizzle", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/db/drizzle")>("@/lib/db/drizzle")
  return {
    ...actual,
    getDatabase: vi.fn(async () => ({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "test-id" }])),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => Promise.resolve([])),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  }
})

// Mock auth to prevent 401 errors
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(async () => ({
    user: {
      id: "test-user-id",
      email: "test@example.com",
      emailVerified: new Date(),
    },
  })),
}))

describe("CSRF Protection", () => {
  const testSecretId = "test-secret-id"

  describe("POST /api/secrets", () => {
    it("should reject requests without origin header", async () => {
      const response = await fetch("http://localhost:3000/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No origin header
        },
        body: JSON.stringify({
          title: "New Secret",
          check_in_days: 7,
          recipients: [{ name: "Test", email: "test@example.com" }],
        }),
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })

    it("should reject requests with mismatched origin", async () => {
      const response = await fetch("http://localhost:3000/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://evil-site.com",
          Host: "localhost:3000",
        },
        body: JSON.stringify({
          title: "New Secret",
          check_in_days: 7,
          recipients: [{ name: "Test", email: "test@example.com" }],
        }),
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })

    it("should accept requests with matching origin", async () => {
      const response = await fetch("http://localhost:3000/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Host: "localhost:3000",
        },
        body: JSON.stringify({
          title: "New Secret",
          check_in_days: 7,
          recipients: [{ name: "Test", email: "test@example.com" }],
        }),
      })

      // Should pass CSRF check (but may fail auth if not properly authenticated)
      expect(response.status).not.toBe(403)
    })
  })

  describe("PUT /api/secrets/[id]", () => {
    it("should reject requests without origin header", async () => {
      const response = await fetch(
        `http://localhost:3000/api/secrets/${testSecretId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Updated Secret",
            check_in_days: 14,
            recipients: [{ name: "Test", email: "test@example.com" }],
          }),
        },
      )

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })

    it("should reject requests with mismatched origin", async () => {
      const response = await fetch(
        `http://localhost:3000/api/secrets/${testSecretId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://evil-site.com",
            Host: "localhost:3000",
          },
          body: JSON.stringify({
            title: "Updated Secret",
            check_in_days: 14,
            recipients: [{ name: "Test", email: "test@example.com" }],
          }),
        },
      )

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })
  })

  describe("DELETE /api/secrets/[id]", () => {
    it("should reject requests without origin header", async () => {
      const response = await fetch(
        `http://localhost:3000/api/secrets/${testSecretId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })

    it("should reject requests with mismatched origin", async () => {
      const response = await fetch(
        `http://localhost:3000/api/secrets/${testSecretId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://evil-site.com",
            Host: "localhost:3000",
          },
        },
      )

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })
  })

  describe("POST /api/secrets/[id]/toggle-pause", () => {
    it("should enforce CSRF protection", async () => {
      const response = await fetch(
        `http://localhost:3000/api/secrets/${testSecretId}/toggle-pause`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://evil-site.com",
            Host: "localhost:3000",
          },
        },
      )

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })
  })

  describe("POST /api/create-checkout-session", () => {
    it("should enforce CSRF protection on payment endpoints", async () => {
      const response = await fetch(
        "http://localhost:3000/api/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://evil-site.com",
            Host: "localhost:3000",
          },
          body: JSON.stringify({
            lookup_key: "pro_monthly",
          }),
        },
      )

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain("CSRF")
    })
  })
})
