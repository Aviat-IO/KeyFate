import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Environment Variables", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should export environment variables when all required ones are set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";
    process.env.NEXT_PUBLIC_COMPANY = "Test Company";
    process.env.NEXT_PUBLIC_PARENT_COMPANY = "Test Parent";
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

    const env = await import("@/lib/env");

    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://example.com");
    expect(env.NEXT_PUBLIC_SUPPORT_EMAIL).toBe("support@example.com");
    expect(env.NEXT_PUBLIC_COMPANY).toBe("Test Company");
    expect(env.NEXT_PUBLIC_PARENT_COMPANY).toBe("Test Parent");
    expect(env.GOOGLE_CLIENT_ID).toBe("test-client-id");
    expect(env.GOOGLE_CLIENT_SECRET).toBe("test-client-secret");
  });

  it("should throw error when NEXT_PUBLIC_SITE_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";
    process.env.NEXT_PUBLIC_COMPANY = "Test Company";
    process.env.NEXT_PUBLIC_PARENT_COMPANY = "Test Parent";

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_SITE_URL is not set",
    );
  });

  it("should throw error when NEXT_PUBLIC_SUPPORT_EMAIL is not set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    process.env.NEXT_PUBLIC_COMPANY = "Test Company";
    process.env.NEXT_PUBLIC_PARENT_COMPANY = "Test Parent";

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_SUPPORT_EMAIL is not set",
    );
  });

  it("should throw error when NEXT_PUBLIC_COMPANY is not set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";
    delete process.env.NEXT_PUBLIC_COMPANY;
    process.env.NEXT_PUBLIC_PARENT_COMPANY = "Test Parent";

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_COMPANY is not set",
    );
  });

  it("should throw error when NEXT_PUBLIC_PARENT_COMPANY is not set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";
    process.env.NEXT_PUBLIC_COMPANY = "Test Company";
    delete process.env.NEXT_PUBLIC_PARENT_COMPANY;

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_PARENT_COMPANY is not set",
    );
  });

  it("should handle optional Supabase variables gracefully during migration", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";
    process.env.NEXT_PUBLIC_COMPANY = "Test Company";
    process.env.NEXT_PUBLIC_PARENT_COMPANY = "Test Parent";
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

    const env = await import("@/lib/env");

    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://example.com");
  });

  it("should handle optional Stripe variable gracefully", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";
    process.env.NEXT_PUBLIC_COMPANY = "Test Company";
    process.env.NEXT_PUBLIC_PARENT_COMPANY = "Test Parent";
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    // Stripe variable not set (should not throw)
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    const env = await import("@/lib/env");

    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://example.com");
    expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBeUndefined();
  });
});
