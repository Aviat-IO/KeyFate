-- Consolidated Schema Migration
-- Combines all schema changes from previous migrations
-- Environment-specific cron jobs handled separately

-- Create schemas first
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on extensions schema
REVOKE ALL ON SCHEMA extensions FROM public;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;

-- Create types
DROP TYPE IF EXISTS public.secret_status CASCADE;
CREATE TYPE public.secret_status AS ENUM ('active', 'paused', 'triggered');

DROP TYPE IF EXISTS public.contact_method CASCADE;
CREATE TYPE public.contact_method AS ENUM ('email', 'phone', 'both');

DROP TYPE IF EXISTS public.reminder_type CASCADE;
CREATE TYPE reminder_type AS ENUM (
  '25_percent',
  '50_percent',
  '7_days',
  '3_days',
  '24_hours',
  '12_hours',
  '1_hour'
);

DROP TYPE IF EXISTS public.reminder_status CASCADE;
CREATE TYPE reminder_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'cancelled'
);

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

-- Create updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create base tables first
DROP TABLE IF EXISTS public.secrets CASCADE;
DROP TABLE IF EXISTS public.reminders CASCADE;
DROP TABLE IF EXISTS public.admin_notifications CASCADE;
DROP TABLE IF EXISTS public.user_contact_methods CASCADE;
DROP TABLE IF EXISTS public.checkin_history CASCADE;
DROP TABLE IF EXISTS public.recipient_access_tokens CASCADE;
DROP TABLE IF EXISTS public.check_in_tokens CASCADE;
DROP TABLE IF EXISTS public.user_tiers CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.tiers CASCADE;

-- Create tiers table to define tier features
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

-- Insert default tier definitions
INSERT INTO public.tiers (name, display_name, max_secrets, max_recipients_per_secret, custom_intervals, price_monthly, price_yearly) VALUES
  ('free', 'Free', 1, 1, FALSE, 0.00, 0.00),
  ('pro', 'Pro', 10, 5, TRUE, 9.00, 90.00)
ON CONFLICT (name) DO NOTHING;

-- Create user_contact_methods table
CREATE TABLE user_contact_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  preferred_method contact_method NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create secrets table (with nullable server_share, iv, auth_tag from migration 20241207_allow_nullable_server_share)
CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    server_share TEXT, -- Made nullable for server share deletion functionality
    recipient_name TEXT NOT NULL,
    recipient_email TEXT,
    recipient_phone TEXT,
    contact_method contact_method NOT NULL,
    check_in_days INTEGER NOT NULL DEFAULT 90,
    last_check_in TIMESTAMPTZ,
    next_check_in TIMESTAMPTZ,
    status secret_status NOT NULL DEFAULT 'active',
    is_triggered BOOLEAN DEFAULT false,
    triggered_at TIMESTAMPTZ,
    iv TEXT, -- Made nullable for server share deletion functionality
    auth_tag TEXT, -- Made nullable for server share deletion functionality
    sss_shares_total INTEGER NOT NULL DEFAULT 3,
    sss_threshold INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add comment explaining nullable server_share
COMMENT ON COLUMN public.secrets.server_share IS 'Encrypted server share for Shamir Secret Sharing. When null, the secret is effectively disabled and should be paused.';

-- Create recipient_access_tokens table
CREATE TABLE public.recipient_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_id UUID NOT NULL REFERENCES public.secrets(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMPTZ,
    CONSTRAINT uq_secret_active_token UNIQUE (secret_id, used_at)
);

-- Create check_in_tokens table (from migration 20241212_add_checkin_tokens)
CREATE TABLE check_in_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create user_tiers table (normalized schema with tier_id references)
CREATE TABLE IF NOT EXISTS public.user_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.tiers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_tier UNIQUE(user_id)
);

