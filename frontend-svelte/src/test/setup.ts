/**
 * Global test setup for SvelteKit Vitest tests
 *
 * Ported from frontend/__tests__/setup.ts
 * Adapted for SvelteKit: no Next.js router/auth mocks needed.
 */
import "@testing-library/jest-dom/vitest"
import { vi, beforeEach } from "vitest"

// Mock SvelteKit's $env modules (used by server-env.ts, env.ts, etc.)
vi.mock("$env/dynamic/private", () => ({
  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev",
    ENCRYPTION_KEY:
      process.env.ENCRYPTION_KEY ||
      Buffer.from("test-encryption-key-32-bytes-long").toString("base64"),
    AUTH_SECRET: "test-auth-secret-32-chars-long",
    GOOGLE_CLIENT_ID: "test-google-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    STRIPE_SECRET_KEY: "sk_test_fake",
    STRIPE_WEBHOOK_SECRET: "whsec_test_fake",
    BTCPAY_SERVER_URL: "https://btcpay.test.local",
    BTCPAY_API_KEY: "test-btcpay-api-key",
    BTCPAY_STORE_ID: "test-btcpay-store-id",
    BTCPAY_WEBHOOK_SECRET: "test-btcpay-webhook-secret",
    CRON_SECRET: "test-cron-secret",
    SENDGRID_API_KEY: "SG.test-key",
    NODE_ENV: "test",
  },
}))

vi.mock("$env/dynamic/public", () => ({
  env: {
    PUBLIC_SITE_URL: "http://localhost:5173",
    PUBLIC_SUPPORT_EMAIL: "support@keyfate.com",
    PUBLIC_COMPANY: "KeyFate",
    PUBLIC_PARENT_COMPANY: "KeyFate Inc.",
    PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_fake",
  },
}))

vi.mock("$env/static/private", () => ({
  DATABASE_URL:
    "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev",
  ENCRYPTION_KEY: Buffer.from("test-encryption-key-32-bytes-long").toString(
    "base64",
  ),
  AUTH_SECRET: "test-auth-secret-32-chars-long",
  CRON_SECRET: "test-cron-secret",
}))

vi.mock("$env/static/public", () => ({
  PUBLIC_SITE_URL: "http://localhost:5173",
  PUBLIC_SUPPORT_EMAIL: "support@keyfate.com",
}))

// Mock $lib/request-context to avoid AsyncLocalStorage issues in tests
vi.mock("$lib/request-context", () => ({
  getRequestContext: vi.fn(() => undefined),
  getRequestId: vi.fn(() => undefined),
  getJobName: vi.fn(() => undefined),
  getUserId: vi.fn(() => undefined),
  withRequestContext: vi.fn(
    (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
  ),
}))

// Mock environment variables for modules that use process.env directly
vi.stubEnv(
  "DATABASE_URL",
  process.env.DATABASE_URL ||
    "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev",
)
vi.stubEnv("NODE_ENV", "test")
vi.stubEnv(
  "ENCRYPTION_KEY",
  Buffer.from("test-encryption-key-32-bytes-long").toString("base64"),
)

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Provide a default fetch mock to avoid hanging tests
if (!global.fetch) {
  ;(global as any).fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
    text: async () => '{"success":true}',
  }))
}

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
