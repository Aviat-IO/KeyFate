-- Migration: Cleanup old subscription schema
-- This migration removes the old paddle-specific columns and subscription_usage table
-- after the main migration has been applied and tested

-- Step 1: Drop the subscription_usage table (no longer needed)
DROP TABLE IF EXISTS public.subscription_usage;

-- Step 2: Drop old paddle-specific columns from user_subscriptions
ALTER TABLE public.user_subscriptions
DROP COLUMN IF EXISTS paddle_subscription_id,
DROP COLUMN IF EXISTS paddle_customer_id;

-- Step 3: Drop old columns from user_tiers (keeping tier_name for backward compatibility during transition)
-- Note: We'll keep tier_name for now to avoid breaking existing code, but it should be removed in a future migration
-- ALTER TABLE public.user_tiers DROP COLUMN IF EXISTS tier_name;

-- Step 3.5: Remove denormalized columns from user_tiers (these should come from the tiers table)
ALTER TABLE public.user_tiers
DROP COLUMN IF EXISTS max_secrets,
DROP COLUMN IF EXISTS max_recipients_per_secret,
DROP COLUMN IF EXISTS custom_intervals,
DROP COLUMN IF EXISTS tier_name;

-- Step 4: Drop old indexes that are no longer needed
DROP INDEX IF EXISTS idx_subscription_usage_user_id;
DROP INDEX IF EXISTS idx_user_subscriptions_paddle_subscription_id;
DROP INDEX IF EXISTS idx_user_subscriptions_paddle_customer_id;
DROP INDEX IF EXISTS idx_user_tiers_tier_name;

-- Step 5: Add constraints to ensure data integrity
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT check_provider_not_null
CHECK (provider IS NOT NULL OR (provider_customer_id IS NULL AND provider_subscription_id IS NULL));

-- Step 6: Update the unique constraint on user_subscriptions to use provider columns
ALTER TABLE public.user_subscriptions
DROP CONSTRAINT IF EXISTS unique_user_subscription;

ALTER TABLE public.user_subscriptions
ADD CONSTRAINT unique_user_subscription
UNIQUE(user_id);

-- Step 7: Add unique constraints for provider-specific IDs
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT unique_provider_subscription_id
UNIQUE(provider, provider_subscription_id);

-- Step 8: Create a function to help migrate users to new provider columns
CREATE OR REPLACE FUNCTION public.migrate_user_subscription_provider(
  p_user_id UUID,
  p_provider TEXT,
  p_provider_customer_id TEXT DEFAULT NULL,
  p_provider_subscription_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET
    provider = p_provider,
    provider_customer_id = p_provider_customer_id,
    provider_subscription_id = p_provider_subscription_id
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create a function to get tier information by name
CREATE OR REPLACE FUNCTION public.get_tier_by_name(p_tier_name subscription_tier)
RETURNS TABLE (
  id UUID,
  name subscription_tier,
  display_name TEXT,
  max_secrets INTEGER,
  max_recipients_per_secret INTEGER,
  custom_intervals BOOLEAN,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2)
)
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.display_name,
    t.max_secrets,
    t.max_recipients_per_secret,
    t.custom_intervals,
    t.price_monthly,
    t.price_yearly
  FROM public.tiers t
  WHERE t.name = p_tier_name;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create a function to assign tier to user
CREATE OR REPLACE FUNCTION public.assign_user_tier(
  p_user_id UUID,
  p_tier_name subscription_tier
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tier_id UUID;
BEGIN
  -- Get tier ID
  SELECT id INTO v_tier_id
  FROM public.tiers
  WHERE name = p_tier_name;

  IF v_tier_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Insert or update user tier
  INSERT INTO public.user_tiers (user_id, tier_id)
  VALUES (p_user_id, v_tier_id)
  ON CONFLICT (user_id)
  DO UPDATE SET
    tier_id = EXCLUDED.tier_id,
    updated_at = CURRENT_TIMESTAMP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Grant permissions for new functions
GRANT EXECUTE ON FUNCTION public.migrate_user_subscription_provider(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_by_name(subscription_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_tier(UUID, subscription_tier) TO authenticated;

-- Step 12: Create a view for subscription management
CREATE OR REPLACE VIEW public.subscription_management AS
SELECT
  u.id as user_id,
  u.email,
  t.name as tier_name,
  t.display_name as tier_display_name,
  us.provider,
  us.provider_customer_id,
  us.provider_subscription_id,
  us.status as subscription_status,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  (SELECT secrets_count FROM public.calculate_user_usage(u.id)) as current_secrets_count,
  t.max_secrets,
  (SELECT total_recipients FROM public.calculate_user_usage(u.id)) as current_total_recipients,
  t.max_recipients_per_secret
FROM auth.users u
LEFT JOIN public.user_tiers ut ON u.id = ut.user_id
LEFT JOIN public.tiers t ON ut.tier_id = t.id
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id;

-- Step 13: Grant permissions for the new view
GRANT SELECT ON public.subscription_management TO authenticated;

-- Step 14: Add RLS policy for subscription management view
-- Note: Views don't support RLS policies directly, so we'll handle access control in the application layer
