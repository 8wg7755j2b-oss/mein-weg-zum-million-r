-- Campaign settings, public read-only access, admin editing and audit history.
-- Run once in the dedicated Supabase project's SQL Editor.

create table if not exists public.campaign_settings (
  id boolean primary key default true check (id = true),
  goal_amount numeric(12,2) not null default 1000000 check (goal_amount > 0),
  hero_intro text not null default 'Ich teile ein großes persönliches Ziel – den Aufbau eines Vermögens von einer Million Euro. Wer diesen Weg freiwillig unterstützen möchte, kann Teil der Reise werden.',
  purpose_text text not null default 'Vollständig offen: freiwillige Unterstützung meines persönlichen Vermögensaufbaus.',
  updated_at timestamptz not null default now()
);

insert into public.campaign_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.campaign_settings enable row level security;

grant select on public.campaign_settings to anon, authenticated;
grant update on public.campaign_settings to authenticated;

drop policy if exists "Public can read campaign settings" on public.campaign_settings;
create policy "Public can read campaign settings"
on public.campaign_settings for select
to anon, authenticated
using (id = true);

drop policy if exists "Admins update campaign settings" on public.campaign_settings;
create policy "Admins update campaign settings"
on public.campaign_settings for update
to authenticated
using (public.is_campaign_admin())
with check (public.is_campaign_admin());

grant select, insert, update on public.campaign_audit_log to authenticated;
grant select, insert, update, delete on public.campaign_updates to authenticated;
grant select, insert, update, delete on public.contributions to authenticated;

-- Verify the expected settings row exists.
select id, goal_amount, updated_at from public.campaign_settings where id = true;

-- Payment status for Stripe/PayPal is changed only by verified server-side webhooks.
create or replace function public.protect_external_payment_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.payment_provider in ('stripe', 'paypal')
     and new.payment_status is distinct from old.payment_status
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'External payment status can only be changed by a verified server-side webhook';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_external_payment_status on public.contributions;
create trigger protect_external_payment_status
before update on public.contributions
for each row execute function public.protect_external_payment_status();
