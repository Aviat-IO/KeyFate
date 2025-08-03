-- Add Stripe columns to user_subscriptions table
-- Migration: 02_add_stripe_columns.sql

ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;

-- Add indexes for Stripe IDs
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON public.user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription ON public.user_subscriptions(stripe_subscription_id);

-- Update the constraint to allow either Paddle or Stripe subscription IDs
ALTER TABLE public.user_subscriptions
DROP CONSTRAINT IF EXISTS subscription_id_constraint;

-- Add constraint to ensure at least one subscription ID is present (for active subscriptions)
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT subscription_id_constraint
CHECK (
  (paddle_subscription_id IS NOT NULL) OR
  (stripe_subscription_id IS NOT NULL) OR
  (status = 'canceled' OR tier_name = 'free')
);
