-- Run this migration in the Supabase SQL Editor for the existing campaign project.
-- It adds the secure allowlisted admin dashboard to the original campaign schema.

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
with check (public.is_campaign_admin() and actor = auth.uid());

-- After creating your own login under Authentication > Users, grant admin:
-- insert into public.campaign_admins (user_id)
-- select id from auth.users where email = 'YOUR-LOGIN-EMAIL';
