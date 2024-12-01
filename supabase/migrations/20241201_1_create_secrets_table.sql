alter table secrets add column if not exists next_check_in timestamp with time zone;
alter table secrets add column if not exists is_triggered boolean default false;
alter table secrets add column if not exists triggered_at timestamp with time zone;
alter table secrets add column if not exists is_active boolean default true; 
