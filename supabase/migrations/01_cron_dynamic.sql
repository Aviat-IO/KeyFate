-- Dynamic Cron Jobs - Environment Agnostic
-- Uses a configuration table to store environment-specific settings
-- This avoids permission issues with ALTER DATABASE commands

-- Create configuration table for cron job settings
CREATE TABLE IF NOT EXISTS public.cron_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  project_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:54321',
  service_role_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_config_row CHECK (id = 1)
);

-- Enable RLS on the config table
ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

-- Only service role can manage cron configuration
CREATE POLICY "Service role can manage cron config"
  ON public.cron_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_cron_config_updated_at
    BEFORE UPDATE ON public.cron_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get environment-specific configuration
CREATE OR REPLACE FUNCTION get_cron_config()
RETURNS TABLE (
  base_url TEXT,
  auth_header TEXT
)
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  config_record RECORD;
BEGIN
  -- Get configuration from table
  SELECT project_url, service_role_key
  INTO config_record
  FROM public.cron_config
  WHERE id = 1;

  -- If no configuration exists, return defaults with null service key
  IF NOT FOUND THEN
    RAISE NOTICE 'No cron configuration found. Skipping cron job setup. Insert a row into cron_config table to enable cron jobs.';
    RETURN QUERY
    SELECT
      'http://127.0.0.1:54321'::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  -- If no service key is configured, return null auth header
  IF config_record.service_role_key IS NULL OR config_record.service_role_key = '' THEN
    RAISE NOTICE 'No service role key configured in cron_config table. Skipping cron job setup.';
    RETURN QUERY
    SELECT
      config_record.project_url,
      NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    config_record.project_url,
    format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}', config_record.service_role_key);
END;
$$ LANGUAGE plpgsql;

-- Dynamic cron job scheduling
DO $$
DECLARE
  config RECORD;
  check_secrets_url TEXT;
  process_reminders_url TEXT;
  headers_json TEXT;
BEGIN
  -- Get configuration
  SELECT * INTO config FROM get_cron_config();

  -- Check if configuration was successful (service key was provided)
  IF config.auth_header IS NULL THEN
    RAISE NOTICE 'Cron job configuration skipped due to missing service role key';
    RETURN;
  END IF;

  -- Build URLs
  check_secrets_url := config.base_url || '/functions/v1/check-secrets';
  process_reminders_url := config.base_url || '/functions/v1/process-reminders';
  headers_json := config.auth_header;

  -- Schedule check-secrets job
  PERFORM cron.schedule(
    'check-secrets',
    '* * * * *',  -- every minute
    format($job$
    SELECT
      net.http_post(
        url:='%s',
        headers:='%s'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $job$, check_secrets_url, headers_json)
  );

  -- Schedule process-reminders job
  PERFORM cron.schedule(
    'process-reminders',
    '*/5 * * * *',  -- every 5 minutes
    format($job$
    SELECT
      net.http_post(
        url:='%s',
        headers:='%s'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $job$, process_reminders_url, headers_json)
  );

  RAISE NOTICE 'Cron jobs scheduled for: %', config.base_url;
END;
$$;
