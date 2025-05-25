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

  it("should export environment variables when all are set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

    const env = await import("@/lib/env");

    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://example.com");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
  });

  it("should throw error when NEXT_PUBLIC_SITE_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_SITE_URL is not set",
    );
  });

  it("should throw error when NEXT_PUBLIC_SUPABASE_ANON_KEY is not set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
    );
  });

  it("should throw error when NEXT_PUBLIC_SUPABASE_URL is not set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL is not set",
    );
  });
});
