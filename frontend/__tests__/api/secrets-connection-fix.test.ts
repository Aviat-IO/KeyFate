import { describe, expect, it, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/secrets/route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";

// Mock NextAuth
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// Mock Drizzle database service
vi.mock("@/lib/db/drizzle", () => ({
  secretsService: {
    create: vi.fn(),
  },
}));

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  encryptMessage: vi.fn().mockResolvedValue({
    encrypted: "mock-encrypted-data",
    iv: "mock-iv",
    authTag: "mock-auth-tag",
  }),
}));

// Environment variables are now properly configured for direct database access

describe("POST /api/secrets - Connection Fix", () => {
  let mockSecretsService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import the mocked module
    const drizzleMock = await import("@/lib/db/drizzle");
    mockSecretsService = drizzleMock.secretsService;

    // Mock successful authentication
    (getServerSession as any).mockResolvedValue({
      user: {
        id: "test-user-id",
        email: "test@example.com",
      },
    });

    // Mock successful database creation
    mockSecretsService.create.mockResolvedValue({
      id: "test-secret-id",
      title: "Test Secret",
      userId: "test-user-id",
    });
  });

  it("should successfully create a secret with proper environment configuration", async () => {
    const requestBody = {
      title: "Test Secret",
      server_share: "encrypted-data",
      contact_method: "email",
      recipient_name: "Test Recipient",
      recipient_email: "recipient@example.com",
      check_in_days: 30,
      sss_shares_total: 3,
      sss_threshold: 2,
    };

    const request = new NextRequest("http://localhost:3000/api/secrets", {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const responseData = await response.json();

    if (response.status !== 200) {
      console.log("Response status:", response.status);
      console.log("Response data:", responseData);
    }

    expect(response.status).toBe(200);
    expect(responseData.secretId).toBe("test-secret-id");
    expect(mockSecretsService.create).toHaveBeenCalled();
  });

  it("should handle database connection errors gracefully", async () => {
    // Mock database service to throw connection error
    mockSecretsService.create.mockRejectedValueOnce(new Error("Connection refused"));

    const requestBody = {
      title: "Test Secret",
      server_share: "encrypted-data",
      contact_method: "email",
      recipient_name: "Test Recipient",
      recipient_email: "recipient@example.com",
      check_in_days: 30,
      sss_shares_total: 3,
      sss_threshold: 2,
    };

    const request = new NextRequest("http://localhost:3000/api/secrets", {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it("should handle database insert errors", async () => {
    // Mock database service to throw insert error
    mockSecretsService.create.mockRejectedValueOnce(new Error("Insert failed"));

    const requestBody = {
      title: "Test Secret",
      server_share: "encrypted-data",
      contact_method: "email",
      recipient_name: "Test Recipient",
      recipient_email: "recipient@example.com",
      check_in_days: 30,
      sss_shares_total: 3,
      sss_threshold: 2,
    };

    const request = new NextRequest("http://localhost:3000/api/secrets", {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});