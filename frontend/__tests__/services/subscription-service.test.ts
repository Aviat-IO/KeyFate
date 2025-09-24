import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock database with proper Drizzle query builder chain
const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      }),
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id: "test-id", name: "premium" }]),
        and: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "test-id", status: "active" }]),
        }),
      }),
    }),
  }),
};

vi.mock("@/lib/db/drizzle", () => ({
  db: mockDb,
}));

// Mock drizzle operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column, value) => ({ column, value, operator: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, operator: "and" })),
}));

vi.mock("@/lib/db/schema", () => ({
  userSubscriptions: {
    userId: "userId",
    tierId: "tierId",
    provider: "provider",
    providerCustomerId: "providerCustomerId",
    providerSubscriptionId: "providerSubscriptionId",
    status: "status",
    currentPeriodStart: "currentPeriodStart",
    currentPeriodEnd: "currentPeriodEnd",
    cancelAtPeriodEnd: "cancelAtPeriodEnd",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  subscriptionTiers: {
    id: "id",
    name: "name",
    displayName: "displayName",
    maxSecrets: "maxSecrets",
    maxRecipientsPerSecret: "maxRecipientsPerSecret",
    customIntervals: "customIntervals",
    priceMonthly: "priceMonthly",
    priceYearly: "priceYearly",
  },
}));

// Mock email service
const mockEmailService = {
  sendSubscriptionConfirmation: vi.fn(),
  sendPaymentFailedNotification: vi.fn(),
  sendSubscriptionCancelledNotification: vi.fn(),
};

vi.mock("@/lib/services/email-service", () => ({
  emailService: mockEmailService,
}));

describe("Subscription Service Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset database mocks to default behavior
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        }),
      }),
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "test-id", name: "premium" }]),
        }),
      }),
    });

    // Reset email service mock
    mockEmailService.sendSubscriptionConfirmation.mockResolvedValue(undefined);
    mockEmailService.sendPaymentFailedNotification.mockResolvedValue(undefined);
    mockEmailService.sendSubscriptionCancelledNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Subscription Creation", () => {
    it("should create subscription with Stripe provider", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      const subscriptionData = {
        userId: "user123",
        provider: "stripe" as const,
        providerCustomerId: "cus_test123",
        providerSubscriptionId: "sub_test123",
        tierName: "pro" as const,
        status: "active" as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act
      const result = await subscriptionService.createSubscription(subscriptionData);

      // Assert
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should create subscription with BTCPay provider", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      const subscriptionData = {
        userId: "user123",
        provider: "btcpay" as const,
        providerCustomerId: null,
        providerSubscriptionId: "invoice123",
        tierName: "pro" as const,
        status: "active" as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act
      const result = await subscriptionService.createSubscription(subscriptionData);

      // Assert
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should send confirmation email after successful subscription creation", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      const subscriptionData = {
        userId: "user123",
        provider: "stripe" as const,
        providerCustomerId: "cus_test123",
        providerSubscriptionId: "sub_test123",
        tierName: "pro" as const,
        status: "active" as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act
      await subscriptionService.createSubscription(subscriptionData);

      // Assert
      expect(mockEmailService.sendSubscriptionConfirmation).toHaveBeenCalledWith(
        subscriptionData.userId,
        expect.objectContaining({
          provider: "stripe",
          tierName: "pro",
        })
      );
    });
  });

  describe("Subscription Updates", () => {
    it("should update subscription status", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      // Act
      await subscriptionService.updateSubscriptionStatus("user123", "cancelled");

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle subscription tier upgrade", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      const updateData = {
        tierName: "premium" as const,
        status: "active" as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act
      await subscriptionService.updateSubscription("user123", updateData);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle subscription cancellation", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      // Act
      await subscriptionService.cancelSubscription("user123", true);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockEmailService.sendSubscriptionCancelledNotification).toHaveBeenCalledWith("user123");
    });
  });

  describe("Subscription Queries", () => {
    it("should get user subscription by userId", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "sub-id",
              userId: "user123",
              status: "active",
            }]),
          }),
        }),
      });

      // Act
      const result = await subscriptionService.getUserSubscription("user123");

      // Assert
      expect(result).toBeDefined();
      expect(result?.userId).toBe("user123");
    });

    it("should check if user has active subscription", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "sub-id",
              status: "active",
            }]),
          }),
        }),
      });

      // Act
      const result = await subscriptionService.hasActiveSubscription("user123");

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for user without active subscription", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act
      const result = await subscriptionService.hasActiveSubscription("user123");

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      const subscriptionData = {
        userId: "user123",
        provider: "stripe" as const,
        providerCustomerId: "cus_test123",
        providerSubscriptionId: "sub_test123",
        tierName: "pro" as const,
        status: "active" as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act & Assert
      await expect(subscriptionService.createSubscription(subscriptionData)).rejects.toThrow("Database error");
    });

    it("should handle email service failures gracefully", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      mockEmailService.sendSubscriptionConfirmation.mockRejectedValue(new Error("Email service error"));

      const subscriptionData = {
        userId: "user123",
        provider: "stripe" as const,
        providerCustomerId: "cus_test123",
        providerSubscriptionId: "sub_test123",
        tierName: "pro" as const,
        status: "active" as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act - should not throw even if email fails
      const result = await subscriptionService.createSubscription(subscriptionData);

      // Assert
      expect(result).toBeDefined();
      expect(mockEmailService.sendSubscriptionConfirmation).toHaveBeenCalled();
    });
  });

  describe("User Tier Management", () => {
    it("should update user tier when subscription changes", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      // Act
      await subscriptionService.updateUserTier("user123", "premium");

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle tier downgrade to free", async () => {
      // Arrange
      const { subscriptionService } = await import("@/lib/services/subscription-service");

      // Act
      await subscriptionService.updateUserTier("user123", "free");

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});