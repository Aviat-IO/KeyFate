/**
 * Test data factory functions for consistent mock data generation
 */
import { vi } from "vitest";

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  emailVerified: Date | null;
  image: string | null;
}> = {}) {
  return {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    emailVerified: null,
    image: null,
    ...overrides,
  };
}

/**
 * Create a mock secret for testing
 */
export function createMockSecret(overrides: Partial<{
  id: string;
  userId: string;
  title: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  contactMethod: "email" | "phone" | "both";
  checkInDays: number;
  lastCheckIn: Date | null;
  nextCheckIn: Date | null;
  status: "active" | "paused" | "triggered";
  isTriggered: boolean;
  serverShare: string | null;
  sssSharesTotal: number;
  sssThreshold: number;
}> = {}) {
  return {
    id: "secret-123",
    userId: "user-123",
    title: "My Important Secret",
    recipientName: "John Doe",
    recipientEmail: "recipient@example.com",
    recipientPhone: null,
    contactMethod: "email" as const,
    checkInDays: 30,
    lastCheckIn: new Date(),
    nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "active" as const,
    isTriggered: false,
    serverShare: "mock-server-share-data",
    sssSharesTotal: 3,
    sssThreshold: 2,
    iv: null,
    authTag: null,
    triggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock session for testing
 */
export function createMockSession(overrides: Partial<{
  user: { id: string; email: string; name?: string };
  expires: string;
}> = {}) {
  return {
    user: {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      ...overrides.user,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock NextAuth session response
 */
export function createMockAuthResponse(overrides: {
  status?: "authenticated" | "unauthenticated" | "loading";
  data?: any;
} = {}) {
  return {
    status: overrides.status || "authenticated",
    data: overrides.data || createMockSession(),
    update: vi.fn(),
  };
}

/**
 * Create a mock Drizzle query result
 */
export function createMockQueryResult<T>(data: T[]) {
  return {
    rows: data,
    rowCount: data.length,
  };
}

/**
 * Create a mock API response
 */
export function createMockApiResponse<T>(data: T, overrides: {
  status?: number;
  ok?: boolean;
  statusText?: string;
} = {}) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.statusText ?? "OK",
    json: async () => data,
    text: async () => JSON.stringify(data),
    ...overrides,
  };
}

/**
 * Create a mock API error response
 */
export function createMockApiError(message: string, status: number = 500) {
  return createMockApiResponse(
    { error: message },
    { status, ok: false, statusText: message }
  );
}

/**
 * Create a mock toast function
 */
export function createMockToast() {
  return {
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  };
}

/**
 * Create a mock router
 */
export function createMockRouter(overrides: Partial<{
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
  pathname: string;
  query: Record<string, string>;
}> = {}) {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    pathname: "/",
    query: {},
    ...overrides,
  };
}

/**
 * Create a mock fetch response
 */
export function createMockFetch(defaultResponse: any = { success: true }) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    return createMockApiResponse(defaultResponse);
  });
}

/**
 * Helper to create multiple mock secrets
 */
export function createMockSecrets(count: number, baseOverrides: Parameters<typeof createMockSecret>[0] = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMockSecret({
      ...baseOverrides,
      id: `secret-${i + 1}`,
      title: `${baseOverrides.title || "Secret"} ${i + 1}`,
    })
  );
}
