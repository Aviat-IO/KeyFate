import { vi } from "vitest";

// Mock Next.js server components
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
      headers: new Map(),
    })),
  },
}));

// Mock Supabase auth helpers
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
  rpc: vi.fn(),
};

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Set up environment variables before any imports
process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.ENCRYPTION_KEY = "a".repeat(32); // 32 character key

// Mock environment variables
vi.mock("@/lib/env", () => ({
  NEXT_PUBLIC_SITE_URL: "https://test.example.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
}));

vi.mock("@/lib/server-env", () => ({
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
}));

// Mock encryption functions
vi.mock("@/lib/encryption", () => ({
  encryptMessage: vi.fn(),
  decryptMessage: vi.fn(),
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

export { mockSupabaseClient };
