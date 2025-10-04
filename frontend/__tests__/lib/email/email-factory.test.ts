/**
 * Email Factory Tests
 *
 * Tests for email provider factory pattern implementation.
 * Validates environment-based provider selection and configuration.
 */

import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import {
  getEmailProvider,
  validateEmailProviderConfig,
} from "@/lib/email/email-factory";

describe("Email Factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("getEmailProvider", () => {
    it("should return SendGridAdapter for sendgrid provider", () => {
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const provider = getEmailProvider();

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe("sendgrid");
    });

    it("should return MockAdapter for mock provider", () => {
      process.env.EMAIL_PROVIDER = "mock";

      const provider = getEmailProvider();

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe("mock");
    });

    it("should throw error for unsupported provider", () => {
      process.env.EMAIL_PROVIDER = "unsupported";

      expect(() => getEmailProvider()).toThrow(
        "Unsupported email provider: unsupported",
      );
    });

    it("should default to mock in development environment", () => {
      process.env.NODE_ENV = "development";
      delete process.env.EMAIL_PROVIDER;

      const provider = getEmailProvider();

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe("mock");
    });

    it("should default to sendgrid in production environment", () => {
      process.env.NODE_ENV = "production";
      delete process.env.EMAIL_PROVIDER;
      process.env.SENDGRID_API_KEY = "test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const provider = getEmailProvider();

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe("sendgrid");
    });

    it("should handle case-insensitive provider names", () => {
      process.env.EMAIL_PROVIDER = "SENDGRID";
      process.env.SENDGRID_API_KEY = "test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const provider = getEmailProvider();

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe("sendgrid");
    });
  });

  describe("validateEmailProviderConfig", () => {
    it("should validate sendgrid configuration", () => {
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const result = validateEmailProviderConfig();

      expect(result.valid).toBe(true);
      expect(result.provider).toBe("sendgrid");
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing SENDGRID_API_KEY", () => {
      process.env.EMAIL_PROVIDER = "sendgrid";
      delete process.env.SENDGRID_API_KEY;
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const result = validateEmailProviderConfig();

      expect(result.valid).toBe(false);
      expect(result.provider).toBe("sendgrid");
      expect(result.errors).toContain(
        "SENDGRID_API_KEY environment variable is required",
      );
    });

    it("should detect missing SENDGRID_ADMIN_EMAIL", () => {
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "test-key";
      delete process.env.SENDGRID_ADMIN_EMAIL;

      const result = validateEmailProviderConfig();

      expect(result.valid).toBe(false);
      expect(result.provider).toBe("sendgrid");
      expect(result.errors).toContain(
        "SENDGRID_ADMIN_EMAIL environment variable is required",
      );
    });

    it("should validate mock configuration (no env vars required)", () => {
      process.env.EMAIL_PROVIDER = "mock";

      const result = validateEmailProviderConfig();

      expect(result.valid).toBe(true);
      expect(result.provider).toBe("mock");
      expect(result.errors).toHaveLength(0);
    });

    it("should reject unsupported provider", () => {
      process.env.EMAIL_PROVIDER = "invalid-provider";

      const result = validateEmailProviderConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Unsupported EMAIL_PROVIDER: invalid-provider. Supported: sendgrid, mock",
      );
    });

    it("should default to mock in development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.EMAIL_PROVIDER;

      const result = validateEmailProviderConfig();

      expect(result.provider).toBe("mock");
      expect(result.valid).toBe(true);
    });

    it("should default to sendgrid in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.EMAIL_PROVIDER;
      process.env.SENDGRID_API_KEY = "test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const result = validateEmailProviderConfig();

      expect(result.provider).toBe("sendgrid");
      expect(result.valid).toBe(true);
    });

    it("should handle case-insensitive provider validation", () => {
      process.env.EMAIL_PROVIDER = "MOCK";

      const result = validateEmailProviderConfig();

      expect(result.provider).toBe("mock");
      expect(result.valid).toBe(true);
    });
  });

  describe("Factory pattern behavior", () => {
    it("should return consistent provider type", () => {
      process.env.EMAIL_PROVIDER = "mock";

      const provider1 = getEmailProvider();
      const provider2 = getEmailProvider();

      expect(provider1.getProviderName()).toBe("mock");
      expect(provider2.getProviderName()).toBe("mock");
    });

    it("should respect environment variable changes", () => {
      process.env.EMAIL_PROVIDER = "mock";
      const mockProvider = getEmailProvider();
      expect(mockProvider.getProviderName()).toBe("mock");

      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const sendgridProvider = getEmailProvider();
      expect(sendgridProvider).toBeDefined();
      expect(sendgridProvider.getProviderName()).toBe("sendgrid");
    });
  });
});
