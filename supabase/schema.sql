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

-- Admin area: explicitly allowlisted Supabase Auth users only.
create table if not exists public.campaign_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.campaign_admins enable row level security;

create or replace function public.is_campaign_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_admins a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_campaign_admin() from public;
grant execute on function public.is_campaign_admin() to authenticated;

drop policy if exists "Admins can read own admin grant" on public.campaign_admins;
create policy "Admins can read own admin grant"
on public.campaign_admins for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins manage contributions" on public.contributions;
create policy "Admins manage contributions"
on public.contributions for all to authenticated
using (public.is_campaign_admin())
with check (public.is_campaign_admin());

drop policy if exists "Admins manage campaign updates" on public.campaign_updates;
create policy "Admins manage campaign updates"
on public.campaign_updates for all to authenticated
using (public.is_campaign_admin())
with check (public.is_campaign_admin());

create table if not exists public.campaign_audit_log (
  id bigint generated always as identity primary key,
  actor uuid not null default auth.uid() references auth.users(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.campaign_audit_log enable row level security;
drop policy if exists "Admins read audit log" on public.campaign_audit_log;
create policy "Admins read audit log"
on public.campaign_audit_log for select to authenticated
using (public.is_campaign_admin());
drop policy if exists "Admins write audit log" on public.campaign_audit_log;
create policy "Admins write audit log"
on public.campaign_audit_log for insert to authenticated
with check (public.is_campaign_admin());

-- Do not add an admin through the browser. After creating your Auth user,
-- grant access from the SQL Editor with:
-- insert into public.campaign_admins (user_id)
-- select id from auth.users where email = 'YOUR-LOGIN-EMAIL';
