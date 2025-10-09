export interface PaymentProvider {
  // Provider Info
  getProviderType(): "fiat" | "crypto";
  getProviderName(): string;
  getSupportedCurrencies(): string[];

  // Customer Management
  createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string>;
  getCustomer(customerId: string): Promise<Customer>;
  updateCustomer(
    customerId: string,
    data: Partial<Customer>,
  ): Promise<Customer>;

  // Subscription Management (for recurring payments)
  createSubscription(
    customerId: string,
    config: SubscriptionConfig,
  ): Promise<Subscription>;
  getSubscription(subscriptionId: string): Promise<Subscription>;
  updateSubscription(
    subscriptionId: string,
    data: Partial<SubscriptionUpdate>,
  ): Promise<Subscription>;
  cancelSubscription(subscriptionId: string): Promise<Subscription>;

  // One-time Payments
  createPayment(config: PaymentConfig): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment>;

  // Checkout & Billing Portal
  createCheckoutSession(config: CheckoutConfig): Promise<CheckoutSession>;
  createBillingPortalSession?(
    customerId: string,
    returnUrl: string,
  ): Promise<BillingPortalSession>;

  // Webhook Handling
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<WebhookEvent>;

  // Products & Pricing
  listProducts(): Promise<Product[]>;
  listPrices(productId?: string): Promise<Price[]>;

  // Currency Conversion (for crypto providers)
  convertToProviderCurrency?(
    amount: number,
    fromCurrency: string,
  ): Promise<number>;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
  created: Date;
}

export interface Subscription {
  id: string;
  customerId: string;
  status:
    | "active"
    | "canceled"
    | "incomplete"
    | "past_due"
    | "trialing"
    | "unpaid";
  priceId?: string; // Optional for crypto providers
  amount?: number; // For fixed amount subscriptions
  currency?: string; // Currency code (USD, BTC, etc.)
  interval?: "month" | "year" | "day";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, string>;
}

export interface SubscriptionConfig {
  priceId?: string; // For Stripe-style pricing
  amount?: number; // For fixed amount subscriptions
  currency?: string; // Currency code
  interval?: "month" | "year" | "day";
  metadata?: Record<string, string>;
}

export interface Payment {
  id: string;
  customerId?: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "expired" | "processing";
  description?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
}

export interface PaymentConfig {
  amount: number;
  currency: string;
  description?: string;
  customerId?: string;
  successUrl?: string;
  cancelUrl?: string;
  expiresInMinutes?: number; // For crypto payments
  metadata?: Record<string, string>;
}

export interface CheckoutConfig {
  customerId?: string;
  priceId?: string; // For subscription mode
  amount?: number; // For payment mode
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  mode: "subscription" | "payment";
  billingAddressCollection?: "auto" | "required";
  automaticTax?: { enabled: boolean };
  locale?: string;
  expiresInMinutes?: number; // For crypto payments
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  customerId?: string;
}

export interface BillingPortalSession {
  id: string;
  url: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
  created: Date;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface Price {
  id: string;
  productId: string;
  currency: string;
  unitAmount: number;
  interval?: "month" | "year";
  intervalCount?: number;
  lookupKey?: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionUpdate {
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, string>;
}
