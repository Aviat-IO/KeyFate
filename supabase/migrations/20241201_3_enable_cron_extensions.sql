-- Enable the required extensions
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Grant usage to postgres user (already done in hosted Supabase)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres; 
