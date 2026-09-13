-- Rankings are derived exclusively from a completed Never Again recovery.
-- The event table intentionally contains no question text, answers, photos, or
-- private mistake content. It is not writable from the client.
create table public.circle_correction_events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.study_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recovery_session_id uuid not null references public.recovery_sessions(id) on delete cascade,
  mistake_id uuid not null references public.mistakes(id) on delete cascade,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (circle_id, recovery_session_id),
  -- An error can become a verified correction once per group. Repeating the
  -- same recovery (or creating another recovery for the same error) cannot farm rank.
  unique (circle_id, mistake_id)
);

create index circle_correction_events_rank_idx
  on public.circle_correction_events(circle_id, occurred_at desc, user_id);
create index circle_correction_events_streak_idx
  on public.circle_correction_events(circle_id, user_id, occurred_at desc);
create index recovery_sessions_valid_correction_idx
  on public.recovery_sessions(user_id, mistake_id, completed_at desc)
  where completed_at is not null and mistake_id is not null;

alter table public.circle_correction_events enable row level security;

-- Only RPCs below can create or read derived correction evidence. A caller
-- cannot submit a corrected_count, date, or another member's identity.
revoke all on public.circle_correction_events from anon, authenticated;

create or replace function public.record_study_group_correction(p_recovery_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.recovery_sessions%rowtype;
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_session
  from public.recovery_sessions
  where id = p_recovery_session_id
    and user_id = v_user_id
    and completed_at is not null
    and completed_at >= started_at
    and mistake_id is not null;

  if v_session.id is null then
    raise exception 'Completed recovery session required';
  end if;

  -- Two correct, pattern-resisting answers are the existing Never Again
  -- completion threshold. The client may only submit a session id; this check
  -- reads the persisted evidence server-side.
  if (
    select count(*)
    from public.recovery_answers
    where session_id = v_session.id
      and user_id = v_user_id
      and correct
      and pattern_resisted
  ) < 2 then
    raise exception 'Valid recovery evidence required';
  end if;

  insert into public.circle_correction_events (
    circle_id,
    user_id,
    recovery_session_id,
    mistake_id,
    occurred_at
  )
  select
    member.circle_id,
    v_user_id,
    v_session.id,
    v_session.mistake_id,
    v_session.completed_at
  from public.circle_members as member
  where member.user_id = v_user_id
    -- A new member cannot add historic corrections to a group.
    and member.joined_at <= v_session.completed_at
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.get_study_group_ranking(
  p_circle_id uuid,
  p_period text default 'week'
)
returns table (
  user_id uuid,
  display_name text,
  rank integer,
  previous_rank integer,
  rank_delta integer,
  corrected_count integer,
  shared_count integer,
  correction_rate numeric,
  answer_count integer,
  active_days integer,
  streak_days integer,
  all_time_corrected_count integer,
  distance_to_next_rank integer
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
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_period not in ('week', 'month', 'total') then
    raise exception 'Unsupported ranking period';
  end if;
  if not exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = v_user_id
  ) then
    raise exception 'Circle membership required';
  end if;

  if p_period = 'week' then
    v_current_start := date_trunc('week', now());
    v_previous_start := v_current_start - interval '1 week';
    v_previous_end := v_current_start;
  elsif p_period = 'month' then
    v_current_start := date_trunc('month', now());
    v_previous_start := v_current_start - interval '1 month';
    v_previous_end := v_current_start;
  else
    v_current_start := null;
    v_previous_start := null;
    v_previous_end := null;
  end if;

  return query
  with members as (
    select
      member.user_id,
      member.joined_at,
      coalesce(profile.display_name, 'Learner ' || left(member.user_id::text, 8)) as member_display_name
    from public.circle_members as member
    left join public.profiles as profile on profile.id = member.user_id
    where member.circle_id = p_circle_id
  ),
  current_events as (
    select
      member.user_id,
      count(event.id)::integer as corrected_count,
      count(distinct (event.occurred_at at time zone 'UTC')::date)::integer as active_days
    from members as member
    left join public.circle_correction_events as event
      on event.circle_id = p_circle_id
      and event.user_id = member.user_id
      and (v_current_start is null or event.occurred_at >= v_current_start)
    group by member.user_id
  ),
  all_time_events as (
    select member.user_id, count(event.id)::integer as all_time_corrected_count
    from members as member
    left join public.circle_correction_events as event
      on event.circle_id = p_circle_id and event.user_id = member.user_id
    group by member.user_id
  ),
  current_answers as (
    select
      member.user_id,
      count(answer.id)::integer as answer_count,
      count(answer.id) filter (where answer.correct and answer.pattern_resisted)::integer as successful_answers
    from members as member
    left join public.recovery_sessions as session
      on session.user_id = member.user_id
      and session.completed_at is not null
      and session.mistake_id is not null
      and session.completed_at >= member.joined_at
      and (v_current_start is null or session.completed_at >= v_current_start)
    left join public.recovery_answers as answer
      on answer.session_id = session.id
      and answer.user_id = member.user_id
    group by member.user_id
  ),
  current_posts as (
    select member.user_id, count(post.id)::integer as shared_count
    from members as member
    left join public.circle_posts as post
      on post.circle_id = p_circle_id
      and post.author_id = member.user_id
      and (v_current_start is null or post.created_at >= v_current_start)
    group by member.user_id
  ),
  event_days as (
    select distinct event.user_id, (event.occurred_at at time zone 'UTC')::date as activity_day
    from public.circle_correction_events as event
    where event.circle_id = p_circle_id
      and event.occurred_at <= now()
  ),
  streak_groups as (
    select
      user_id,
      activity_day,
      activity_day + (row_number() over (partition by user_id order by activity_day desc))::integer as streak_group
    from event_days
  ),
  current_streaks as (
    select user_id, count(*)::integer as streak_days
    from streak_groups
    group by user_id, streak_group
    having max(activity_day) = (now() at time zone 'UTC')::date
  ),
  current_metrics as (
    select
      member.user_id,
      member.member_display_name,
      coalesce(event.corrected_count, 0) as corrected_count,
      coalesce(post.shared_count, 0) as shared_count,
      case when coalesce(answer.answer_count, 0) = 0 then 0
        else round((100.0 * answer.successful_answers / answer.answer_count)::numeric, 1)
      end as correction_rate,
      coalesce(answer.answer_count, 0) as answer_count,
      coalesce(event.active_days, 0) as active_days,
      coalesce(streak.streak_days, 0) as streak_days,
      coalesce(all_time.all_time_corrected_count, 0) as all_time_corrected_count
    from members as member
    left join current_events as event on event.user_id = member.user_id
    left join all_time_events as all_time on all_time.user_id = member.user_id
    left join current_answers as answer on answer.user_id = member.user_id
    left join current_posts as post on post.user_id = member.user_id
    left join current_streaks as streak on streak.user_id = member.user_id
  ),
  previous_events as (
    select member.user_id, count(event.id)::integer as corrected_count
    from members as member
    left join public.circle_correction_events as event
      on event.circle_id = p_circle_id
      and event.user_id = member.user_id
      and v_previous_start is not null
      and event.occurred_at >= v_previous_start
      and event.occurred_at < v_previous_end
    group by member.user_id
  ),
  previous_answers as (
    select
      member.user_id,
      count(answer.id)::integer as answer_count,
      count(answer.id) filter (where answer.correct and answer.pattern_resisted)::integer as successful_answers
    from members as member
    left join public.recovery_sessions as session
      on session.user_id = member.user_id
      and session.completed_at is not null
      and session.mistake_id is not null
      and session.completed_at >= member.joined_at
      and v_previous_start is not null
      and session.completed_at >= v_previous_start
      and session.completed_at < v_previous_end
    left join public.recovery_answers as answer on answer.session_id = session.id and answer.user_id = member.user_id
    group by member.user_id
  ),
  previous_metrics as (
    select
      member.user_id,
      coalesce(event.corrected_count, 0) as corrected_count,
      case when coalesce(answer.answer_count, 0) = 0 then 0
        else round((100.0 * answer.successful_answers / answer.answer_count)::numeric, 1)
      end as correction_rate,
      0::integer as active_days
    from members as member
    left join previous_events as event on event.user_id = member.user_id
    left join previous_answers as answer on answer.user_id = member.user_id
  ),
  current_ranked as (
    select
      metric.*,
      row_number() over (
        order by metric.corrected_count desc, metric.correction_rate desc, metric.active_days desc,
          lower(metric.member_display_name), metric.user_id
      )::integer as current_rank
    from current_metrics as metric
  ),
  previous_ranked as (
    select
      metric.user_id,
      row_number() over (
        order by metric.corrected_count desc, metric.correction_rate desc, metric.active_days desc, metric.user_id
      )::integer as previous_rank
    from previous_metrics as metric
  ),
  ranked_with_next as (
    select
      current_ranked.*,
      lag(corrected_count) over (order by current_rank) as ahead_corrected_count
    from current_ranked
  )
  select
    ranked.user_id,
    ranked.member_display_name as display_name,
    ranked.current_rank as rank,
    case when p_period = 'total' then null else previous.previous_rank end as previous_rank,
    case when p_period = 'total' then 0 else coalesce(previous.previous_rank - ranked.current_rank, 0) end as rank_delta,
    ranked.corrected_count,
    ranked.shared_count,
    ranked.correction_rate,
    ranked.answer_count,
    ranked.active_days,
    ranked.streak_days,
    ranked.all_time_corrected_count,
    case when ranked.current_rank = 1 then 0
      else greatest(1, coalesce(ranked.ahead_corrected_count, ranked.corrected_count) - ranked.corrected_count + 1)
    end::integer as distance_to_next_rank
  from ranked_with_next as ranked
  left join previous_ranked as previous on previous.user_id = ranked.user_id
  order by ranked.current_rank;
end;
$$;

revoke all on function public.record_study_group_correction(uuid) from public;
revoke all on function public.get_study_group_ranking(uuid, text) from public;
revoke all on function public.record_study_group_correction(uuid) from anon, authenticated;
revoke all on function public.get_study_group_ranking(uuid, text) from anon, authenticated;
grant execute on function public.record_study_group_correction(uuid), public.get_study_group_ranking(uuid, text) to authenticated;