-- Create user_subscriptions table (provider-agnostic schema)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  status subscription_status NOT NULL DEFAULT 'active',
  tier_name subscription_tier NOT NULL DEFAULT 'free',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_subscription UNIQUE(user_id),
  CONSTRAINT unique_provider_subscription_id UNIQUE(provider, provider_subscription_id),
  CONSTRAINT check_provider_not_null CHECK (provider IS NOT NULL OR (provider_customer_id IS NULL AND provider_subscription_id IS NULL))
);

-- Create reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type reminder_type NOT NULL,
  sent_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status reminder_status NOT NULL DEFAULT 'pending',
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_notifications table
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id)
);

-- Create checkin_history table
CREATE TABLE checkin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  checked_in_at TIMESTAMPTZ NOT NULL,
  next_check_in TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_recipient_access_tokens_token ON public.recipient_access_tokens(token);
CREATE INDEX idx_recipient_access_tokens_secret_id ON public.recipient_access_tokens(secret_id);
CREATE INDEX idx_recipient_access_tokens_expires_at ON public.recipient_access_tokens(expires_at);

CREATE INDEX idx_check_in_tokens_token ON check_in_tokens(token);

CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id ON public.user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tiers_tier_id ON public.user_tiers(tier_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider ON public.user_subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_customer_id ON public.user_subscriptions(provider_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_subscription_id ON public.user_subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

CREATE INDEX idx_secrets_trigger_check ON secrets (status, is_triggered, next_check_in) WHERE status = 'active' AND is_triggered = false;
CREATE INDEX idx_reminders_status_scheduled ON reminders (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_reminders_secret_type ON reminders (secret_id, type);
CREATE INDEX idx_reminders_retry_count ON reminders (retry_count) WHERE status = 'failed';
CREATE INDEX idx_reminders_user_email ON user_contact_methods (user_id) WHERE email IS NOT NULL;
CREATE INDEX checkin_history_secret_id_idx ON checkin_history(secret_id);
CREATE INDEX checkin_history_user_id_idx ON checkin_history(user_id);
CREATE INDEX idx_admin_notifications_unacknowledged ON admin_notifications (acknowledged_at) WHERE acknowledged_at IS NULL;

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_contact_methods_updated_at
    BEFORE UPDATE ON user_contact_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secrets_updated_at
    BEFORE UPDATE ON secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tiers_updated_at
    BEFORE UPDATE ON public.user_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tiers_updated_at
    BEFORE UPDATE ON public.tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create check-in function
CREATE OR REPLACE FUNCTION public.check_in_secret(
    p_secret_id UUID,
    p_user_id UUID,
    p_checked_in_at TIMESTAMPTZ,
    p_next_check_in TIMESTAMPTZ
) RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Update the secret
    UPDATE public.secrets
    SET last_check_in = p_checked_in_at,
        next_check_in = p_next_check_in
    WHERE id = p_secret_id
    AND user_id = p_user_id;

    -- Record the check-in history
    INSERT INTO public.checkin_history (
        secret_id,
        user_id,
        checked_in_at,
        next_check_in
    ) VALUES (
        p_secret_id,
        p_user_id,
        p_checked_in_at,
        p_next_check_in
    );
END;
$$ LANGUAGE plpgsql;

-- Create toggle-pause function
CREATE OR REPLACE FUNCTION public.toggle_secret_pause(
    p_secret_id UUID,
    p_user_id UUID,
    p_new_status TEXT,
    p_checked_in_at TIMESTAMPTZ,
    p_next_check_in TIMESTAMPTZ
) RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Update the secret status
    UPDATE public.secrets
    SET status = p_new_status::public.secret_status,
        last_check_in = p_checked_in_at,
        next_check_in = p_next_check_in
    WHERE id = p_secret_id
    AND user_id = p_user_id;

    -- Record the check-in history
    INSERT INTO public.checkin_history (
        secret_id,
        user_id,
        checked_in_at,
        next_check_in
    ) VALUES (
        p_secret_id,
        p_user_id,
        p_checked_in_at,
        p_next_check_in
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to schedule reminders for a secret (with fixes from 20241207143816_fix_reminders_trigger)
CREATE OR REPLACE FUNCTION public.schedule_secret_reminders(
  p_secret_id UUID,
  p_next_check_in TIMESTAMPTZ
) RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_check_in_interval INTERVAL;
  v_time_until_check_in INTERVAL;
BEGIN
  -- Get the user_id and calculate intervals
  SELECT user_id, (check_in_days || ' days')::INTERVAL
  INTO v_user_id, v_check_in_interval
  FROM public.secrets
  WHERE id = p_secret_id;

  v_time_until_check_in := p_next_check_in - CURRENT_TIMESTAMP;

  -- Cancel any existing pending reminders
  UPDATE public.reminders
  SET status = 'cancelled'
  WHERE secret_id = p_secret_id
  AND status = 'pending';

  -- Schedule new reminders
  -- 25% of time remaining
  INSERT INTO public.reminders (secret_id, user_id, type, scheduled_for)
  VALUES (
    p_secret_id,
    v_user_id,
    '25_percent',
    p_next_check_in - (v_check_in_interval * 0.75)
  );

  -- 50% of time remaining
  INSERT INTO public.reminders (secret_id, user_id, type, scheduled_for)
  VALUES (
    p_secret_id,
    v_user_id,
    '50_percent',
    p_next_check_in - (v_check_in_interval * 0.5)
  );

  -- Fixed intervals
  IF v_time_until_check_in > '7 days'::INTERVAL THEN
    INSERT INTO public.reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '7_days', p_next_check_in - '7 days'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '3 days'::INTERVAL THEN
    INSERT INTO public.reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '3_days', p_next_check_in - '3 days'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '24 hours'::INTERVAL THEN
    INSERT INTO public.reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '24_hours', p_next_check_in - '24 hours'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '12 hours'::INTERVAL THEN
    INSERT INTO public.reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '12_hours', p_next_check_in - '12 hours'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '1 hour'::INTERVAL THEN
    INSERT INTO public.reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '1_hour', p_next_check_in - '1 hour'::INTERVAL);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle failed reminders
CREATE OR REPLACE FUNCTION public.handle_failed_reminder(
  p_reminder_id UUID,
  p_error TEXT
) RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_retry_count INTEGER;
  v_secret_id UUID;
  v_secret_title TEXT;
  v_user_email TEXT;
BEGIN
  -- Get current retry count and secret info
  SELECT retry_count, secret_id
  INTO v_retry_count, v_secret_id
  FROM public.reminders
  WHERE id = p_reminder_id;

  -- Get secret title
  SELECT title INTO v_secret_title
  FROM public.secrets
  WHERE id = v_secret_id;

  -- Get user's email from user_contact_methods
  SELECT email INTO v_user_email
  FROM public.user_contact_methods
  WHERE user_id = (SELECT user_id FROM public.secrets WHERE id = v_secret_id)
  LIMIT 1;

  -- If we've reached max retries, mark as failed and notify admin
  IF v_retry_count >= 4 THEN -- 5 tries total (initial + 4 retries)
    UPDATE public.reminders
    SET
      status = 'failed',
      error = p_error,
      last_retry_at = CURRENT_TIMESTAMP
    WHERE id = p_reminder_id;

    -- Insert admin notification
    INSERT INTO public.admin_notifications (
      type,
      severity,
      title,
      message,
      metadata
    ) VALUES (
      'max_retries_reached',
      'error',
      'Maximum Retries Reached for Reminder',
      format(
        'Reminder for secret "%s" (user: %s) has failed after 5 attempts. Last error: %s',
        v_secret_title,
        v_user_email,
        p_error
      ),
      jsonb_build_object(
        'reminder_id', p_reminder_id,
        'secret_id', v_secret_id,
        'retry_count', v_retry_count + 1,
        'last_error', p_error,
        'user_email', v_user_email
      )
    );
  ELSE
    -- Increment retry count and update last retry time
    UPDATE public.reminders
    SET
      retry_count = retry_count + 1,
      last_retry_at = CURRENT_TIMESTAMP
    WHERE id = p_reminder_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to notify about failed reminders
CREATE OR REPLACE FUNCTION public.notify_failed_reminders()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'failed' THEN
    -- Insert into a notifications table for monitoring
    INSERT INTO public.admin_notifications (
      type,
      severity,
      title,
      message,
      metadata
    ) VALUES (
      'reminder_failed',
      'error',
      'Reminder Failed',
      format('Failed to send reminder for secret %s: %s', NEW.secret_id, NEW.error),
      jsonb_build_object(
        'reminder_id', NEW.id,
        'secret_id', NEW.secret_id,
        'error', NEW.error,
        'scheduled_for', NEW.scheduled_for
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle secret changes and schedule reminders
CREATE OR REPLACE FUNCTION public.schedule_reminders_on_secret_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only schedule reminders if next_check_in is set and the secret is active
  IF NEW.next_check_in IS NOT NULL AND NEW.status = 'active' THEN
    PERFORM public.schedule_secret_reminders(
      p_secret_id := NEW.id,
      p_next_check_in := NEW.next_check_in
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create check-in token function (with fix from 20250127_130000_fix_pgcrypto_function)
CREATE OR REPLACE FUNCTION create_check_in_token(
  p_secret_id UUID,
  p_expires_in INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS TEXT
SECURITY DEFINER
SET search_path = 'public'
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
  v_role TEXT;
BEGIN
  -- Get the current role
  SELECT current_setting('request.jwt.claims', true)::json->>'role' INTO v_role;

  -- Verify the caller has appropriate role
  IF v_role IS NULL OR v_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized. Only service_role can create check-in tokens.';
  END IF;

  -- Generate a secure random token using gen_random_bytes from public schema
  v_token := encode(public.gen_random_bytes(32), 'hex');

  -- Insert the token
  INSERT INTO public.check_in_tokens (
    secret_id,
    token,
    expires_at
  ) VALUES (
    p_secret_id,
    v_token,
    CURRENT_TIMESTAMP + p_expires_in
  );

  RETURN v_token;
END;
$$;

-- Subscription-related functions
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

-- Helper functions for subscription management
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

-- Create triggers
CREATE TRIGGER notify_failed_reminders_trigger
  AFTER UPDATE OF status ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION notify_failed_reminders();

-- Fixed reminders trigger (from 20241207143816_fix_reminders_trigger)
CREATE TRIGGER schedule_reminders_trigger
  AFTER UPDATE OF next_check_in, status ON secrets
  FOR EACH ROW
  WHEN (NEW.next_check_in IS NOT NULL AND NEW.status = 'active')
  EXECUTE FUNCTION schedule_reminders_on_secret_change();

-- Enable RLS on all tables
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for secrets
CREATE POLICY "Users can view their own secrets"
    ON public.secrets FOR SELECT
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own secrets"
    ON public.secrets FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own secrets"
    ON public.secrets FOR UPDATE
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own secrets"
    ON public.secrets FOR DELETE
    USING ((select auth.uid()) = user_id);

-- Create RLS policies for user_contact_methods
CREATE POLICY "Users can view their own contact methods"
ON user_contact_methods FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own contact methods"
ON user_contact_methods FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own contact methods"
ON user_contact_methods FOR UPDATE
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own contact methods"
ON user_contact_methods FOR DELETE
USING ((select auth.uid()) = user_id);

-- Create RLS policies for checkin_history
CREATE POLICY "Users can view their own checkin history"
ON checkin_history FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage checkin history"
ON checkin_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create RLS policies for reminders
CREATE POLICY "Users can view their own reminders"
ON reminders FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage all reminders"
ON reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can update their own reminders"
ON reminders FOR UPDATE
USING ((select auth.uid()) = user_id);

-- Create RLS policies for admin notifications
CREATE POLICY "Only super admins can view notifications"
ON admin_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = (select auth.uid())
    AND auth.users.is_super_admin = true
  )
);

CREATE POLICY "Only super admins can acknowledge notifications"
ON admin_notifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = (select auth.uid())
    AND auth.users.is_super_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = (select auth.uid())
    AND auth.users.is_super_admin = true
  )
);

CREATE POLICY "Service role can manage all notifications"
ON admin_notifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policies for recipient_access_tokens
CREATE POLICY "Service role can manage recipient tokens"
    ON public.recipient_access_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for check_in_tokens
CREATE POLICY "Users can view their own tokens"
  ON check_in_tokens
  FOR SELECT
  USING (
    secret_id IN (
      SELECT id FROM secrets WHERE user_id = (select auth.uid())
    )
  );

-- RLS Policies for user_tiers
CREATE POLICY "Users can view their own tier"
  ON public.user_tiers
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage all tiers"
  ON public.user_tiers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON public.user_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for tiers
CREATE POLICY "Tiers are viewable by authenticated users" ON public.tiers
  FOR SELECT TO authenticated USING (true);

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_check_in_token TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_secret(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_secret_pause(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_secret_reminders(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.migrate_user_subscription_provider(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_by_name(subscription_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_tier(UUID, subscription_tier) TO authenticated;
GRANT SELECT ON public.tiers TO authenticated;

-- Add is_super_admin column to auth.users if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth'
    AND table_name = 'users'
    AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create secure views for easy access to user information
-- These views use SECURITY INVOKER and only expose data for the authenticated user
CREATE OR REPLACE VIEW public.user_tier_info AS
SELECT
  auth.uid() as user_id,
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
FROM public.user_tiers ut
JOIN public.tiers t ON ut.tier_id = t.id
LEFT JOIN public.user_subscriptions us ON ut.user_id = us.user_id
WHERE ut.user_id = auth.uid();

CREATE OR REPLACE VIEW public.user_usage_info AS
SELECT
  auth.uid() as user_id,
  t.name as tier_name,
  t.max_secrets,
  t.max_recipients_per_secret,
  (SELECT secrets_count FROM public.calculate_user_usage(auth.uid())) as current_secrets_count,
  (SELECT total_recipients FROM public.calculate_user_usage(auth.uid())) as current_total_recipients,
  (SELECT secrets_count FROM public.calculate_user_usage(auth.uid())) < t.max_secrets as can_create_secret
FROM public.user_tiers ut
JOIN public.tiers t ON ut.tier_id = t.id
WHERE ut.user_id = auth.uid();

CREATE OR REPLACE VIEW public.subscription_management AS
SELECT
  auth.uid() as user_id,
  t.name as tier_name,
  t.display_name as tier_display_name,
  us.provider,
  us.provider_customer_id,
  us.provider_subscription_id,
  us.status as subscription_status,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  (SELECT secrets_count FROM public.calculate_user_usage(auth.uid())) as current_secrets_count,
  t.max_secrets,
  (SELECT total_recipients FROM public.calculate_user_usage(auth.uid())) as current_total_recipients,
  t.max_recipients_per_secret
FROM public.user_tiers ut
JOIN public.tiers t ON ut.tier_id = t.id
LEFT JOIN public.user_subscriptions us ON ut.user_id = us.user_id
WHERE ut.user_id = auth.uid();

-- Set views to SECURITY INVOKER after creation
ALTER VIEW public.user_tier_info SET (security_invoker = true);
ALTER VIEW public.user_usage_info SET (security_invoker = true);
ALTER VIEW public.subscription_management SET (security_invoker = true);

-- Grant permissions for views
GRANT SELECT ON public.user_tier_info TO authenticated;
GRANT SELECT ON public.user_usage_info TO authenticated;
GRANT SELECT ON public.subscription_management TO authenticated;

-- Initialize free tiers for existing users (this will handle new users after reset)
SELECT public.initialize_free_tiers();
