-- Fix the reminders trigger to prevent transaction issues
-- Drop the existing trigger
DROP TRIGGER IF EXISTS schedule_reminders_trigger ON secrets;
DROP TRIGGER IF EXISTS schedule_reminders_update_trigger ON secrets;

-- Create a trigger that only fires on update
CREATE TRIGGER schedule_reminders_trigger
  AFTER UPDATE OF next_check_in, status ON secrets
  FOR EACH ROW
  WHEN (NEW.next_check_in IS NOT NULL AND NEW.status = 'active')
  EXECUTE FUNCTION schedule_reminders_on_secret_change();

-- Fix the schedule_reminders function to use schema-qualified table names
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
