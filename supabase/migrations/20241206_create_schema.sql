-- Create schemas first
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage on extensions schema
REVOKE ALL ON SCHEMA extensions FROM public;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;

-- Create auth function
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb->>'sub')
  )::UUID
$$ LANGUAGE sql STABLE;

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

-- Create secrets table
CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
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
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_contact_methods_updated_at
    BEFORE UPDATE ON user_contact_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secrets_updated_at
    BEFORE UPDATE ON secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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
    UPDATE secrets
    SET last_check_in = p_checked_in_at,
        next_check_in = p_next_check_in
    WHERE id = p_secret_id
    AND user_id = p_user_id;

    -- Record the check-in history
    INSERT INTO checkin_history (
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
    UPDATE secrets
    SET status = p_new_status::secret_status,
        last_check_in = p_checked_in_at,
        next_check_in = p_next_check_in
    WHERE id = p_secret_id
    AND user_id = p_user_id;

    -- Record the check-in history
    INSERT INTO checkin_history (
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

-- Create function to schedule reminders for a secret
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
  FROM secrets
  WHERE id = p_secret_id;

  v_time_until_check_in := p_next_check_in - CURRENT_TIMESTAMP;

  -- Cancel any existing pending reminders
  UPDATE reminders
  SET status = 'cancelled'
  WHERE secret_id = p_secret_id
  AND status = 'pending';

  -- Schedule new reminders
  -- 25% of time remaining
  INSERT INTO reminders (secret_id, user_id, type, scheduled_for)
  VALUES (
    p_secret_id,
    v_user_id,
    '25_percent',
    p_next_check_in - (v_check_in_interval * 0.75)
  );

  -- 50% of time remaining
  INSERT INTO reminders (secret_id, user_id, type, scheduled_for)
  VALUES (
    p_secret_id,
    v_user_id,
    '50_percent',
    p_next_check_in - (v_check_in_interval * 0.5)
  );

  -- Fixed intervals
  IF v_time_until_check_in > '7 days'::INTERVAL THEN
    INSERT INTO reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '7_days', p_next_check_in - '7 days'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '3 days'::INTERVAL THEN
    INSERT INTO reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '3_days', p_next_check_in - '3 days'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '24 hours'::INTERVAL THEN
    INSERT INTO reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '24_hours', p_next_check_in - '24 hours'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '12 hours'::INTERVAL THEN
    INSERT INTO reminders (secret_id, user_id, type, scheduled_for)
    VALUES (p_secret_id, v_user_id, '12_hours', p_next_check_in - '12 hours'::INTERVAL);
  END IF;

  IF v_time_until_check_in > '1 hour'::INTERVAL THEN
    INSERT INTO reminders (secret_id, user_id, type, scheduled_for)
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
  FROM reminders
  WHERE id = p_reminder_id;

  -- Get secret title
  SELECT title INTO v_secret_title
  FROM secrets
  WHERE id = v_secret_id;

  -- Get user's email from user_contact_methods
  SELECT email INTO v_user_email
  FROM user_contact_methods
  WHERE user_id = (SELECT user_id FROM secrets WHERE id = v_secret_id)
  LIMIT 1;

  -- If we've reached max retries, mark as failed and notify admin
  IF v_retry_count >= 4 THEN -- 5 tries total (initial + 4 retries)
    UPDATE reminders
    SET 
      status = 'failed',
      error = p_error,
      last_retry_at = CURRENT_TIMESTAMP
    WHERE id = p_reminder_id;

    -- Insert admin notification
    INSERT INTO admin_notifications (
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
    UPDATE reminders
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
    INSERT INTO admin_notifications (
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

-- Create trigger to schedule reminders when a secret is created or updated
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

-- Create triggers
DROP TRIGGER IF EXISTS notify_failed_reminders_trigger ON reminders;
CREATE TRIGGER notify_failed_reminders_trigger
  AFTER UPDATE OF status ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION notify_failed_reminders();

DROP TRIGGER IF EXISTS schedule_reminders_trigger ON secrets;
CREATE TRIGGER schedule_reminders_trigger
  AFTER INSERT OR UPDATE OF next_check_in, status ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION schedule_reminders_on_secret_change();

-- Enable RLS on all tables
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for secrets
DROP POLICY IF EXISTS "Users can view their own secrets" ON public.secrets;
CREATE POLICY "Users can view their own secrets"
    ON public.secrets FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own secrets" ON public.secrets;
CREATE POLICY "Users can insert their own secrets"
    ON public.secrets FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own secrets" ON public.secrets;
CREATE POLICY "Users can update their own secrets"
    ON public.secrets FOR UPDATE
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own secrets" ON public.secrets;
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

-- Create indexes for efficient querying
CREATE INDEX idx_secrets_trigger_check 
ON secrets (status, is_triggered, next_check_in)
WHERE status = 'active' AND is_triggered = false;

CREATE INDEX idx_reminders_status_scheduled 
ON reminders (status, scheduled_for)
WHERE status = 'pending';

CREATE INDEX idx_reminders_secret_type 
ON reminders (secret_id, type);

CREATE INDEX idx_reminders_retry_count 
ON reminders (retry_count)
WHERE status = 'failed';

CREATE INDEX idx_reminders_user_email 
ON user_contact_methods (user_id)
WHERE email IS NOT NULL;

CREATE INDEX checkin_history_secret_id_idx 
ON checkin_history(secret_id);

CREATE INDEX checkin_history_user_id_idx 
ON checkin_history(user_id);

CREATE INDEX idx_admin_notifications_unacknowledged
ON admin_notifications (acknowledged_at)
WHERE acknowledged_at IS NULL;

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
