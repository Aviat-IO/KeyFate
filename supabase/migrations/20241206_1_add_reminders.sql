-- Drop existing reminders
DROP TABLE IF EXISTS reminders CASCADE;

-- Create reminder type enum
CREATE TYPE reminder_type AS ENUM (
  '25_percent',
  '50_percent',
  '7_days',
  '3_days',
  '24_hours',
  '12_hours',
  '1_hour'
);

-- Create reminder status enum
CREATE TYPE reminder_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'cancelled'
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

-- Create indexes for efficient querying
CREATE INDEX idx_reminders_status_scheduled ON reminders (status, scheduled_for)
WHERE status = 'pending';

CREATE INDEX idx_reminders_secret_type ON reminders (secret_id, type);

-- Create function to schedule reminders for a secret
CREATE OR REPLACE FUNCTION schedule_secret_reminders(
  p_secret_id UUID,
  p_next_check_in TIMESTAMPTZ
) RETURNS void AS $$
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
CREATE OR REPLACE FUNCTION handle_failed_reminder(
  p_reminder_id UUID,
  p_error TEXT
) RETURNS void AS $$
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

-- Create admin notifications table
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

-- Create index for unacknowledged notifications
CREATE INDEX idx_admin_notifications_unacknowledged
  ON admin_notifications (acknowledged_at)
  WHERE acknowledged_at IS NULL;

-- Create trigger for failed reminders
DROP TRIGGER IF EXISTS notify_failed_reminders_trigger ON reminders;
CREATE TRIGGER notify_failed_reminders_trigger
  AFTER UPDATE OF status ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION notify_failed_reminders();

-- Create trigger to schedule reminders when a secret is created or updated
CREATE OR REPLACE FUNCTION schedule_reminders_on_secret_change() RETURNS TRIGGER AS $$
BEGIN
  -- Only schedule reminders if next_check_in is set and the secret is active
  IF NEW.next_check_in IS NOT NULL AND NEW.status = 'active' THEN
    PERFORM schedule_secret_reminders(NEW.id, NEW.next_check_in);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_reminders_trigger ON secrets;
CREATE TRIGGER schedule_reminders_trigger
  AFTER INSERT OR UPDATE OF next_check_in, status ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION schedule_reminders_on_secret_change();

-- Secure the functions
ALTER FUNCTION schedule_secret_reminders(UUID, TIMESTAMPTZ) SET search_path = '$user', 'public', 'extensions';
ALTER FUNCTION handle_failed_reminder(UUID, TEXT) SET search_path = '$user', 'public', 'extensions'; 
