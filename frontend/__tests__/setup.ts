import "@testing-library/jest-dom"
import { vi, beforeEach } from "vitest"

// Configure React Testing Library for React 18
import { configure } from "@testing-library/react"

configure({
  // React 18 automatic batching configuration
  reactStrictMode: true,
  // Suppress act() warnings
  getElementError: (message, container) => {
    return new Error([message, "", "Ignored in test environment"].join("\n"))
  },
})

// Mock Next.js router with resettable mocks used by many suites
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}
const mockUseRouter = vi.fn(() => mockRouter)
const mockUseSearchParams = vi.fn(() => new URLSearchParams())
// Some suites call `.clear()` on the mocked function – provide shim
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(mockUseSearchParams as any).clear = () => {
  mockUseSearchParams.mockReset()
}

vi.mock("next/navigation", () => ({
  useRouter: mockUseRouter,
  useSearchParams: mockUseSearchParams,
  usePathname: vi.fn(() => "/"),
}))

// Mock NextAuth
vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}))
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    status: "unauthenticated",
    data: null,
    update: vi.fn(),
  })),
  signIn: vi.fn(async () => ({ ok: true, status: 200 })),
  signOut: vi.fn(async () => ({ ok: true })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({
    id: "google",
    name: "Google",
    type: "oauth",
  })),
}))

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((opts?: any) => ({
    id: "credentials",
    name: "credentials",
    type: "credentials",
    authorize: opts?.authorize ?? (async () => null),
    credentials: opts?.credentials ?? {},
  })),
}))

// Mock Drizzle database
vi.mock("@/lib/db/drizzle", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({
      into: vi.fn().mockReturnThis(),
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn(() => Promise.resolve([])),
    })),
    delete: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn(() => Promise.resolve([])),
    })),
    execute: vi.fn(() => Promise.resolve({ rows: [] })),
  },
  secretsService: {
    create: vi.fn(async (data) => ({ id: "test-secret-id", ...data })),
    update: vi.fn(async (id, data) => ({ id, ...data })),
    delete: vi.fn(async () => true),
  },
}))

// Mock auth configuration
vi.mock("@/lib/auth/config", () => ({
  authOptions: {
    providers: [],
    session: { strategy: "jwt" },
    callbacks: {},
  },
}))

// Mock environment variables for NextAuth + Drizzle
// Use the same DATABASE_URL as db:studio for test compatibility
vi.stubEnv(
  "DATABASE_URL",
  process.env.DATABASE_URL ||
    "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev",
)
vi.stubEnv("NEXTAUTH_SECRET", "test-nextauth-secret-32-chars-long")
vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000")
vi.stubEnv(
  "GOOGLE_CLIENT_ID",
  "test-google-client-id.apps.googleusercontent.com",
)
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
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

// Mock crypto for Node.js environment
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => "test-uuid",
    getRandomValues: (arr: any) => arr.fill(0),
  },
})

// Export mock helpers for test infrastructure validation
export const mockNextAuth = {
  getServerSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}

// Make sure no Supabase mocks exist
export const mockSupabase = undefined

// Provide a default fetch mock to avoid hanging tests
if (!global.fetch) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).fetch = vi.fn(async () => ({
    json: async () => ({ success: true }),
  }))
}

// Suites can mock `@/hooks/use-toast` themselves as needed

// Polyfill URLSearchParams.clear used by some tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(URLSearchParams.prototype as any).clear = function () {
  for (const key of Array.from(this.keys())) {
    this.delete(key)
  }
}

// Reset database connection manager circuit breaker before each test
beforeEach(async () => {
  try {
    const { default: ConnectionManager } = await import(
      "@/lib/db/connection-manager"
    )
    const manager = ConnectionManager.getInstance()
    manager.reset()
  } catch (error) {
    // Connection manager might not be imported in all tests
  }
})
