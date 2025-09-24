-- Local PostgreSQL Schema Migration
-- Adapted from Supabase migration for local development
-- Removes Supabase-specific extensions and configurations

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Enable necessary extensions (compatible with standard PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
DROP TABLE IF EXISTS public.auth_users CASCADE;

-- Create auth_users table (simplified auth for local development)
CREATE TABLE IF NOT EXISTS public.auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
  ('pro', 'Pro', 10, 5, TRUE, 9.99, 99.00)
ON CONFLICT (name) DO NOTHING;

-- Create user_tiers table for user tier assignments
CREATE TABLE IF NOT EXISTS public.user_tiers (
  user_id UUID REFERENCES public.auth_users(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.tiers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, tier_id)
);

-- Create user_subscriptions table for subscription management
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.auth_users(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.tiers(id),
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create secrets table
CREATE TABLE IF NOT EXISTS public.secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.auth_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status secret_status NOT NULL DEFAULT 'active',
  interval_value INTEGER NOT NULL DEFAULT 30,
  interval_unit TEXT NOT NULL DEFAULT 'days',
  last_check_in TIMESTAMPTZ,
  next_check_in TIMESTAMPTZ,
  max_missed_checkins INTEGER NOT NULL DEFAULT 3,
  missed_checkins INTEGER NOT NULL DEFAULT 0,
  auto_extend_on_checkin BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create check_in_tokens table
CREATE TABLE IF NOT EXISTS public.check_in_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID REFERENCES public.secrets(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create user_contact_methods table
CREATE TABLE IF NOT EXISTS public.user_contact_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.auth_users(id) ON DELETE CASCADE,
  method contact_method NOT NULL,
  value TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create recipient_access_tokens table
CREATE TABLE IF NOT EXISTS public.recipient_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID REFERENCES public.secrets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create checkin_history table
CREATE TABLE IF NOT EXISTS public.checkin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID REFERENCES public.secrets(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  token_id UUID REFERENCES public.check_in_tokens(id)
);

-- Create reminders table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID REFERENCES public.secrets(id) ON DELETE CASCADE,
  type reminder_type NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status reminder_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.auth_users(id) ON DELETE CASCADE,
  secret_id UUID REFERENCES public.secrets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

-- Add updated_at triggers to all tables that need them
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON public.auth_users FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_tiers_updated_at BEFORE UPDATE ON public.tiers FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_secrets_updated_at BEFORE UPDATE ON public.secrets FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_user_contact_methods_updated_at BEFORE UPDATE ON public.user_contact_methods FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_secrets_user_id ON public.secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_secrets_status ON public.secrets(status);
CREATE INDEX IF NOT EXISTS idx_secrets_next_check_in ON public.secrets(next_check_in);
CREATE INDEX IF NOT EXISTS idx_check_in_tokens_secret_id ON public.check_in_tokens(secret_id);
CREATE INDEX IF NOT EXISTS idx_check_in_tokens_token ON public.check_in_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reminders_secret_id ON public.reminders(secret_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_for ON public.reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(status);
CREATE INDEX IF NOT EXISTS idx_recipient_access_tokens_secret_id ON public.recipient_access_tokens(secret_id);
CREATE INDEX IF NOT EXISTS idx_recipient_access_tokens_token ON public.recipient_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id ON public.user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_user_id ON public.user_contact_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_history_secret_id ON public.checkin_history(secret_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id ON public.admin_notifications(user_id);