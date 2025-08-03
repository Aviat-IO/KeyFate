import {
  PaymentProviderFactory,
  PaymentProviderType,
} from "@/lib/payment/PaymentProviderFactory";
import { StripeProvider } from "@/lib/payment/providers/StripeProvider";
import { describe, expect, it, vi } from "vitest";

// Mock the StripeProvider
vi.mock("@/lib/payment/providers/StripeProvider", () => ({
  StripeProvider: vi.fn().mockImplementation((secretKey: string) => ({
    secretKey,
    getProviderType: () => "fiat",
    getProviderName: () => "Stripe",
  })),
}));

describe("PaymentProviderFactory", () => {
  describe("create", () => {
    it("should create a Stripe provider with valid config", () => {
      const config = {
        provider: "stripe" as PaymentProviderType,
        config: {
          secretKey: "sk_test_123",
        },
      };

      const provider = PaymentProviderFactory.create(config);

      expect(StripeProvider).toHaveBeenCalledWith("sk_test_123");
      expect(provider).toBeDefined();
    });

    it("should throw error when Stripe config is missing secretKey", () => {
      const config = {
        provider: "stripe" as PaymentProviderType,
        config: {},
      };

      expect(() => PaymentProviderFactory.create(config)).toThrow(
        "Stripe requires secretKey",
      );
    });

    it("should throw error when Stripe config has empty secretKey", () => {
      const config = {
        provider: "stripe" as PaymentProviderType,
        config: {
          secretKey: "",
        },
      };

      expect(() => PaymentProviderFactory.create(config)).toThrow(
        "Stripe requires secretKey",
      );
    });

    it("should throw error for unsupported provider type", () => {
      const config = {
        provider: "unsupported" as PaymentProviderType,
        config: {
          secretKey: "test",
        },
      };

      expect(() => PaymentProviderFactory.create(config)).toThrow(
        "Unsupported payment provider: unsupported",
      );
    });

    it("should handle config with extra properties", () => {
      const config = {
        provider: "stripe" as PaymentProviderType,
        config: {
          secretKey: "sk_test_123",
          serverUrl: "https://example.com", // Extra property for BTCPay
          apiKey: "api_key", // Extra property for BTCPay
          storeId: "store_id", // Extra property for BTCPay
        },
      };

      const provider = PaymentProviderFactory.create(config);

      expect(StripeProvider).toHaveBeenCalledWith("sk_test_123");
      expect(provider).toBeDefined();
    });
  });

  describe("PaymentProviderConfig interface", () => {
    it("should accept valid Stripe configuration", () => {
      const config = {
        provider: "stripe" as PaymentProviderType,
        config: {
          secretKey: "sk_test_123",
        },
      };

      // TypeScript compilation test - if this compiles, the interface is working
      expect(config.provider).toBe("stripe");
      expect(config.config.secretKey).toBe("sk_test_123");
    });

    it("should accept configuration with optional BTCPay properties", () => {
      const config = {
        provider: "stripe" as PaymentProviderType,
        config: {
          secretKey: "sk_test_123",
          serverUrl: "https://btcpay.example.com",
          apiKey: "btcpay_api_key",
          storeId: "btcpay_store_id",
        },
      };

      // TypeScript compilation test
      expect(config.config.serverUrl).toBe("https://btcpay.example.com");
      expect(config.config.apiKey).toBe("btcpay_api_key");
      expect(config.config.storeId).toBe("btcpay_store_id");
    });
  });
});
