import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  envDir: "./",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["__tests__/setup.ts"],
    testTimeout: 10000,
    fakeTimers: {
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
      shouldAdvanceTime: true,
      advanceTimeDelta: 20,
    },
    env: {
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPPORT_EMAIL: "support@aviat.io",
      NEXT_PUBLIC_SITE_URL: "https://keyfate.com",
      NEXT_PUBLIC_COMPANY: "KeyFate",
      NEXT_PUBLIC_PARENT_COMPANY: "Aviat, LLC",
      // Google OAuth test configuration
      GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      NEXTAUTH_SECRET: "test-nextauth-secret-32-chars-l",
      NEXTAUTH_URL: "http://localhost:3000",
      // Database configuration for tests
      DATABASE_URL:
        "postgresql://postgres:test_password@localhost:5432/test_db",
      ENCRYPTION_KEY: "test_encryption_key_32_bytes_long_for_testing",
      // Email service configuration for tests
      EMAIL_PROVIDER: "mock",
      SENDGRID_API_KEY: "test-sendgrid-api-key",
      SENDGRID_ADMIN_EMAIL: "admin-test@keyfate.com",
    },
    include: [
      "src/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
    ],
    // Suppress React act() warnings and API error logs in tests
    onConsoleLog(log, type) {
      // Suppress all React act() warnings
      if (
        log.includes("Warning: An update to") ||
        log.includes("inside a test was not wrapped in act") ||
        log.includes(
          "The current testing environment is not configured to support act",
        )
      ) {
        return false;
      }
      // Suppress expected API error logs during testing
      if (
        type === "stderr" &&
        (log.includes("[POST /api/secrets") ||
          log.includes("[CreateSecret") ||
          log.includes("Error:") ||
          log.includes("SyntaxError:"))
      ) {
        return false;
      }
    },
  },
});
