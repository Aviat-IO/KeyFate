import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSupabaseClient } from "./setup";

// Import setup to apply mocks
import "./setup";

import { POST } from "@/app/api/secrets/[id]/toggle-pause/route";

describe("/api/secrets/[id]/toggle-pause", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  };

  const mockActiveSecret = {
    id: "secret-123",
    user_id: "user-123",
    title: "Test Secret",
    check_in_days: 30,
    status: "active",
  };

  const mockPausedSecret = {
    id: "secret-123",
    user_id: "user-123",
    title: "Test Secret",
    check_in_days: 30,
    status: "paused",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset Supabase mocks
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  it("should pause an active secret successfully", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn()
      .mockResolvedValueOnce({
        data: mockActiveSecret,
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...mockActiveSecret, status: "paused" },
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

    const mockRequest = new Request(
      "http://localhost/api/secrets/secret-123/toggle-pause",
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
    expect(data.secret.status).toBe("paused");
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("toggle_secret_pause", {
      p_secret_id: "secret-123",
      p_user_id: mockUser.id,
      p_new_status: "paused",
      p_checked_in_at: expect.any(String),
      p_next_check_in: expect.any(String),
    });
  });

  it("should resume a paused secret successfully", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn()
      .mockResolvedValueOnce({
        data: mockPausedSecret,
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...mockPausedSecret, status: "active" },
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

    const mockRequest = new Request(
      "http://localhost/api/secrets/secret-123/toggle-pause",
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
    expect(data.secret.status).toBe("active");
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("toggle_secret_pause", {
      p_secret_id: "secret-123",
      p_user_id: mockUser.id,
      p_new_status: "active",
      p_checked_in_at: expect.any(String),
      p_next_check_in: expect.any(String),
    });
  });

  it("should return 401 when user is not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const mockRequest = new Request(
      "http://localhost/api/secrets/secret-123/toggle-pause",
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

    const mockRequest = new Request(
      "http://localhost/api/secrets/secret-123/toggle-pause",
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

  it("should return 500 when toggle operation fails", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockActiveSecret,
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

    mockSupabaseClient.rpc.mockResolvedValue({
      error: new Error("Toggle operation failed"),
    });

    const mockRequest = new Request(
      "http://localhost/api/secrets/secret-123/toggle-pause",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update secret");
  });

  it("should return 500 when fetching updated secret fails", async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn()
      .mockResolvedValueOnce({
        data: mockActiveSecret,
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

    const mockRequest = new Request(
      "http://localhost/api/secrets/secret-123/toggle-pause",
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
    mockSupabaseClient.auth.getUser.mockRejectedValue(
      new Error("Unexpected error"),
    );

    const mockRequest = new Request(
      "http://localhost/api/secrets/secret-123/toggle-pause",
      {
        method: "POST",
      },
    );

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: "secret-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal Server Error");
  });
});
