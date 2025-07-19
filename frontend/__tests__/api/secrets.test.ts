import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSupabaseClient } from "./setup";

// Import setup to apply mocks
import "./setup";

// Set environment variables before importing the route
process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com";

import { POST } from "@/app/api/secrets/route";

describe("/api/secrets", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  };

  const validSecretData = {
    title: "Test Secret",
    server_share: "encrypted-server-share",
    iv: "base64-iv",
    auth_tag: "base64-auth-tag",
    recipient_name: "John Doe",
    recipient_email: "john@example.com",
    recipient_phone: "+1234567890",
    contact_method: "email",
    check_in_days: "30",
    sss_shares_total: 3,
    sss_threshold: 2,
  };

  // Helper function to create complete Supabase mock
  const createMockSupabaseChain = (overrides = {}) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    // Reset Supabase mocks
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe("POST /api/secrets", () => {
    it("should create a secret successfully", async () => {
      const mockSecretId = "secret-123";

      // Mock successful database operations
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: mockSecretId },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue(createMockSupabaseChain({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      }));

      mockSupabaseClient.rpc.mockResolvedValue({ error: null });

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.secretId).toBe(mockSecretId);
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: mockUser.id,
          title: validSecretData.title,
          server_share: validSecretData.server_share,
          recipient_name: validSecretData.recipient_name,
          recipient_email: validSecretData.recipient_email,
          contact_method: validSecretData.contact_method,
          check_in_days: 30,
          status: "active",
          sss_shares_total: 3,
          sss_threshold: 2,
        }),
      ]);
    });

    it("should return 401 when user is not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 when server_share is missing", async () => {
      const invalidData = { ...validSecretData, server_share: undefined };

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Missing encrypted server share, IV, or auth tag.",
      );
    });

    it("should return 400 when iv is missing", async () => {
      const invalidData = { ...validSecretData, iv: undefined };

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Missing encrypted server share, IV, or auth tag.",
      );
    });

    it("should return 400 when auth_tag is missing", async () => {
      const invalidData = { ...validSecretData, auth_tag: undefined };

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Missing encrypted server share, IV, or auth tag.",
      );
    });

    it("should return 400 when SSS parameters are invalid", async () => {
      const invalidData = {
        ...validSecretData,
        sss_shares_total: 1,
        sss_threshold: 1,
      };

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Invalid SSS shares total or threshold parameters.",
      );
    });

    it("should return 400 when threshold exceeds total shares", async () => {
      const invalidData = {
        ...validSecretData,
        sss_shares_total: 2,
        sss_threshold: 3,
      };

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Invalid SSS shares total or threshold parameters.",
      );
    });

    it("should return 400 when check_in_days is invalid", async () => {
      const invalidData = { ...validSecretData, check_in_days: "invalid" };

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Check-in days is required.");
    });

    it("should return 500 when database insert fails", async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Database error"),
      });

      mockSupabaseClient.from.mockReturnValue(createMockSupabaseChain({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      }));

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Database error");
    });

    it("should handle reminder scheduling failure gracefully", async () => {
      const mockSecretId = "secret-123";

      // Mock successful insert but failed reminder scheduling
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: mockSecretId },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue(createMockSupabaseChain({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      }));

      mockSupabaseClient.rpc.mockResolvedValue({
        error: new Error("Reminder scheduling failed"),
      });

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.secretId).toBe(mockSecretId);
      expect(data.warning).toContain("reminder scheduling failed");
    });

    it("should handle contact method 'both' correctly", async () => {
      const mockSecretId = "secret-123";
      const dataWithBothContact = {
        ...validSecretData,
        contact_method: "both",
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: mockSecretId },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue(createMockSupabaseChain({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      }));

      mockSupabaseClient.rpc.mockResolvedValue({ error: null });

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataWithBothContact),
      });

      await POST(mockRequest);

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          recipient_email: validSecretData.recipient_email,
          recipient_phone: validSecretData.recipient_phone,
          contact_method: "both",
        }),
      ]);
    });

    it("should handle contact method 'phone' correctly", async () => {
      const mockSecretId = "secret-123";
      const dataWithPhoneContact = {
        ...validSecretData,
        contact_method: "phone",
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: mockSecretId },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue(createMockSupabaseChain({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      }));

      mockSupabaseClient.rpc.mockResolvedValue({ error: null });

      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataWithPhoneContact),
      });

      await POST(mockRequest);

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          recipient_email: null,
          recipient_phone: validSecretData.recipient_phone,
          contact_method: "phone",
        }),
      ]);
    });

    it("should handle invalid JSON request", async () => {
      const mockRequest = new Request("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to create secret");
    });
  });
});
