// Stripe webhook event types
export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items: {
    data: Array<{
      price: {
        id: string;
      };
    }>;
  };
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end?: number;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  subscription?: string;
  status: string;
  attempt_count?: number;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: StripeSubscription | StripeInvoice | Record<string, unknown>;
  };
}

// BTCPay webhook event types
export interface BTCPayInvoice {
  id: string;
  status: string;
  metadata?: {
    mode?: string;
    tierName?: string;
    interval?: string;
    [key: string]: unknown;
  };
}

export interface BTCPayWebhookEvent {
  type: 'InvoiceSettled' | 'InvoiceExpired' | 'InvoiceInvalid' | string;
  data: {
    object: BTCPayInvoice;
  };
}

// Union type for all webhook events
export type WebhookEvent = StripeWebhookEvent | BTCPayWebhookEvent;

// Email data types
export interface EmailTemplateData {
  [key: string]: string | number | boolean | Date | null | undefined;
}

export interface EmailNotificationData {
  recipientEmail: string;
  recipientName?: string;
  secretTitle?: string;
  daysRemaining?: number;
  trialEndDate?: Date;
  tierName?: string;
  provider?: string;
  status?: string;
}
