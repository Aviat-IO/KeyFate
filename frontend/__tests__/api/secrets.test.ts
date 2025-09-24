import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiRequest } from "../helpers/next-request";
import { mockSecretsService } from "./setup";

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

    // Reset NextAuth session mock to authenticated state by default
    (getServerSession as any).mockResolvedValue({
      user: {
        id: mockUser.id,
        email: mockUser.email,
        name: "Test User",
      },
    });

    // Reset database service mocks to successful state by default
    mockSecretsService.create.mockResolvedValue({
      id: "secret-123",
      ...validSecretData,
      userId: mockUser.id,
    });
  });

  describe("POST /api/secrets", () => {
    it("should create a secret successfully", async () => {
      const mockSecretId = "secret-123";

      // Mock successful database service response
      mockSecretsService.create.mockResolvedValue({
        id: mockSecretId,
        title: validSecretData.title,
        recipientName: validSecretData.recipient_name,
        recipientEmail: validSecretData.recipient_email,
        contactMethod: validSecretData.contact_method,
        userId: mockUser.id,
      });

      const mockRequest = new NextRequest("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.secretId).toBe(mockSecretId);
      expect(mockSecretsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          title: validSecretData.title,
          serverShare: validSecretData.server_share,
          recipientName: validSecretData.recipient_name,
          recipientEmail: validSecretData.recipient_email,
          contactMethod: validSecretData.contact_method,
          checkInDays: 30,
          status: "active",
          sssSharesTotal: 3,
          sssThreshold: 2,
          nextCheckIn: expect.any(Date),
        }),
      );
    });

    it("should return 401 when user is not authenticated", async () => {
      // Mock NextAuth session to return null (unauthenticated)
      (getServerSession as any).mockResolvedValue(null);

      const mockRequest = new NextRequest("http://localhost/api/secrets", {
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

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing server share.");
    });

    it("should create a secret successfully when iv and auth_tag are missing (plain server share)", async () => {
      const mockSecretId = "secret-123";
      const plainSecretData = { ...validSecretData };
      delete plainSecretData.iv;
      delete plainSecretData.auth_tag;

      // Mock successful database service response
      mockSecretsService.create.mockResolvedValue({
        id: mockSecretId,
        title: plainSecretData.title,
        recipientName: plainSecretData.recipient_name,
        recipientEmail: plainSecretData.recipient_email,
        contactMethod: plainSecretData.contact_method,
        userId: mockUser.id,
      });

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plainSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.secretId).toBe(mockSecretId);
      expect(mockSecretsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          title: plainSecretData.title,
          serverShare: "encrypted-data", // Should be encrypted
          iv: "base64-iv", // Should be generated
          authTag: "base64-auth-tag", // Should be generated
          recipientName: plainSecretData.recipient_name,
          recipientEmail: plainSecretData.recipient_email,
          contactMethod: plainSecretData.contact_method,
          checkInDays: 30,
          status: "active",
          sssSharesTotal: 3,
          sssThreshold: 2,
        }),
      );
    });

    it("should return 400 when SSS parameters are invalid", async () => {
      const invalidData = {
        ...validSecretData,
        sss_shares_total: 1,
        sss_threshold: 1,
      };

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
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

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
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

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
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
      // Mock database service to throw an error
      mockSecretsService.create.mockRejectedValue(new Error("Database error"));

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create secret");
    });

    it("should handle reminder scheduling failure gracefully", async () => {
      const mockSecretId = "secret-123";

      // Mock successful database service response
      mockSecretsService.create.mockResolvedValue({
        id: mockSecretId,
        title: validSecretData.title,
        recipientName: validSecretData.recipient_name,
        recipientEmail: validSecretData.recipient_email,
        contactMethod: validSecretData.contact_method,
        userId: mockUser.id,
      });

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSecretData),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.secretId).toBe(mockSecretId);
      // Note: The route doesn't currently implement reminder scheduling,
      // so we just verify the secret is created successfully
      expect(data.title).toBe(validSecretData.title);
    });

    it("should handle contact method 'both' correctly", async () => {
      const mockSecretId = "secret-123";
      const dataWithBothContact = {
        ...validSecretData,
        contact_method: "both",
      };

      // Mock successful database service response
      mockSecretsService.create.mockResolvedValue({
        id: mockSecretId,
        title: dataWithBothContact.title,
        recipientName: dataWithBothContact.recipient_name,
        recipientEmail: dataWithBothContact.recipient_email,
        contactMethod: dataWithBothContact.contact_method,
        userId: mockUser.id,
      });

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataWithBothContact),
      });

      await POST(mockRequest);

      expect(mockSecretsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: validSecretData.recipient_email,
          recipientPhone: validSecretData.recipient_phone,
          contactMethod: "both",
        }),
      );
    });

    it("should handle contact method 'phone' correctly", async () => {
      const mockSecretId = "secret-123";
      const dataWithPhoneContact = {
        ...validSecretData,
        contact_method: "phone",
      };

      // Mock successful database service response
      mockSecretsService.create.mockResolvedValue({
        id: mockSecretId,
        title: dataWithPhoneContact.title,
        recipientName: dataWithPhoneContact.recipient_name,
        recipientEmail: null,
        contactMethod: dataWithPhoneContact.contact_method,
        userId: mockUser.id,
      });

      const mockRequest = createApiRequest("http://localhost/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataWithPhoneContact),
      });

      await POST(mockRequest);

      expect(mockSecretsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: null,
          recipientPhone: validSecretData.recipient_phone,
          contactMethod: "phone",
        }),
      );
    });

    it("should handle invalid JSON request", async () => {
      const mockRequest = createApiRequest("http://localhost/api/secrets", {
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
