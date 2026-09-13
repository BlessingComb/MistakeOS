-- Makes RevenueCat delivery idempotent and prevents delayed events from
-- overwriting a newer entitlement state.

alter table public.subscription_entitlements
  add column if not exists revenuecat_event_id text,
  add column if not exists revenuecat_event_at timestamptz;

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_id text not null,
  event_at timestamptz not null,
  received_at timestamptz not null default now()
);

alter table public.revenuecat_webhook_events enable row level security;
revoke all on public.revenuecat_webhook_events from public, anon, authenticated;

create or replace function public.apply_revenuecat_entitlement_event(
  p_user_id uuid,
  p_event_id text,
  p_event_at timestamptz,
  p_active boolean,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_at timestamptz;
begin
  if p_event_id is null or length(btrim(p_event_id)) not between 1 and 200 then
    raise exception 'Invalid RevenueCat event';
  end if;
  insert into public.revenuecat_webhook_events(event_id, user_id, entitlement_id, event_at)
  values (btrim(p_event_id), p_user_id, 'pro', p_event_at)
  on conflict do nothing;
  if not found then return false; end if;

  select revenuecat_event_at into v_current_at
  from public.subscription_entitlements
  where user_id = p_user_id and entitlement_id = 'pro'
  for update;
  if v_current_at is not null and v_current_at > p_event_at then return false; end if;

  insert into public.subscription_entitlements (
    user_id, entitlement_id, active, source, expires_at, updated_at,
    revenuecat_event_id, revenuecat_event_at
  ) values (
    p_user_id, 'pro', p_active, 'revenuecat', p_expires_at, now(),
    btrim(p_event_id), p_event_at
  ) on conflict (user_id) do update set
    entitlement_id = excluded.entitlement_id,
    active = excluded.active,
    source = excluded.source,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at,
    revenuecat_event_id = excluded.revenuecat_event_id,
    revenuecat_event_at = excluded.revenuecat_event_at;
  return true;
end;
$$;

revoke all on function public.apply_revenuecat_entitlement_event(uuid, text, timestamptz, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_revenuecat_entitlement_event(uuid, text, timestamptz, boolean, timestamptz) to service_role;
