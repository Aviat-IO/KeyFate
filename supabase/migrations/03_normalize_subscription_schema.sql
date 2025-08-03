-- Migration: Normalize subscription schema
-- This migration addresses three issues:
-- 1. Makes user_subscriptions provider-agnostic (removes paddle_ prefixes)
-- 2. Removes redundant subscription_usage table (usage calculated on-demand)
-- 3. Normalizes user_tiers to reference a tiers table

-- Step 1: Create tiers table to define tier features
CREATE TABLE IF NOT EXISTS public.tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name subscription_tier NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  max_secrets INTEGER NOT NULL,
  max_recipients_per_secret INTEGER NOT NULL,
  custom_intervals BOOLEAN NOT NULL DEFAULT FALSE,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Insert default tier definitions
INSERT INTO public.tiers (name, display_name, max_secrets, max_recipients_per_secret, custom_intervals, price_monthly, price_yearly) VALUES
  ('free', 'Free', 1, 1, FALSE, 0.00, 0.00),
  ('pro', 'Pro', 10, 5, TRUE, 9.00, 90.00)
ON CONFLICT (name) DO NOTHING;

-- Step 3: Add provider columns to user_subscriptions (keeping old columns for migration)
ALTER TABLE public.user_subscriptions
ADD COLUMN provider TEXT,
ADD COLUMN provider_customer_id TEXT,
ADD COLUMN provider_subscription_id TEXT;

-- Step 4: Migrate existing paddle data to new provider columns
UPDATE public.user_subscriptions
SET
  provider = 'paddle',
  provider_customer_id = paddle_customer_id,
  provider_subscription_id = paddle_subscription_id
WHERE paddle_customer_id IS NOT NULL OR paddle_subscription_id IS NOT NULL;

-- Step 5: Add tier_id to user_tiers and migrate existing data
ALTER TABLE public.user_tiers
ADD COLUMN tier_id UUID REFERENCES public.tiers(id);

-- Migrate existing tier_name references to tier_id
UPDATE public.user_tiers
SET tier_id = t.id
FROM public.tiers t
WHERE user_tiers.tier_name = t.name;

-- Make tier_id NOT NULL after migration
ALTER TABLE public.user_tiers
ALTER COLUMN tier_id SET NOT NULL;

