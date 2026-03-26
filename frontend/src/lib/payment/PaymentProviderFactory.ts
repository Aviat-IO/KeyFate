import type { PaymentProvider } from "./interfaces/PaymentProvider"
import { StripeProvider } from "./providers/StripeProvider"
import { BTCPayProvider } from "./providers/BTCPayProvider"

export type PaymentProviderType = "stripe" | "btcpay"

export interface PaymentProviderConfig {
  provider: PaymentProviderType
  config: {
    secretKey?: string // For Stripe
    serverUrl?: string // For BTCPay (future)
    apiKey?: string // For BTCPay (future)
    storeId?: string // For BTCPay (future)
  }
}

export class PaymentProviderFactory {
  static create(config: PaymentProviderConfig): PaymentProvider {
    switch (config.provider) {
      case "stripe":
        if (!config.config.secretKey) {
          throw new Error("Stripe requires secretKey")
        }
        return new StripeProvider(config.config.secretKey)
      case "btcpay":
        if (
          !config.config.serverUrl ||
          !config.config.apiKey ||
          !config.config.storeId
        ) {
          throw new Error("BTCPay requires serverUrl, apiKey, and storeId")
        }
        return new BTCPayProvider({
          serverUrl: config.config.serverUrl,
          apiKey: config.config.apiKey,
          storeId: config.config.storeId,
        })
      default:
        throw new Error(`Unsupported payment provider: ${config.provider}`)
    }
  }
}
