-- Add subscription tables for Paddle billing integration
-- Migration: 20241229_add_subscription_tables.sql

-- Create subscription tier enum
DROP TYPE IF EXISTS public.subscription_tier CASCADE;
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro');

-- Create subscription status enum
DROP TYPE IF EXISTS public.subscription_status CASCADE;
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'trialing',
  'paused'
);

-- Create user_tiers table to define tier limits and capabilities
CREATE TABLE IF NOT EXISTS public.user_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name subscription_tier NOT NULL DEFAULT 'free',
  max_secrets INTEGER NOT NULL DEFAULT 1,
  max_recipients_per_secret INTEGER NOT NULL DEFAULT 1,
  custom_intervals BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one tier per user
  CONSTRAINT unique_user_tier UNIQUE(user_id)
);

-- Create user_subscriptions table for Paddle integration
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT UNIQUE,
  paddle_customer_id TEXT,
  status subscription_status NOT NULL DEFAULT 'active',
  tier_name subscription_tier NOT NULL DEFAULT 'free',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one subscription per user (for now)
  CONSTRAINT unique_user_subscription UNIQUE(user_id)
);

-- Create subscription_usage table for tracking usage against limits
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secrets_count INTEGER NOT NULL DEFAULT 0,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  last_calculated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one usage record per user
  CONSTRAINT unique_user_usage UNIQUE(user_id)
);

-- Add triggers for updated_at columns
CREATE TRIGGER update_user_tiers_updated_at
    BEFORE UPDATE ON public.user_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id ON public.user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tiers_tier_name ON public.user_tiers(tier_name);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_paddle_subscription_id ON public.user_subscriptions(paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_paddle_customer_id ON public.user_subscriptions(paddle_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_id ON public.subscription_usage(user_id);

-- Create function to get user tier with limits
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id UUID)
RETURNS TABLE (
  tier_name subscription_tier,
  max_secrets INTEGER,
  max_recipients_per_secret INTEGER,
  custom_intervals BOOLEAN,
  subscription_status subscription_status
)
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ut.tier_name,
    ut.max_secrets,
    ut.max_recipients_per_secret,
    ut.custom_intervals,
    COALESCE(us.status, 'active'::subscription_status) as subscription_status
  FROM public.user_tiers ut
  LEFT JOIN public.user_subscriptions us ON ut.user_id = us.user_id
  WHERE ut.user_id = p_user_id;

  -- If no tier exists, return free tier defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'free'::subscription_tier as tier_name,
      2 as max_secrets,
      1 as max_recipients_per_secret,
      FALSE as custom_intervals,
      'active'::subscription_status as subscription_status;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate and update usage
CREATE OR REPLACE FUNCTION public.calculate_user_usage(p_user_id UUID)
RETURNS TABLE (
  secrets_count INTEGER,
  total_recipients INTEGER
)
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secrets_count INTEGER;
  v_total_recipients INTEGER;
BEGIN
  -- Count active secrets
  SELECT COUNT(*)
  INTO v_secrets_count
  FROM public.secrets
  WHERE user_id = p_user_id
  AND status != 'triggered';

  -- Count total recipients across all active secrets
  SELECT COALESCE(SUM(1), 0)
  INTO v_total_recipients
  FROM public.secrets
  WHERE user_id = p_user_id
  AND status != 'triggered';

  -- Update or insert usage record
  INSERT INTO public.subscription_usage (user_id, secrets_count, total_recipients, last_calculated)
  VALUES (p_user_id, v_secrets_count, v_total_recipients, CURRENT_TIMESTAMP)
  ON CONFLICT (user_id)
  DO UPDATE SET
    secrets_count = v_secrets_count,
    total_recipients = v_total_recipients,
    last_calculated = CURRENT_TIMESTAMP;

  RETURN QUERY
  SELECT v_secrets_count, v_total_recipients;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user can create more secrets
CREATE OR REPLACE FUNCTION public.can_create_secret(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_count INTEGER;
  v_max_secrets INTEGER;
BEGIN
  -- Get current usage and tier limits
  SELECT su.secrets_count, ut.max_secrets
  INTO v_current_count, v_max_secrets
  FROM public.subscription_usage su
  LEFT JOIN public.user_tiers ut ON su.user_id = ut.user_id
  WHERE su.user_id = p_user_id;

  -- If no usage record, calculate it
  IF v_current_count IS NULL THEN
    SELECT secrets_count INTO v_current_count
    FROM public.calculate_user_usage(p_user_id);
  END IF;

  -- If no tier record, use free tier default
  IF v_max_secrets IS NULL THEN
    v_max_secrets := 2;
  END IF;

  RETURN v_current_count < v_max_secrets;
END;
$$ LANGUAGE plpgsql;

-- Create function to initialize free tier for existing users
CREATE OR REPLACE FUNCTION public.initialize_free_tiers()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Add free tier for all existing users without tiers
  FOR user_record IN
    SELECT au.id as user_id
    FROM auth.users au
    LEFT JOIN public.user_tiers ut ON au.id = ut.user_id
    WHERE ut.user_id IS NULL
  LOOP
    INSERT INTO public.user_tiers (user_id, tier_name, max_secrets, max_recipients_per_secret, custom_intervals)
    VALUES (user_record.user_id, 'free', 1, 1, FALSE);

    -- Calculate initial usage
    PERFORM public.calculate_user_usage(user_record.user_id);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update usage when secrets change
CREATE OR REPLACE FUNCTION public.update_usage_on_secret_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Update usage for the affected user
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calculate_user_usage(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.calculate_user_usage(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on secrets table
DROP TRIGGER IF EXISTS update_usage_on_secret_change_trigger ON public.secrets;
CREATE TRIGGER update_usage_on_secret_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_usage_on_secret_change();

-- Enable RLS on new tables
ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tiers
CREATE POLICY "Users can view their own tier"
  ON public.user_tiers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tiers"
  ON public.user_tiers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON public.user_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for subscription_usage
CREATE POLICY "Users can view their own usage"
  ON public.subscription_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all usage"
  ON public.subscription_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Initialize free tiers for existing users
SELECT public.initialize_free_tiers();