-- Step 6: Create new indexes for the provider columns
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider ON public.user_subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_customer_id ON public.user_subscriptions(provider_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_subscription_id ON public.user_subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_tiers_tier_id ON public.user_tiers(tier_id);

-- Step 7: Update the calculate_user_usage function to return calculated values without storing them
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

  RETURN QUERY
  SELECT v_secrets_count, v_total_recipients;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Update can_create_secret function to work without subscription_usage table
CREATE OR REPLACE FUNCTION public.can_create_secret(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_count INTEGER;
  v_max_secrets INTEGER;
BEGIN
  -- Get current usage
  SELECT secrets_count INTO v_current_count
  FROM public.calculate_user_usage(p_user_id);

  -- Get tier limits
  SELECT t.max_secrets INTO v_max_secrets
  FROM public.user_tiers ut
  JOIN public.tiers t ON ut.tier_id = t.id
  WHERE ut.user_id = p_user_id;

  -- If no tier record, use free tier default
  IF v_max_secrets IS NULL THEN
    v_max_secrets := 1;
  END IF;

  RETURN v_current_count < v_max_secrets;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Update get_user_tier function to work with new schema
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
    t.name as tier_name,
    t.max_secrets,
    t.max_recipients_per_secret,
    t.custom_intervals,
    COALESCE(us.status, 'active'::subscription_status) as subscription_status
  FROM public.user_tiers ut
  JOIN public.tiers t ON ut.tier_id = t.id
  LEFT JOIN public.user_subscriptions us ON ut.user_id = us.user_id
  WHERE ut.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Update initialize_free_tiers function
CREATE OR REPLACE FUNCTION public.initialize_free_tiers()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
  v_free_tier_id UUID;
  user_record RECORD;
BEGIN
  -- Get free tier ID
  SELECT id INTO v_free_tier_id FROM public.tiers WHERE name = 'free';

  IF v_free_tier_id IS NULL THEN
    RAISE EXCEPTION 'Free tier not found in tiers table';
  END IF;

  -- Add free tier for all existing users without tiers
  FOR user_record IN
    SELECT au.id as user_id
    FROM auth.users au
    LEFT JOIN public.user_tiers ut ON au.id = ut.user_id
    WHERE ut.user_id IS NULL
  LOOP
    INSERT INTO public.user_tiers (user_id, tier_id)
    SELECT
      user_record.user_id,
      t.id
    FROM public.tiers t
    WHERE t.name = 'free';

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Add trigger for tiers table
CREATE TRIGGER update_tiers_updated_at
    BEFORE UPDATE ON public.tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Step 12: Create a view for easy access to user tier information
CREATE OR REPLACE VIEW public.user_tier_info AS
SELECT
  u.id as user_id,
  u.email,
  t.name as tier_name,
  t.display_name as tier_display_name,
  t.max_secrets,
  t.max_recipients_per_secret,
  t.custom_intervals,
  t.price_monthly,
  t.price_yearly,
  us.status as subscription_status,
  us.provider,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end
FROM auth.users u
LEFT JOIN public.user_tiers ut ON u.id = ut.user_id
LEFT JOIN public.tiers t ON ut.tier_id = t.id
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id;

-- Step 13: Create a view for user usage information
CREATE OR REPLACE VIEW public.user_usage_info AS
SELECT
  u.id as user_id,
  u.email,
  t.name as tier_name,
  t.max_secrets,
  t.max_recipients_per_secret,
  (SELECT secrets_count FROM public.calculate_user_usage(u.id)) as current_secrets_count,
  (SELECT total_recipients FROM public.calculate_user_usage(u.id)) as current_total_recipients,
  (SELECT secrets_count FROM public.calculate_user_usage(u.id)) < t.max_secrets as can_create_secret
FROM auth.users u
LEFT JOIN public.user_tiers ut ON u.id = ut.user_id
LEFT JOIN public.tiers t ON ut.tier_id = t.id;

-- Step 14: Grant appropriate permissions
GRANT SELECT ON public.tiers TO authenticated;
GRANT SELECT ON public.user_tier_info TO authenticated;
GRANT SELECT ON public.user_usage_info TO authenticated;

-- Step 15: Add RLS policies for tiers table
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tiers are viewable by authenticated users" ON public.tiers
  FOR SELECT TO authenticated USING (true);

-- Step 16: Update RLS policies for user_tiers to work with new schema
DROP POLICY IF EXISTS "Users can view their own tier" ON public.user_tiers;
CREATE POLICY "Users can view their own tier" ON public.user_tiers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Step 17: Remove the old trigger that updates subscription_usage
DROP TRIGGER IF EXISTS update_usage_on_secret_change_trigger ON public.secrets;

-- Step 18: Drop the subscription_usage table (will be done in next migration to avoid breaking existing code)
-- DROP TABLE IF EXISTS public.subscription_usage;

-- Step 19: Drop old indexes that are no longer needed
-- DROP INDEX IF EXISTS idx_subscription_usage_user_id;
-- DROP INDEX IF EXISTS idx_user_subscriptions_paddle_subscription_id;
-- DROP INDEX IF EXISTS idx_user_subscriptions_paddle_customer_id;
-- DROP INDEX IF EXISTS idx_user_tiers_tier_name;

-- Step 20: RLS policies for all user data tables
-- user_subscriptions
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- secrets
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own secrets" ON public.secrets;
CREATE POLICY "Users can view their own secrets" ON public.secrets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
CREATE POLICY "Users can view their own reminders" ON public.reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_contact_methods
ALTER TABLE public.user_contact_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own contact methods" ON public.user_contact_methods;
CREATE POLICY "Users can view their own contact methods" ON public.user_contact_methods
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- checkin_history
ALTER TABLE public.checkin_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own checkin history" ON public.checkin_history;
CREATE POLICY "Users can view their own checkin history" ON public.checkin_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
