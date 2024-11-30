create type secret_status as enum ('active', 'paused', 'triggered');
create type contact_method as enum ('email', 'phone', 'both');

create table if not exists secrets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    message text not null,
    recipient_name text not null,
    recipient_email text,
    recipient_phone text,
    contact_method contact_method not null,
    check_in_interval interval not null, -- e.g., '7 days'
    last_check_in timestamp with time zone,
    next_check_in timestamp with time zone,
    status secret_status default 'active' not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- Add RLS policies
alter table secrets enable row level security;

create policy "Users can view their own secrets"
    on secrets for select
    using (auth.uid() = user_id);

create policy "Users can insert their own secrets"
    on secrets for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own secrets"
    on secrets for update
    using (auth.uid() = user_id);

create policy "Users can delete their own secrets"
    on secrets for delete
    using (auth.uid() = user_id);

-- Add updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_secrets_updated_at
    before update on secrets
    for each row
    execute function update_updated_at_column(); 
