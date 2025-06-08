import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { SubscriptionTier } from "../types/subscription";

// Paddle configuration
const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV as
  | "sandbox"
  | "production";
const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

if (!PADDLE_CLIENT_TOKEN) {
  throw new Error(
    "Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN environment variable",
  );
}

// Paddle instance (initialized lazily)
let paddleInstance: Paddle | null = null;

// Initialize Paddle.js
export async function initPaddle(): Promise<Paddle> {
  if (paddleInstance) {
    return paddleInstance;
  }

  try {
    paddleInstance = await initializePaddle({
      environment: PADDLE_ENV,
      token: PADDLE_CLIENT_TOKEN,
    });

    return paddleInstance;
  } catch (error) {
    console.error("Failed to initialize Paddle:", error);
    throw error;
  }
}

// Product configuration mapping tiers to Paddle price IDs
// These will be set after creating products in Paddle dashboard
const PRICE_IDS = {
  pro_monthly: process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID,
  pro_yearly: process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID,
} as const;

// Subscription checkout for upgrade
export async function openSubscriptionCheckout(
  tier: SubscriptionTier,
  billingPeriod: "monthly" | "yearly",
  customerData: {
    email: string;
    userId: string;
  },
) {
  const paddle = await initPaddle();

  if (tier === "free") {
    throw new Error("Cannot create checkout for free tier");
  }

  const priceId = billingPeriod === "monthly"
    ? PRICE_IDS.pro_monthly
    : PRICE_IDS.pro_yearly;

  if (!priceId) {
    throw new Error(`Missing price ID for ${tier}_${billingPeriod}`);
  }

  try {
    const checkout = await paddle.Checkout.open({
      items: [
        {
          priceId: priceId,
          quantity: 1,
        },
      ],
      customer: {
        email: customerData.email,
      },
      customData: {
        userId: customerData.userId,
        tier: tier,
      },
      settings: {
        allowLogout: false,
        displayMode: "overlay",
        theme: "dark",
        locale: "en",
      },
    });

    return checkout;
  } catch (error) {
    console.error("Failed to open Paddle checkout:", error);
    throw error;
  }
}

// Get subscription management URL for existing customers
export async function getSubscriptionManagementUrl(
  customerId: string,
): Promise<string> {
  // This would typically be done on the backend for security
  // For now, return a placeholder that redirects to customer portal
  return `${
    PADDLE_ENV === "sandbox"
      ? "https://sandbox-vendors.paddle.com"
      : "https://vendors.paddle.com"
  }/customer-portal/${customerId}`;
}

// Pricing display helpers
export const PRICING = {
  pro: {
    monthly: {
      amount: 9.00,
      currency: "USD",
      interval: "month",
      displayPrice: "$9/month",
    },
    yearly: {
      amount: 90.00, // 17% discount (originally $108 if paid monthly)
      currency: "USD",
      interval: "year",
      displayPrice: "$90/year",
      savings: "$18 saved (17% off)",
      monthlyEquivalent: "$7.50/month",
    },
  },
} as const;

// Calculate savings for yearly plans
export function calculateYearlySavings(): number {
  const monthlyTotal = PRICING.pro.monthly.amount * 12; // $108.00
  const yearlyPrice = PRICING.pro.yearly.amount; // $90.00
  return monthlyTotal - yearlyPrice; // $18.00
}

// Paddle event handlers for checkout completion
export interface PaddleCheckoutCompleteData {
  checkout: {
    id: string;
    status: string;
  };
  data: {
    customer: {
      id: string;
      email: string;
    };
    subscription?: {
      id: string;
      status: string;
    };
    transaction: {
      id: string;
      status: string;
    };
  };
}

interface PaddleEvent<T = unknown> extends Event {
  detail: T;
}

// Setup Paddle event listeners
export function setupPaddleEventListeners() {
  if (typeof window === "undefined") return;

  // Listen for checkout completion
  window.addEventListener(
    "paddle_checkout_complete",
    (event: PaddleEvent<PaddleCheckoutCompleteData>) => {
      const data = event.detail as PaddleCheckoutCompleteData;

      // Handle successful subscription creation
      if (data.data.subscription) {
        // Redirect to success page or dashboard
        window.location.href = "/dashboard?upgrade=success";
      }
    },
  );

  // Listen for checkout failure
  window.addEventListener(
    "paddle_checkout_error",
    (event: PaddleEvent<unknown>) => {
      console.error("Paddle checkout error:", event.detail);
      // Handle checkout errors (show user-friendly message)
    },
  );
}

// Update subscription (for plan changes)
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string,
  prorationBehavior:
    | "prorated_immediately"
    | "full_immediately"
    | "do_not_bill" = "prorated_immediately",
) {
  // This should be done via backend API call to Paddle
  // Frontend cannot directly modify subscriptions for security
  const response = await fetch("/api/paddle/update-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionId,
      newPriceId,
      prorationBehavior,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to update subscription");
  }

  return response.json();
}

// Cancel subscription
export async function cancelSubscription(
  subscriptionId: string,
  effective: "immediately" | "at_period_end" = "at_period_end",
) {
  // This should be done via backend API call to Paddle
  const response = await fetch("/api/paddle/cancel-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionId,
      effective,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to cancel subscription");
  }

  return response.json();
}

// Resume paused subscription
export async function resumeSubscription(subscriptionId: string) {
  const response = await fetch("/api/paddle/resume-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to resume subscription");
  }

  return response.json();
}
