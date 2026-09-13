-- Recovery evidence used by group rankings must be generated server-side.
-- Existing rows and prior ranking events are intentionally left intact, but are
-- not counted until they have a server verification timestamp.

alter table public.recovery_sessions
  add column if not exists verified_at timestamptz;

alter table public.circle_correction_events
  add column if not exists verified_at timestamptz;

create index if not exists recovery_sessions_verified_idx
  on public.recovery_sessions(user_id, verified_at desc)
  where verified_at is not null;

create index if not exists circle_correction_events_verified_idx
  on public.circle_correction_events(circle_id, verified_at desc, user_id)
  where verified_at is not null;

-- The client may keep its local recovery history, but it cannot write cloud
-- evidence that affects a group ranking.
revoke insert, update on public.recovery_sessions from authenticated;
revoke insert, update on public.recovery_answers from authenticated;
drop policy if exists "recovery sessions own insert" on public.recovery_sessions;
drop policy if exists "recovery sessions own update" on public.recovery_sessions;
drop policy if exists "recovery answers own insert" on public.recovery_answers;
drop policy if exists "recovery answers own update" on public.recovery_answers;

create or replace function public.submit_verified_recovery(
  p_mistake_id uuid,
  p_client_id text,
  p_topic text,
  p_targeted_error_type text,
  p_selected_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid;
  v_correct_count integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_client_id is null or length(btrim(p_client_id)) between 1 and 160 is false then
    raise exception 'Invalid recovery id';
  end if;
  if p_selected_options is null or jsonb_typeof(p_selected_options) <> 'array' or jsonb_array_length(p_selected_options) <> 3 then
    raise exception 'Exactly three recovery answers are required';
  end if;
  if not exists (
    select 1
    from public.mistakes
    where id = p_mistake_id and user_id = v_user_id
  ) then
    raise exception 'Mistake not found';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(p_selected_options) as selection
    where selection ? 'questionId'
      and selection ? 'selectedOption'
      and selection ->> 'questionId' in ('same-skill', 'transfer', 'pattern-trap')
      and (selection ->> 'selectedOption') ~ '^[0-2]$'
  ) <> 3 or (
    select count(distinct selection ->> 'questionId')
    from jsonb_array_elements(p_selected_options) as selection
  ) <> 3 then
    raise exception 'Invalid recovery answers';
  end if;

  insert into public.recovery_sessions (
    user_id, client_id, mistake_id, topic, targeted_error_type,
    generator_type, started_at, completed_at, verified_at
  ) values (
    v_user_id, btrim(p_client_id), p_mistake_id, left(coalesce(p_topic, ''), 240),
    left(coalesce(p_targeted_error_type, ''), 120), 'local', v_now, v_now, v_now
  ) on conflict (user_id, client_id) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select id into v_session_id
    from public.recovery_sessions
    where user_id = v_user_id and client_id = btrim(p_client_id) and verified_at is not null;
    if v_session_id is null then
      raise exception 'Recovery id already exists';
    end if;
    select count(*) into v_correct_count
    from public.recovery_answers
    where session_id = v_session_id and correct and pattern_resisted;
    return jsonb_build_object('verified', true, 'correctCount', v_correct_count, 'duplicate', true);
  end if;

  insert into public.recovery_answers (
    user_id, session_id, question_id, correct, pattern_resisted, answered_at
  )
  select
    v_user_id,
    v_session_id,
    selection ->> 'questionId',
    (selection ->> 'selectedOption')::integer = 0,
    (selection ->> 'selectedOption')::integer = 0,
    v_now
  from jsonb_array_elements(p_selected_options) as selection;

  select count(*) into v_correct_count
  from public.recovery_answers
  where session_id = v_session_id and correct and pattern_resisted;

  if v_correct_count >= 2 then
    insert into public.circle_correction_events (
      circle_id, user_id, recovery_session_id, mistake_id, occurred_at, verified_at
    )
    select member.circle_id, v_user_id, v_session_id, p_mistake_id, v_now, v_now
    from public.circle_members as member
    where member.user_id = v_user_id
    on conflict do nothing;
  end if;

  return jsonb_build_object('verified', true, 'correctCount', v_correct_count, 'duplicate', false);
end;
$$;

