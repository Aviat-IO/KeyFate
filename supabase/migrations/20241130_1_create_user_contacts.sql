-- Create user_contact_methods table
create table if not exists public.user_contact_methods (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    email text,
    phone text,
    telegram_username text,
    whatsapp text,
    signal text,
    preferred_method contact_method not null default 'email',
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    -- Ensure at least one contact method is provided
    constraint at_least_one_contact_method check (
        email is not null or
        phone is not null or
        telegram_username is not null or
        whatsapp is not null or
        signal is not null
    )
);

-- Add RLS policies
alter table public.user_contact_methods enable row level security;

create policy "Users can view their own contact methods"
    on public.user_contact_methods for select
    using (auth.uid() = user_id);

create policy "Users can insert their own contact methods"
    on public.user_contact_methods for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own contact methods"
    on public.user_contact_methods for update
    using (auth.uid() = user_id);

create policy "Users can delete their own contact methods"
    on public.user_contact_methods for delete
    using (auth.uid() = user_id);

-- Add updated_at trigger
create trigger update_user_contact_methods_updated_at
    before update on public.user_contact_methods
    for each row
    execute function public.update_updated_at_column();

-- Create unique constraint to ensure one record per user
create unique index user_contact_methods_user_id_key on public.user_contact_methods (user_id); 
