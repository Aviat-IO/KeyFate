import { vi } from "vitest";

// Mock Next.js server components
const mockCookieStore = {
  getAll: vi.fn(() => []),
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
      headers: new Map(),
    })),
  },
  NextRequest: class MockNextRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, init);
    }
    get cookies() {
      return {
        getAll: vi.fn(() => []),
        set: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      };
    }
    get nextUrl() {
      return new URL(this.url);
    }
  },
}));

// Set up environment variables before any imports
process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com";
process.env.ENCRYPTION_KEY = "a".repeat(32); // 32 character key

// Mock environment variables
vi.mock("@/lib/env", () => ({
  NEXT_PUBLIC_SITE_URL: "https://test.example.com",
}));

vi.mock("@/lib/server-env", () => ({}));

// Mock Node.js crypto module
const mockCrypto = {
  randomBytes: vi.fn(() =>
    Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  ),
  createCipheriv: vi.fn(() => ({
    update: vi.fn(() => Buffer.from([1, 2, 3, 4])),
    final: vi.fn(() => Buffer.from([5, 6, 7, 8])),
    getAuthTag: vi.fn(() => Buffer.from([9, 10, 11, 12, 13, 14, 15, 16])),
  })),
  createDecipheriv: vi.fn(() => ({
    update: vi.fn(() => Buffer.from([1, 2, 3, 4])),
    final: vi.fn(() => Buffer.from([5, 6, 7, 8])),
    setAuthTag: vi.fn(),
  })),
};

vi.mock("crypto", () => ({
  default: mockCrypto,
  ...mockCrypto,
}));

// Mock encryption functions with expected return values
vi.mock("@/lib/encryption", () => ({
  encryptMessage: vi.fn(() =>
    Promise.resolve({
      encrypted: "encrypted-data",
      iv: "base64-iv",
      authTag: "base64-auth-tag",
    })
  ),
  decryptMessage: vi.fn(() => Promise.resolve("decrypted message")),
}));

// Mock NextAuth getServerSession
const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
  },
};

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}));

// Mock database services
const mockSecretsService = {
  create: vi.fn(),
};

const mockRobustSecretsService = {
  create: vi.fn(),
};

vi.mock("@/lib/db/drizzle", () => ({
  secretsService: mockSecretsService,
}));

vi.mock("@/lib/db/secrets-service-robust", () => ({
  RobustSecretsService: vi.fn(() => mockRobustSecretsService),
}));

// Mock crypto for encrypt/decrypt routes
Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      importKey: vi.fn(() => Promise.resolve({})),
      encrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(16))),
      decrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(16))),
    },
  },
});

// Mock btoa/atob for base64 encoding
global.btoa = vi.fn((str) => Buffer.from(str, "binary").toString("base64"));
global.atob = vi.fn((str) => Buffer.from(str, "base64").toString("binary"));

// Mock TextEncoder/TextDecoder
Object.defineProperty(global, "TextEncoder", {
  value: class MockTextEncoder {
    encode(str: string) {
      return new Uint8Array(Buffer.from(str, "utf8"));
    }
  },
});

Object.defineProperty(global, "TextDecoder", {
  value: class MockTextDecoder {
    decode(buffer: ArrayBuffer) {
      return Buffer.from(buffer).toString("utf8");
    }
  },
});

export {
  mockCookieStore,
  mockCrypto,
  mockRobustSecretsService,
  mockSecretsService,
  mockSession,
};
