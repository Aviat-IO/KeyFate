-- Create a cron job to process reminders every 5 minutes
select cron.schedule(
  'process-reminders',         -- name of the cron job
  '*/5 * * * *',              -- every 5 minutes
  $$
  select
    net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/process-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Add monitoring for failed reminders
create or replace function notify_failed_reminders() returns trigger 
security definer 
set search_path = public
as $$
begin
  if NEW.status = 'failed' then
    -- Insert into a notifications table for monitoring
    insert into admin_notifications (
      type,
      severity,
      title,
      message,
      metadata
    ) values (
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

    -- You could also trigger other notifications here (e.g., admin email)
    perform net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/send-email',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:=jsonb_build_object(
        'to', current_setting('app.settings.admin_email'),
        'subject', 'Failed Reminder Alert',
        'html', format(
          'Failed to send reminder for secret %s<br>Error: %s<br>Scheduled for: %s',
          NEW.secret_id,
          NEW.error,
          NEW.scheduled_for
        )
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Create admin notifications table
create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null,
  title text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default current_timestamp,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id)
);

-- Create index for unacknowledged notifications
create index if not exists idx_admin_notifications_unacknowledged
  on admin_notifications (acknowledged_at)
  where acknowledged_at is null;

-- Create trigger for failed reminders
drop trigger if exists notify_failed_reminders_trigger on reminders;
create trigger notify_failed_reminders_trigger
  after update of status on reminders
  for each row
  execute function notify_failed_reminders(); 
