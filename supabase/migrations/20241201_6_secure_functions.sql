-- Secure the check_in_secret function
alter function public.check_in_secret(
  p_secret_id uuid,
  p_user_id uuid,
  p_checked_in_at timestamp with time zone,
  p_next_check_in timestamp with time zone
)
  set search_path = '$user', 'public', 'extensions';

-- Secure the update_updated_at_column function
alter function public.update_updated_at_column()
  set search_path = '$user', 'public', 'extensions';

-- Update the cron job to use the correct schema
select cron.unschedule('check-dead-mans-switch');
select cron.schedule(
  'check-dead-mans-switch',
  '* * * * *',
  $$
  select
    extensions.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/check-secrets',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
