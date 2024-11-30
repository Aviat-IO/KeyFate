-- Create check-in history table
create table if not exists public.checkin_history (
    id uuid default gen_random_uuid() primary key,
    secret_id uuid references public.secrets(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    checked_in_at timestamp with time zone default now() not null,
    next_check_in timestamp with time zone not null
);

-- Add RLS policies
alter table public.checkin_history enable row level security;

create policy "Users can view their own check-in history"
    on public.checkin_history for select
    using (auth.uid() = user_id);

create policy "Users can insert their own check-in history"
    on public.checkin_history for insert
    with check (auth.uid() = user_id);

-- Create index for faster queries
create index checkin_history_secret_id_idx on public.checkin_history(secret_id);
create index checkin_history_user_id_idx on public.checkin_history(user_id); 
