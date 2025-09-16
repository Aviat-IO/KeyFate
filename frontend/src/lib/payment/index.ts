import { serverEnv } from "../server-env";
import { PaymentProviderFactory } from "./PaymentProviderFactory";

// Lazy initialization to avoid build-time environment validation
export function getFiatPaymentProvider() {
  return PaymentProviderFactory.create({
    provider: "stripe",
    config: {
      secretKey: serverEnv.STRIPE_SECRET_KEY,
    },
  });
}

export function getCryptoPaymentProvider() {
  return PaymentProviderFactory.create({
    provider: "btcpay",
    config: {
      serverUrl: serverEnv.BTCPAY_SERVER_URL,
      apiKey: serverEnv.BTCPAY_API_KEY,
      storeId: serverEnv.BTCPAY_STORE_ID,
    },
  });
}

export * from "./interfaces/PaymentProvider";
export * from "./PaymentProviderFactory";
