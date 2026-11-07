-- Initial schema for "Mein Weg zum Millionär".
-- Run in the SQL Editor of a NEW, dedicated Supabase project.
-- Never use a service-role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.campaign_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  payment_provider text not null check (payment_provider in ('stripe','paypal','bank_transfer','manual')),
  provider_reference text unique,
  payment_status text not null default 'pending' check (payment_status in ('pending','confirmed','failed','refunded','cancelled')),
  display_name text,
  publish_consent boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.campaign_updates enable row level security;
alter table public.contributions enable row level security;

-- Visitors may read published updates only.
drop policy if exists "Public can read published updates" on public.campaign_updates;
create policy "Public can read published updates"
on public.campaign_updates for select
to anon, authenticated
using (is_published = true);

-- No direct public reads or writes on contributions.
-- A server-side Edge Function / trusted backend must expose only aggregate totals
-- and supporters whose explicit consent is true. Payment confirmations must be
-- verified server-side using provider webhooks before status becomes confirmed.

-- Public read access is limited to two SECURITY DEFINER RPCs.
-- Their fixed search_path and narrow return columns prevent direct access to
-- private contribution records and expose supporter identity only after consent.
drop view if exists public.public_campaign_totals;
drop view if exists public.public_supporters;

create or replace function public.public_campaign_totals()
returns table (confirmed_total numeric, supporter_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(c.amount), 0)::numeric(12,2),
    count(*)::bigint
  from public.contributions as c
  where c.payment_status = 'confirmed';
$$;

create or replace function public.public_supporters()
returns table (display_name text, amount numeric, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.display_name, c.amount, c.confirmed_at
  from public.contributions as c
  where c.payment_status = 'confirmed'
    and c.publish_consent = true
    and nullif(trim(c.display_name), '') is not null
  order by c.confirmed_at desc
  limit 8;
$$;

revoke all on function public.public_campaign_totals() from public;
revoke all on function public.public_supporters() from public;
grant execute on function public.public_campaign_totals() to anon, authenticated;
grant execute on function public.public_supporters() to anon, authenticated;

-- IMPORTANT: These RPCs only read. No public insert/update policy exists.
-- Add server-side payment creation, verified provider webhooks, admin auth,
-- audit logging and tested authorization before enabling real contributions.
