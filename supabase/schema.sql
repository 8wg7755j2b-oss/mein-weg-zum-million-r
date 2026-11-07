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

create or replace view public.public_campaign_totals as
select
  coalesce(sum(amount), 0)::numeric(12,2) as confirmed_total,
  count(*)::bigint as supporter_count
from public.contributions
where payment_status = 'confirmed';

create or replace view public.public_supporters as
select display_name, amount, confirmed_at as created_at
from public.contributions
where payment_status = 'confirmed'
  and publish_consent = true
  and nullif(trim(display_name), '') is not null;

-- IMPORTANT SECURITY TODO before launch:
-- Configure view access explicitly for your Supabase version and expose data
-- through a SECURITY INVOKER view or an Edge Function. Never grant anon access
-- to the underlying contributions table.
-- Create a private admin role / auth policy and server-side payment webhook
-- handlers before accepting any real payments.
