import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getDatabase } from "@/lib/db/drizzle"
import { users, secrets as secretsTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

describe("CSRF Protection", () => {
  let testUserId: string
  let testSecretId: string
  let authToken: string

  beforeEach(async () => {
    const db = await getDatabase()

    testUserId = crypto.randomUUID()
    await db.insert(users).values({
      id: testUserId,
      email: "csrf-test@example.com",
      emailVerified: new Date(),
      password: null,
      name: "CSRF Test User",
      image: null,
    })

    const [secret] = await db
      .insert(secretsTable)
      .values({
        id: crypto.randomUUID(),
        userId: testUserId,
        title: "Test Secret",
        checkInDays: 7,
        threshold: 2,
        status: "active",
        lastCheckIn: new Date(),
        nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning()

    testSecretId = secret.id
  })

  afterEach(async () => {
    const db = await getDatabase()
    if (testSecretId) {
      await db.delete(secretsTable).where(eq(secretsTable.id, testSecretId))
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId))
    }
  })

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
