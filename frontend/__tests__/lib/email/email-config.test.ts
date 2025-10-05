/**
 * Email Configuration Validation Tests
 *
 * Tests for environment variable validation, configuration management,
 * and error handling for the email system.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  validateEmailEnvironment,
  getRequiredEmailVars,
  getOptionalEmailVars,
  validateCronSecret,
  validateEmailProviderVars,
  getEmailConfigurationStatus,
  type EmailEnvironmentValidation,
  type EmailConfigStatus,
} from "@/lib/email/email-config";

describe("Email Configuration Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("validateEmailEnvironment", () => {
    it("should validate complete SendGrid configuration in production", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key-12345";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.SENDGRID_SENDER_NAME = "Dead Man's Switch";
      process.env.ADMIN_ALERT_EMAIL = "alerts@example.com";
      process.env.CRON_SECRET = "test-cron-secret-123";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.environment).toBe("production");
      expect(result.provider).toBe("sendgrid");
    });

    it("should detect missing SENDGRID_API_KEY in production", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      delete process.env.SENDGRID_API_KEY;
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "SENDGRID_API_KEY is required for SendGrid provider",
      );
      expect(result.missingRequired).toContain("SENDGRID_API_KEY");
    });

    it("should detect missing SENDGRID_ADMIN_EMAIL", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key";
      delete process.env.SENDGRID_ADMIN_EMAIL;
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "SENDGRID_ADMIN_EMAIL is required for SendGrid provider",
      );
      expect(result.missingRequired).toContain("SENDGRID_ADMIN_EMAIL");
    });

    it("should detect missing CRON_SECRET", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      delete process.env.CRON_SECRET;

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "CRON_SECRET is required for cron job authentication",
      );
      expect(result.missingRequired).toContain("CRON_SECRET");
    });

    it("should warn about missing optional SENDGRID_SENDER_NAME", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.CRON_SECRET = "test-secret";
      delete process.env.SENDGRID_SENDER_NAME;

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "SENDGRID_SENDER_NAME not set, using default: Dead Man's Switch",
      );
      expect(result.missingOptional).toContain("SENDGRID_SENDER_NAME");
    });

    it("should warn about missing optional ADMIN_ALERT_EMAIL", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.CRON_SECRET = "test-secret";
      delete process.env.ADMIN_ALERT_EMAIL;

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "ADMIN_ALERT_EMAIL not set, using default: support@aviat.io",
      );
      expect(result.missingOptional).toContain("ADMIN_ALERT_EMAIL");
    });

    it("should allow mock provider in development without SendGrid vars", () => {
      process.env.NODE_ENV = "development";
      process.env.EMAIL_PROVIDER = "mock";
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_ADMIN_EMAIL;
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.provider).toBe("mock");
    });

    it("should default to mock in development when EMAIL_PROVIDER not set", () => {
      process.env.NODE_ENV = "development";
      delete process.env.EMAIL_PROVIDER;
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(true);
      expect(result.provider).toBe("mock");
      expect(result.warnings).toContain(
        "EMAIL_PROVIDER not set, defaulting to mock",
      );
    });

    it("should validate empty string as invalid value", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "SENDGRID_API_KEY is required for SendGrid provider",
      );
    });

    it("should validate whitespace-only string as invalid value", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "   ";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "SENDGRID_API_KEY is required for SendGrid provider",
      );
    });

    it("should collect multiple errors", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_ADMIN_EMAIL;
      delete process.env.CRON_SECRET;

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain(
        "SENDGRID_API_KEY is required for SendGrid provider",
      );
      expect(result.errors).toContain(
        "SENDGRID_ADMIN_EMAIL is required for SendGrid provider",
      );
      expect(result.errors).toContain(
        "CRON_SECRET is required for cron job authentication",
      );
    });
  });

  describe("validateCronSecret", () => {
    it("should validate present CRON_SECRET", () => {
      process.env.CRON_SECRET = "test-secret-123";

      const result = validateCronSecret();

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should detect missing CRON_SECRET", () => {
      delete process.env.CRON_SECRET;

      const result = validateCronSecret();

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "CRON_SECRET is required for cron job authentication",
      );
    });

    it("should detect empty CRON_SECRET", () => {
      process.env.CRON_SECRET = "";

      const result = validateCronSecret();

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "CRON_SECRET is required for cron job authentication",
      );
    });

    it("should warn about weak CRON_SECRET", () => {
      process.env.CRON_SECRET = "123";

      const result = validateCronSecret();

      expect(result.valid).toBe(true);
      expect(result.warning).toBe(
        "CRON_SECRET is too short (minimum 16 characters recommended for security)",
      );
    });
  });

  describe("validateEmailProviderVars", () => {
    it("should validate SendGrid provider variables", () => {
      process.env.SENDGRID_API_KEY = "SG.test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const result = validateEmailProviderVars("sendgrid");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate mock provider without variables", () => {
      const result = validateEmailProviderVars("mock");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing SendGrid API key", () => {
      delete process.env.SENDGRID_API_KEY;
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";

      const result = validateEmailProviderVars("sendgrid");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "SENDGRID_API_KEY is required for SendGrid provider",
      );
    });

    it("should detect missing SendGrid admin email", () => {
      process.env.SENDGRID_API_KEY = "SG.test-key";
      delete process.env.SENDGRID_ADMIN_EMAIL;

      const result = validateEmailProviderVars("sendgrid");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "SENDGRID_ADMIN_EMAIL is required for SendGrid provider",
      );
    });
  });

  describe("getRequiredEmailVars", () => {
    it("should return required vars for sendgrid provider", () => {
      const vars = getRequiredEmailVars("sendgrid");

      expect(vars).toContain("SENDGRID_API_KEY");
      expect(vars).toContain("SENDGRID_ADMIN_EMAIL");
      expect(vars).toContain("CRON_SECRET");
    });

    it("should return only CRON_SECRET for mock provider", () => {
      const vars = getRequiredEmailVars("mock");

      expect(vars).toContain("CRON_SECRET");
      expect(vars).not.toContain("SENDGRID_API_KEY");
      expect(vars).not.toContain("SENDGRID_ADMIN_EMAIL");
    });
  });

  describe("getOptionalEmailVars", () => {
    it("should return optional vars for sendgrid provider", () => {
      const vars = getOptionalEmailVars("sendgrid");

      expect(vars).toContain("SENDGRID_SENDER_NAME");
      expect(vars).toContain("EMAIL_PROVIDER");
      expect(vars).toContain("ADMIN_ALERT_EMAIL");
    });

    it("should return optional vars for mock provider", () => {
      const vars = getOptionalEmailVars("mock");

      expect(vars).toContain("EMAIL_PROVIDER");
      expect(vars).toContain("ADMIN_ALERT_EMAIL");
    });
  });

  describe("getEmailConfigurationStatus", () => {
    it("should return comprehensive status for valid configuration", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key-12345";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.SENDGRID_SENDER_NAME = "Dead Man's Switch";
      process.env.ADMIN_ALERT_EMAIL = "alerts@example.com";
      process.env.CRON_SECRET = "test-cron-secret-123";

      const status = getEmailConfigurationStatus();

      expect(status.ready).toBe(true);
      expect(status.provider).toBe("sendgrid");
      expect(status.environment).toBe("production");
      expect(status.hasRequiredVars).toBe(true);
      expect(status.cronSecretValid).toBe(true);
      expect(status.configuredVars).toContain("SENDGRID_API_KEY");
      expect(status.configuredVars).toContain("SENDGRID_ADMIN_EMAIL");
      expect(status.configuredVars).toContain("CRON_SECRET");
    });

    it("should return not ready status for missing vars", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      delete process.env.SENDGRID_API_KEY;
      delete process.env.CRON_SECRET;

      const status = getEmailConfigurationStatus();

      expect(status.ready).toBe(false);
      expect(status.hasRequiredVars).toBe(false);
      expect(status.missingVars).toContain("SENDGRID_API_KEY");
      expect(status.missingVars).toContain("CRON_SECRET");
    });

    it("should include defaults in status", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.CRON_SECRET = "test-secret";
      delete process.env.SENDGRID_SENDER_NAME;
      delete process.env.ADMIN_ALERT_EMAIL;

      const status = getEmailConfigurationStatus();

      expect(status.ready).toBe(true);
      expect(status.defaults).toEqual({
        SENDGRID_SENDER_NAME: "Dead Man's Switch",
        ADMIN_ALERT_EMAIL: "support@aviat.io",
      });
    });
  });

  describe("Error message quality", () => {
    it("should provide actionable error messages", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "sendgrid";
      delete process.env.SENDGRID_API_KEY;

      const result = validateEmailEnvironment();

      expect(result.errors[0]).toContain("SENDGRID_API_KEY");
      expect(result.errors[0]).toContain("required");
      expect(result.errors[0]).toContain("SendGrid provider");
    });

    it("should provide helpful remediation in status", () => {
      process.env.NODE_ENV = "production";
      delete process.env.SENDGRID_API_KEY;

      const status = getEmailConfigurationStatus();

      expect(status.ready).toBe(false);
      expect(status.remediation).toBeDefined();
      expect(status.remediation).toContain("SENDGRID_API_KEY");
    });
  });

  describe("Production vs Development modes", () => {
    it("should enforce stricter validation in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.EMAIL_PROVIDER;
      delete process.env.SENDGRID_API_KEY;

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should be lenient in development with mock provider", () => {
      process.env.NODE_ENV = "development";
      delete process.env.EMAIL_PROVIDER;
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(true);
      expect(result.provider).toBe("mock");
    });

    it("should allow SendGrid testing in development", () => {
      process.env.NODE_ENV = "development";
      process.env.EMAIL_PROVIDER = "sendgrid";
      process.env.SENDGRID_API_KEY = "SG.test-key";
      process.env.SENDGRID_ADMIN_EMAIL = "admin@example.com";
      process.env.CRON_SECRET = "test-secret";

      const result = validateEmailEnvironment();

      expect(result.valid).toBe(true);
      expect(result.provider).toBe("sendgrid");
    });
  });
});
