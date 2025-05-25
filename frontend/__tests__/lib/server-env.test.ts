import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Server Environment Variables", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should export SUPABASE_SERVICE_ROLE_KEY when set", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    const serverEnv = await import("@/lib/server-env");

    expect(serverEnv.SUPABASE_SERVICE_ROLE_KEY).toBe("test-service-role-key");
  });

  it("should throw error when SUPABASE_SERVICE_ROLE_KEY is not set", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(() => import("@/lib/server-env")).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is not set",
    );
  });

  it("should throw error when SUPABASE_SERVICE_ROLE_KEY is empty string", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    await expect(() => import("@/lib/server-env")).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is not set",
    );
  });
});
