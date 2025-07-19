import {
  type AuthTokens,
  clearTokensFromUrl,
  completeAuthFlow,
  establishSessionFromTokens,
  hasAuthTokensInUrl,
  parseTokensFromHash,
} from "@/lib/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase client
const mockSetSession = vi.fn();
const mockSupabaseClient = {
  auth: {
    setSession: mockSetSession,
  },
};

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => mockSupabaseClient,
}));

// Mock window.history
const mockReplaceState = vi.fn();
Object.defineProperty(window, "history", {
  value: {
    replaceState: mockReplaceState,
  },
  writable: true,
});

describe("Auth Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseTokensFromHash", () => {
    it("should parse valid tokens from hash", () => {
      const hash =
        "#access_token=test-access&refresh_token=test-refresh&expires_at=123&type=recovery";
      const result = parseTokensFromHash(hash);

      expect(result).toEqual({
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_at: "123",
        expires_in: undefined,
        token_type: undefined,
        type: "recovery",
      });
    });

    it("should return null for empty hash", () => {
      const result = parseTokensFromHash("");
      expect(result).toBeNull();
    });

    it("should return null for hash without access_token", () => {
      const result = parseTokensFromHash("#refresh_token=test-refresh");
      expect(result).toBeNull();
    });

    it("should return null for hash missing refresh_token", () => {
      const result = parseTokensFromHash("#access_token=test-access");
      expect(result).toBeNull();
    });

    it("should handle hash with only required tokens", () => {
      const hash = "#access_token=test-access&refresh_token=test-refresh";
      const result = parseTokensFromHash(hash);

      expect(result).toEqual({
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_at: undefined,
        expires_in: undefined,
        token_type: undefined,
        type: undefined,
      });
    });

    it("should handle malformed hash gracefully", () => {
      const result = parseTokensFromHash("invalid-hash");
      expect(result).toBeNull();
    });

    it("should handle hash with special characters", () => {
      const hash = "#access_token=test%20access&refresh_token=test%20refresh";
      const result = parseTokensFromHash(hash);

      expect(result).toEqual({
        access_token: "test access",
        refresh_token: "test refresh",
        expires_at: undefined,
        expires_in: undefined,
        token_type: undefined,
        type: undefined,
      });
    });
  });

  describe("establishSessionFromTokens", () => {
    it("should establish session successfully", async () => {
      const tokens: AuthTokens = {
        access_token: "test-access",
        refresh_token: "test-refresh",
      };

      const mockSessionData = { user: { id: "user-123" } };
      mockSetSession.mockResolvedValue({
        data: mockSessionData,
        error: null,
      });

      const result = await establishSessionFromTokens(tokens);

      expect(result.data).toEqual(mockSessionData);
      expect(result.error).toBeNull();
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: "test-access",
        refresh_token: "test-refresh",
      });
    });

    it("should handle session establishment error", async () => {
      const tokens: AuthTokens = {
        access_token: "test-access",
        refresh_token: "test-refresh",
      };

      const mockError = new Error("Session error");
      mockSetSession.mockResolvedValue({
        data: null,
        error: mockError,
      });

      const result = await establishSessionFromTokens(tokens);

      expect(result.data).toBeNull();
      expect(result.error).toBe(mockError);
    });

    it("should handle unexpected errors", async () => {
      const tokens: AuthTokens = {
        access_token: "test-access",
        refresh_token: "test-refresh",
      };

      mockSetSession.mockRejectedValue(new Error("Unexpected error"));

      const result = await establishSessionFromTokens(tokens);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe("clearTokensFromUrl", () => {
    it("should clear tokens from URL", () => {
      // Mock window.location
      Object.defineProperty(window, "location", {
        value: {
          pathname: "/auth/verify",
        },
        writable: true,
      });

      clearTokensFromUrl();

      expect(mockReplaceState).toHaveBeenCalledWith(
        null,
        "",
        "/auth/verify",
      );
    });

    it("should handle server-side rendering", () => {
      // Mock window as undefined (SSR)
      const originalWindow = global.window;
      delete (global as any).window;

      // Should not throw
      expect(() => clearTokensFromUrl()).not.toThrow();

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("completeAuthFlow", () => {
    it("should complete auth flow successfully", async () => {
      const hash = "#access_token=test-access&refresh_token=test-refresh";
      const mockSessionData = { user: { id: "user-123" } };

      mockSetSession.mockResolvedValue({
        data: mockSessionData,
        error: null,
      });

      const result = await completeAuthFlow(hash);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSessionData);
      expect(result.error).toBeUndefined();
      expect(mockReplaceState).toHaveBeenCalled();
    });

    it("should handle invalid hash", async () => {
      const result = await completeAuthFlow("invalid-hash");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid authentication link");
      expect(result.data).toBeUndefined();
    });

    it("should handle session establishment failure", async () => {
      const hash = "#access_token=test-access&refresh_token=test-refresh";

      mockSetSession.mockResolvedValue({
        data: null,
        error: new Error("Session error"),
      });

      const result = await completeAuthFlow(hash);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to establish session");
      expect(result.data).toBeUndefined();
    });

    it("should handle missing tokens in hash", async () => {
      const hash = "#access_token=test-access"; // Missing refresh_token

      const result = await completeAuthFlow(hash);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid authentication link");
    });
  });

  describe("hasAuthTokensInUrl", () => {
    it("should return true when tokens are present", () => {
      Object.defineProperty(window, "location", {
        value: {
          hash: "#access_token=test-access&refresh_token=test-refresh",
        },
        writable: true,
      });

      expect(hasAuthTokensInUrl()).toBe(true);
    });

    it("should return false when tokens are not present", () => {
      Object.defineProperty(window, "location", {
        value: {
          hash: "#other=value",
        },
        writable: true,
      });

      expect(hasAuthTokensInUrl()).toBe(false);
    });

    it("should return false when no hash is present", () => {
      Object.defineProperty(window, "location", {
        value: {
          hash: "",
        },
        writable: true,
      });

      expect(hasAuthTokensInUrl()).toBe(false);
    });

    it("should handle server-side rendering", () => {
      // Mock window as undefined (SSR)
      const originalWindow = global.window;
      delete (global as any).window;

      expect(hasAuthTokensInUrl()).toBe(false);

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("integration scenarios", () => {
    it("should handle real-world Supabase auth hash", async () => {
      const realWorldHash =
        "#access_token=eyJhbGciOiJIUzI1NiIsImtpZCI6IkIwY2RlZjMyQnNjRHFkOWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2t2dXR5c3ZxbnF2Y3FqaGR1cXBkLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0MTYwOWEyYy01YmE5LTQ5MDgtYTk5Yy1jNDU5MGQ2ODRkOWYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzUyOTUwMTM3LCJpYXQiOjE3NTI5NDY1MzcsImVtYWlsIjoiYWxhbisyQGF2aWF0LmlvIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImFsYW4rMkBhdmlhdC5pbyIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjQxNjA5YTJjLTViYTktNDkwOC1hOTljLWM0NTkwZDY4NGQ5ZiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6Im90cCIsInRpbWVzdGFtcCI6MTc1Mjk0NjUzN31dLCJzZXNzaW9uX2lkIjoiYWI3NzA5M2ItYmM2Yi00YzExLTllZjQtZGEwZjEzYTcyYThmIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.VM4rErP7fZGMbsMzL78E0so5wDth8u9HdrC1es1HnNc&expires_at=1752950137&expires_in=3600&refresh_token=tnmugavhdrh3&token_type=bearer&type=recovery";

      const tokens = parseTokensFromHash(realWorldHash);
      expect(tokens).not.toBeNull();
      expect(tokens?.access_token).toContain("eyJhbGciOiJIUzI1NiI");
      expect(tokens?.refresh_token).toBe("tnmugavhdrh3");
      expect(tokens?.type).toBe("recovery");
      expect(tokens?.expires_at).toBe("1752950137");
      expect(tokens?.expires_in).toBe("3600");
      expect(tokens?.token_type).toBe("bearer");
    });

    it("should handle complete auth flow with real hash", async () => {
      const realWorldHash =
        "#access_token=test-access&refresh_token=test-refresh&type=recovery";
      const mockSessionData = { user: { id: "user-123" } };

      mockSetSession.mockResolvedValue({
        data: mockSessionData,
        error: null,
      });

      const result = await completeAuthFlow(realWorldHash);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSessionData);
      expect(mockReplaceState).toHaveBeenCalled();
    });
  });
});
