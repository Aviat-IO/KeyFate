import Stripe from "stripe";
import {
  BillingPortalSession,
  CheckoutConfig,
  CheckoutSession,
  Customer,
  Payment,
  PaymentConfig,
  PaymentProvider,
  Price,
  Product,
  Subscription,
  SubscriptionConfig,
  SubscriptionUpdate,
  WebhookEvent,
} from "../interfaces/PaymentProvider";

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  getProviderType(): "fiat" | "crypto" {
    return "fiat";
  }

  getProviderName(): string {
    return "Stripe";
  }

  getSupportedCurrencies(): string[] {
    return ["USD", "EUR", "GBP", "CAD", "AUD"]; // Add more as needed
  }

  async createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      metadata,
    });
    return customer.id;
  }

  async getCustomer(customerId: string): Promise<Customer> {
    const customer = await this.stripe.customers.retrieve(
      customerId,
    ) as Stripe.Customer;
    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name || undefined,
      metadata: customer.metadata,
      created: new Date(customer.created * 1000),
    };
  }

  async updateCustomer(
    customerId: string,
    data: Partial<Customer>,
  ): Promise<Customer> {
    const updated = await this.stripe.customers.update(customerId, {
      email: data.email,
      name: data.name,
      metadata: data.metadata,
    });
    return this.mapStripeCustomer(updated);
  }

  async createSubscription(
    customerId: string,
    config: SubscriptionConfig,
  ): Promise<Subscription> {
    if (!config.priceId) {
      throw new Error("Stripe requires priceId for subscriptions");
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: config.priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: config.metadata,
    });
    return this.mapStripeSubscription(subscription);
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(
      subscriptionId,
    );
    return this.mapStripeSubscription(subscription);
  }

  async updateSubscription(
    subscriptionId: string,
    data: SubscriptionUpdate,
  ): Promise<Subscription> {
    const updateData: Stripe.SubscriptionUpdateParams = {};

    if (data.priceId) {
      updateData.items = [{ price: data.priceId }];
    }

    if (data.cancelAtPeriodEnd !== undefined) {
      updateData.cancel_at_period_end = data.cancelAtPeriodEnd;
    }

    if (data.metadata) {
      updateData.metadata = data.metadata;
    }

    const subscription = await this.stripe.subscriptions.update(
      subscriptionId,
      updateData,
    );
    return this.mapStripeSubscription(subscription);
  }

  async cancelSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
    return this.mapStripeSubscription(subscription);
  }

  async createPayment(config: PaymentConfig): Promise<Payment> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(config.amount * 100), // Convert to cents
      currency: config.currency.toLowerCase(),
      customer: config.customerId,
      description: config.description,
      metadata: config.metadata,
    });

    return this.mapStripePayment(paymentIntent);
  }

  async getPayment(paymentId: string): Promise<Payment> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
    return this.mapStripePayment(paymentIntent);
  }

  async createCheckoutSession(
    config: CheckoutConfig,
  ): Promise<CheckoutSession> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: config.mode,
      success_url: config.successUrl,
      cancel_url: config.cancelUrl,
    };

    if (config.mode === "subscription") {
      if (!config.priceId) {
        throw new Error("priceId is required for subscription mode");
      }
      sessionParams.line_items = [
        {
          price: config.priceId,
          quantity: 1,
        },
      ];
      if (config.metadata) {
        sessionParams.subscription_data = {
          metadata: config.metadata,
        };
      }
    } else if (config.mode === "payment") {
      if (!config.amount || !config.currency) {
        throw new Error("amount and currency are required for payment mode");
      }
      sessionParams.line_items = [
        {
          price_data: {
            currency: config.currency.toLowerCase(),
            unit_amount: Math.round(config.amount * 100), // Convert to cents
            product_data: {
              name: "KeyFate Payment",
            },
          },
          quantity: 1,
        },
      ];
    }

    if (config.customerId) {
      sessionParams.customer = config.customerId;
    }

    if (config.billingAddressCollection) {
      sessionParams.billing_address_collection =
        config.billingAddressCollection;
    }

    if (config.automaticTax) {
      sessionParams.automatic_tax = config.automaticTax;
    }

    if (config.locale) {
      sessionParams.locale = config.locale as Stripe.Checkout.SessionCreateParams.Locale;
    }

    if (config.metadata) {
      sessionParams.metadata = config.metadata;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    return {
      id: session.id,
      url: session.url!,
      customerId: session.customer as string || undefined,
    };
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<BillingPortalSession> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<WebhookEvent> {
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      secret,
    );

    return {
      id: event.id,
      type: event.type,
      data: {
        object: event.data.object as unknown as Record<string, unknown>,
        previous_attributes: event.data.previous_attributes as unknown as
          | Record<string, unknown>
          | undefined,
      },
      created: new Date(event.created * 1000),
    };
  }

  async listProducts(): Promise<Product[]> {
    const products = await this.stripe.products.list({ active: true });
    return products.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description || undefined,
      metadata: product.metadata,
    }));
  }

  async listPrices(productId?: string): Promise<Price[]> {
    const params: Stripe.PriceListParams = { active: true };
    if (productId) {
      params.product = productId;
    }

    const prices = await this.stripe.prices.list(params);
    return prices.data.map((price) => ({
      id: price.id,
      productId: price.product as string,
      currency: price.currency,
      unitAmount: price.unit_amount!,
      interval: price.recurring?.interval as "month" | "year" | undefined,
      intervalCount: price.recurring?.interval_count,
      lookupKey: price.lookup_key || undefined,
      metadata: price.metadata,
    }));
  }

  private mapStripeCustomer(customer: Stripe.Customer): Customer {
    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name || undefined,
      metadata: customer.metadata,
      created: new Date(customer.created * 1000),
    };
  }

  private mapStripeSubscription(
    subscription: Stripe.Subscription,
  ): Subscription {
    const price = subscription.items.data[0].price;
    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status as Subscription["status"],
      priceId: price.id,
      amount: price.unit_amount ? price.unit_amount / 100 : undefined,
      currency: price.currency.toUpperCase(),
      interval: price.recurring?.interval as "month" | "year" | undefined,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      metadata: subscription.metadata,
    };
  }

  private mapStripePayment(paymentIntent: Stripe.PaymentIntent): Payment {
    return {
      id: paymentIntent.id,
      customerId: paymentIntent.customer as string || undefined,
      amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency.toUpperCase(),
      status: this.mapPaymentStatus(paymentIntent.status),
      description: paymentIntent.description || undefined,
      metadata: paymentIntent.metadata,
      createdAt: new Date(paymentIntent.created * 1000),
      completedAt: paymentIntent.status === "succeeded"
        ? new Date(paymentIntent.created * 1000)
        : undefined,
    };
  }

  private mapPaymentStatus(
    status: Stripe.PaymentIntent.Status,
  ): Payment["status"] {
    switch (status) {
      case "succeeded":
        return "completed";
      case "processing":
        return "processing";
      case "requires_action":
      case "requires_capture":
      case "requires_confirmation":
      case "requires_payment_method":
        return "pending";
      case "canceled":
        return "failed";
      default:
        return "pending";
    }
  }
}