-- This legacy entry point is retained only for compatibility. It can no longer
-- elevate a client-written recovery record into a group event.
create or replace function public.record_study_group_correction(p_recovery_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.recovery_sessions
    where id = p_recovery_session_id and user_id = v_user_id and verified_at is not null
  ) then
    raise exception 'Verified recovery session required';
  end if;
  return 0;
end;
$$;

create or replace function public.get_study_group_ranking(
  p_circle_id uuid,
  p_period text default 'week'
)
returns table (
  user_id uuid, display_name text, rank integer, previous_rank integer,
  rank_delta integer, corrected_count integer, shared_count integer,
  correction_rate numeric, answer_count integer, active_days integer,
  streak_days integer, all_time_corrected_count integer, distance_to_next_rank integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current_start timestamptz;
  v_previous_start timestamptz;
  v_previous_end timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_period not in ('week', 'month', 'total') then raise exception 'Unsupported ranking period'; end if;
  if not exists (
    select 1 from public.circle_members as membership
    where membership.circle_id = p_circle_id and membership.user_id = v_user_id
  ) then
    raise exception 'Circle membership required';
  end if;
  if p_period = 'week' then
    v_current_start := date_trunc('week', now()); v_previous_start := v_current_start - interval '1 week'; v_previous_end := v_current_start;
  elsif p_period = 'month' then
    v_current_start := date_trunc('month', now()); v_previous_start := v_current_start - interval '1 month'; v_previous_end := v_current_start;
  end if;

  return query
  with members as (
    select member.user_id, coalesce(profile.display_name, 'Learner ' || left(member.user_id::text, 8)) as member_display_name
    from public.circle_members member left join public.profiles profile on profile.id = member.user_id
    where member.circle_id = p_circle_id
  ), metrics as (
    select member.user_id, member.member_display_name,
      event.corrected_count, event.all_time_corrected_count, event.active_days,
      post.shared_count
    from members member
    cross join lateral (
      select
        count(id) filter (where v_current_start is null or occurred_at >= v_current_start)::integer as corrected_count,
        count(id)::integer as all_time_corrected_count,
        count(distinct (occurred_at at time zone 'UTC')::date)::integer as active_days
      from public.circle_correction_events
      where circle_id = p_circle_id and user_id = member.user_id and verified_at is not null
    ) event
    cross join lateral (
      select count(id) filter (where v_current_start is null or created_at >= v_current_start)::integer as shared_count
      from public.circle_posts
      where circle_id = p_circle_id and author_id = member.user_id
    ) post
  ), previous_metrics as (
    select member.user_id, count(event.id)::integer as corrected_count
    from members member left join public.circle_correction_events event
      on event.circle_id = p_circle_id and event.user_id = member.user_id and event.verified_at is not null
      and v_previous_start is not null and event.occurred_at >= v_previous_start and event.occurred_at < v_previous_end
    group by member.user_id
  ), ranked as (
    select metric.*, row_number() over (order by metric.corrected_count desc, metric.active_days desc, lower(metric.member_display_name), metric.user_id)::integer as current_rank
    from metrics metric
  ), previous_ranked as (
    select metric.*, row_number() over (order by metric.corrected_count desc, metric.user_id)::integer as previous_rank
    from previous_metrics metric
  )
  select ranked.user_id, ranked.member_display_name, ranked.current_rank,
    case when p_period = 'total' then null else previous.previous_rank end,
    case when p_period = 'total' then 0 else coalesce(previous.previous_rank - ranked.current_rank, 0) end,
    ranked.corrected_count, ranked.shared_count,
    case when ranked.corrected_count = 0 then 0::numeric else 100::numeric end,
    ranked.corrected_count * 3, ranked.active_days,
    case when ranked.active_days > 0 then 1 else 0 end,
    ranked.all_time_corrected_count,
    case when ranked.current_rank = 1 then 0 else 1 end
  from ranked left join previous_ranked previous on previous.user_id = ranked.user_id
  order by ranked.current_rank;
end;
$$;

revoke all on function public.submit_verified_recovery(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.submit_verified_recovery(uuid, text, text, text, jsonb) to authenticated;
revoke all on function public.record_study_group_correction(uuid) from public, anon, authenticated;
grant execute on function public.get_study_group_ranking(uuid, text) to authenticated;
