-- Create schemas first
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists public;

-- Enable necessary extensions
create extension if not exists "uuid-ossp" schema public;
create extension if not exists pgcrypto schema public;

-- Create auth function
create or replace function auth.uid() returns uuid as $$
  select coalesce(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb->>'sub')
  )::uuid
$$ language sql stable;

-- Create auth.users table if it doesn't exist
create table if not exists auth.users (
    id uuid primary key,
    email text unique not null,
    encrypted_password text,
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token text,
    confirmation_sent_at timestamp with time zone,
    recovery_token text,
    recovery_sent_at timestamp with time zone,
    email_change_token text,
    email_change text,
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text,
    phone_confirmed_at timestamp with time zone,
    phone_change text,
    phone_change_token text,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    deleted_at timestamp with time zone
);

-- Create types
drop type if exists public.secret_status cascade;
create type public.secret_status as enum ('active', 'paused', 'triggered');

drop type if exists public.contact_method cascade;
create type public.contact_method as enum ('email', 'phone', 'both');

-- Create secrets table
drop table if exists public.secrets cascade;
create table public.secrets (
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
alter table public.secrets enable row level security;

drop policy if exists "Users can view their own secrets" on public.secrets;
create policy "Users can view their own secrets"
    on public.secrets for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own secrets" on public.secrets;
create policy "Users can insert their own secrets"
    on public.secrets for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own secrets" on public.secrets;
create policy "Users can update their own secrets"
    on public.secrets for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete their own secrets" on public.secrets;
create policy "Users can delete their own secrets"
    on public.secrets for delete
    using (auth.uid() = user_id);

-- Add updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_secrets_updated_at on public.secrets;
create trigger update_secrets_updated_at
    before update on public.secrets
    for each row
    execute function public.update_updated_at_column(); 
