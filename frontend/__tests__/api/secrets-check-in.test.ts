import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSupabaseClient } from "./setup";

// Import setup to apply mocks
import "./setup";

import { POST } from "@/app/api/secrets/[id]/check-in/route";

describe("/api/secrets/[id]/check-in", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  };

  const mockSecret = {
    id: "secret-123",
    user_id: "user-123",
    title: "Test Secret",
    check_in_days: 30,
    status: "active",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset Supabase mocks
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  it("should check in successfully", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockSecret,
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    });

    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    const mockRequest = new NextRequest(
      "http://localhost/api/secrets/secret-123/check-in",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.secret).toEqual(mockSecret);
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("check_in_secret", {
      p_secret_id: "secret-123",
      p_user_id: mockUser.id,
      p_checked_in_at: expect.any(String),
      p_next_check_in: expect.any(String),
    });
  });

  it("should return 401 when user is not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const mockRequest = new NextRequest(
      "http://localhost/api/secrets/secret-123/check-in",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 404 when secret is not found", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Secret not found"),
    });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    });

    const mockRequest = new NextRequest(
      "http://localhost/api/secrets/secret-123/check-in",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Secret not found");
  });

  it("should return 500 when check-in transaction fails", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockSecret,
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    });

    const transactionError = new Error("Transaction failed");
    mockSupabaseClient.rpc.mockResolvedValue({
      error: transactionError,
    });

    const mockRequest = new NextRequest(
      "http://localhost/api/secrets/secret-123/check-in",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to record check-in: Transaction failed");
  });

  it("should return 500 when fetching updated secret fails", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn()
      .mockResolvedValueOnce({
        data: mockSecret,
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: new Error("Fetch failed"),
      });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    });

    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    const mockRequest = new NextRequest(
      "http://localhost/api/secrets/secret-123/check-in",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch updated secret");
  });

  it("should handle unexpected errors gracefully", async () => {
    const unexpectedError = new Error("Unexpected error");
    mockSupabaseClient.auth.getUser.mockRejectedValue(unexpectedError);

    const mockRequest = new NextRequest(
      "http://localhost/api/secrets/secret-123/check-in",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Unexpected error");
  });
});
