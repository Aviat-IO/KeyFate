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

export * from "./interfaces/PaymentProvider";
export * from "./PaymentProviderFactory";
