import { PaymentProvider } from "./interfaces/PaymentProvider";
import { StripeProvider } from "./providers/StripeProvider";

export type PaymentProviderType = "stripe";

export interface PaymentProviderConfig {
  provider: PaymentProviderType;
  config: {
    secretKey?: string; // For Stripe
    serverUrl?: string; // For BTCPay (future)
    apiKey?: string; // For BTCPay (future)
    storeId?: string; // For BTCPay (future)
  };
}

export class PaymentProviderFactory {
  static create(config: PaymentProviderConfig): PaymentProvider {
    switch (config.provider) {
      case "stripe":
        if (!config.config.secretKey) {
          throw new Error("Stripe requires secretKey");
        }
        return new StripeProvider(config.config.secretKey);
      default:
        throw new Error(`Unsupported payment provider: ${config.provider}`);
    }
  }
}
