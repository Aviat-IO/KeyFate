select cron.schedule(
  'check-dead-mans-switch',    -- name of the cron job
  '* * * * *',                -- every minute
  $$
  select
    net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/check-secrets',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
); 
