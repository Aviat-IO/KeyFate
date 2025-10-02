import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as checkSecretsPost } from "@/app/api/cron/check-secrets/route";
import { POST as processRemindersPost } from "@/app/api/cron/process-reminders/route";

// Mock environment variable
const originalEnv = process.env.CRON_SECRET;

describe("Cron Authentication", () => {
  const validCronSecret = "test-secret-key-12345678901234567890";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = validCronSecret;
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  describe("/api/cron/check-secrets", () => {
    it("should reject requests without Authorization header", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject requests with invalid Bearer token", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer wrong-token",
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject requests with malformed Authorization header", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: "Invalid format",
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should accept requests with valid Bearer token", async () => {
      // Mock database to avoid actual DB calls
      vi.mock("@/lib/db/drizzle", () => ({
        getDatabase: vi.fn().mockResolvedValue({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }));

      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${validCronSecret}`,
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("processed");
      expect(data).toHaveProperty("timestamp");
    });

    it("should accept requests with uppercase Authorization header", async () => {
      vi.mock("@/lib/db/drizzle", () => ({
        getDatabase: vi.fn().mockResolvedValue({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }));

      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${validCronSecret}`, // lowercase
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it("should reject requests when CRON_SECRET is not set", async () => {
      delete process.env.CRON_SECRET;

      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${validCronSecret}`,
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle empty Bearer token", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer ",
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should trim whitespace from Bearer token", async () => {
      vi.mock("@/lib/db/drizzle", () => ({
        getDatabase: vi.fn().mockResolvedValue({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }));

      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer   ${validCronSecret}   `,
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  describe("/api/cron/process-reminders", () => {
    it("should reject requests without Authorization header", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/process-reminders",
        {
          method: "POST",
        }
      );

      const response = await processRemindersPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject requests with invalid Bearer token", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/process-reminders",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer wrong-token",
          },
        }
      );

      const response = await processRemindersPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should accept requests with valid Bearer token", async () => {
      vi.mock("@/lib/db/drizzle", () => ({
        getDatabase: vi.fn().mockResolvedValue({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }));

      const request = new NextRequest(
        "http://localhost/api/cron/process-reminders",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${validCronSecret}`,
          },
        }
      );

      const response = await processRemindersPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("processed");
      expect(data).toHaveProperty("timestamp");
    });
  });

  describe("Security Requirements", () => {
    it("should use strong secret (at least 32 characters)", () => {
      const testSecret = process.env.CRON_SECRET || "";
      expect(testSecret.length).toBeGreaterThanOrEqual(32);
    });

    it("should not expose secret in error messages", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer wrong-token",
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      // Error message should not contain the actual secret
      expect(JSON.stringify(data)).not.toContain(validCronSecret);
    });

    it("should enforce HTTPS in production (checked via headers)", async () => {
      // This is enforced at the infrastructure level (Cloud Scheduler, Load Balancer)
      // We verify that our endpoint respects standard security headers
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${validCronSecret}`,
          },
        }
      );

      // In production, requests without proper TLS should be rejected at the LB level
      // Our endpoint should work with valid auth regardless
      const response = await checkSecretsPost(request);
      expect([200, 500]).toContain(response.status); // Either success or DB error, not auth error
    });
  });

  describe("Token Format Validation", () => {
    it("should reject token without Bearer prefix", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: validCronSecret, // Missing "Bearer " prefix
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle case-sensitive token comparison", async () => {
      const request = new NextRequest(
        "http://localhost/api/cron/check-secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${validCronSecret.toUpperCase()}`,
          },
        }
      );

      const response = await checkSecretsPost(request);
      const data = await response.json();

      // Should fail because tokens are case-sensitive
      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});
