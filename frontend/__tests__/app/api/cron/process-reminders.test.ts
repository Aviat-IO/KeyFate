/**
 * Test Suite: process-reminders cron job
 *
 * TDD approach for implementing the process-reminders endpoint
 * with email disclosure functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/cron/process-reminders/route";

// Mock dependencies
vi.mock("@/lib/db/drizzle", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/email/email-service", () => ({
  sendSecretDisclosureEmail: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/encryption", () => ({
  decryptMessage: vi.fn(),
}));

vi.mock("@/lib/email/email-failure-logger", () => ({
  logEmailFailure: vi.fn(),
}));

import { db } from "@/lib/db/drizzle";
import { sendSecretDisclosureEmail, sendEmail } from "@/lib/email/email-service";
import { decryptMessage } from "@/lib/encryption";
import { logEmailFailure } from "@/lib/email/email-failure-logger";

describe("POST /api/cron/process-reminders", () => {
  const validToken = process.env.CRON_SECRET || "test-cron-secret";
  const mockUserId = "user-123";
  const mockSecretId = "secret-123";

  const mockUser = {
    id: mockUserId,
    email: "testuser@example.com",
    name: "Test User",
  };

  const mockSecret = {
    id: mockSecretId,
    userId: mockUserId,
    title: "Test Secret",
    recipientName: "John Doe",
    recipientEmail: "john@example.com",
    contactMethod: "email",
    status: "active",
    nextCheckIn: new Date(Date.now() - 86400000), // 1 day ago
    serverShare: "encrypted_server_share_base64",
    iv: "iv_base64",
    authTag: "auth_tag_base64",
    lastCheckIn: new Date(Date.now() - 172800000), // 2 days ago
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = validToken;

    // Mock decryption
    vi.mocked(decryptMessage).mockResolvedValue(
      "This is the decrypted secret content"
    );
  });

  describe("Authorization", () => {
    it("should reject requests without authorization header", async () => {
      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject requests with invalid bearer token", async () => {
      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should accept requests with valid CRON_SECRET", async () => {
      // Mock database to return empty results
      const mockLimit = vi.fn().mockResolvedValue([mockUser]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any).mockImplementation(mockSelect);

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const response = await POST(req as any);

      expect(response.status).not.toBe(401);
    });
  });

  describe("Secret querying and processing", () => {
    it("should query secrets with status=active and nextCheckIn < now", async () => {
      // Mock database responses
      const mockWhere = vi.fn().mockResolvedValue([mockSecret]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      // Mock user query
      const mockLimit = vi.fn().mockResolvedValue([mockUser]);
      const mockUserWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom }) // First call for secrets
        .mockReturnValueOnce({ from: mockUserFrom }); // Second call for user

      vi.mocked(sendSecretDisclosureEmail).mockResolvedValue({
        success: true,
        messageId: "test-message-id",
        provider: "sendgrid",
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      (db.update as any).mockReturnValue({ set: mockSet });

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.processed).toBeGreaterThanOrEqual(1);
    });

    it("should not process secrets with status=paused", async () => {
      // Mock database to return no overdue active secrets
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any).mockImplementation(mockSelect);

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(data.processed).toBe(0);
    });
  });

  describe("Decryption and email disclosure", () => {
    beforeEach(() => {
      // Setup complete mock chain for secret processing
      const mockWhere = vi.fn().mockResolvedValue([mockSecret]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSecretSelect = vi.fn().mockReturnValue({ from: mockFrom });

      const mockLimit = vi.fn().mockResolvedValue([mockUser]);
      const mockUserWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockUserFrom });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      (db.update as any).mockReturnValue({ set: mockSet });
    });

    it("should decrypt server share using encryption utilities", async () => {
      vi.mocked(sendSecretDisclosureEmail).mockResolvedValue({
        success: true,
        messageId: "test-message-id",
      });

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      await POST(req as any);

      expect(decryptMessage).toHaveBeenCalledWith(
        "encrypted_server_share_base64",
        expect.any(Buffer),
        expect.any(Buffer)
      );
    });

    it("should send disclosure email with decrypted content", async () => {
      vi.mocked(sendSecretDisclosureEmail).mockResolvedValue({
        success: true,
        messageId: "test-message-id",
      });

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      await POST(req as any);

      expect(sendSecretDisclosureEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          contactEmail: "john@example.com",
          contactName: "John Doe",
          secretTitle: "Test Secret",
          senderName: "Test User",
          secretContent: "This is the decrypted secret content",
          disclosureReason: "scheduled",
        })
      );
    });
  });

  describe("Status updates", () => {
    beforeEach(() => {
      const mockWhere = vi.fn().mockResolvedValue([mockSecret]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      const mockLimit = vi.fn().mockResolvedValue([mockUser]);
      const mockUserWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockUserFrom });
    });

    it("should update secret status to triggered after successful delivery", async () => {
      vi.mocked(sendSecretDisclosureEmail).mockResolvedValue({
        success: true,
        messageId: "test-message-id",
      });

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      await POST(req as any);

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "triggered",
          triggeredAt: expect.any(Date),
        })
      );
    });

    it("should not update status if email delivery fails", async () => {
      vi.mocked(sendSecretDisclosureEmail).mockResolvedValue({
        success: false,
        error: "Email delivery failed",
      });

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      await POST(req as any);

      // db.update should not be called for status change
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("Error handling and logging", () => {
    beforeEach(() => {
      const mockWhere = vi.fn().mockResolvedValue([mockSecret]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      const mockLimit = vi.fn().mockResolvedValue([mockUser]);
      const mockUserWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockUserFrom });
    });

    it("should log email failures to email_failures table", async () => {
      vi.mocked(sendSecretDisclosureEmail).mockResolvedValue({
        success: false,
        error: "SMTP connection failed",
        retryable: true,
        provider: "sendgrid",
      });

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      await POST(req as any);

      expect(logEmailFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          emailType: "disclosure",
          provider: "sendgrid",
          recipient: "john@example.com",
          errorMessage: expect.stringContaining("SMTP connection failed"),
        })
      );
    });

    it("should send admin notification on permanent failure", async () => {
      vi.mocked(sendSecretDisclosureEmail).mockResolvedValue({
        success: false,
        error: "Permanent delivery failure",
        retryable: false,
      });

      vi.mocked(sendEmail).mockResolvedValue({
        success: true,
        messageId: "admin-notification-id",
      });

      const req = new Request("http://localhost:3000/api/cron/process-reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      await POST(req as any);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "support@aviat.io",
          subject: expect.stringContaining("Email Delivery Failure"),
        })
      );
    });
  });
});
