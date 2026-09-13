-- Use a SQL-language function so return-column names never collide with
-- PL/pgSQL variables. Its public RPC signature remains unchanged.
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
language sql
stable
security definer
set search_path = ''
as $$
  with scope as (
    select
      case p_period when 'week' then date_trunc('week', now()) when 'month' then date_trunc('month', now()) else null end as current_start,
      case p_period when 'week' then date_trunc('week', now()) - interval '1 week' when 'month' then date_trunc('month', now()) - interval '1 month' else null end as previous_start,
      case p_period when 'week' then date_trunc('week', now()) when 'month' then date_trunc('month', now()) else null end as previous_end
    where p_period in ('week', 'month', 'total')
      and (select auth.uid()) is not null
      and exists (
        select 1 from public.circle_members as membership
        where membership.circle_id = p_circle_id and membership.user_id = (select auth.uid())
      )
  ), members as (
    select member.user_id, coalesce(profile.display_name, 'Learner ' || left(member.user_id::text, 8)) as member_display_name
    from public.circle_members as member
    left join public.profiles as profile on profile.id = member.user_id
    where member.circle_id = p_circle_id
  ), metrics as (
    select member.user_id, member.member_display_name,
      event.corrected_count, event.all_time_corrected_count, event.active_days, post.shared_count
    from members as member
    cross join scope
    cross join lateral (
      select
        count(correction.id) filter (where scope.current_start is null or correction.occurred_at >= scope.current_start)::integer as corrected_count,
        count(correction.id)::integer as all_time_corrected_count,
        count(distinct (correction.occurred_at at time zone 'UTC')::date)::integer as active_days
      from public.circle_correction_events as correction
      where correction.circle_id = p_circle_id and correction.user_id = member.user_id and correction.verified_at is not null
    ) as event
    cross join lateral (
      select count(post_row.id) filter (where scope.current_start is null or post_row.created_at >= scope.current_start)::integer as shared_count
      from public.circle_posts as post_row
      where post_row.circle_id = p_circle_id and post_row.author_id = member.user_id
    ) as post
  ), previous_metrics as (
    select member.user_id, count(correction.id)::integer as corrected_count
    from members as member
    cross join scope
    left join public.circle_correction_events as correction
      on correction.circle_id = p_circle_id and correction.user_id = member.user_id and correction.verified_at is not null
      and scope.previous_start is not null and correction.occurred_at >= scope.previous_start and correction.occurred_at < scope.previous_end
    group by member.user_id
  ), ranked as (
    select metric.*, row_number() over (order by metric.corrected_count desc, metric.active_days desc, lower(metric.member_display_name), metric.user_id)::integer as current_rank
    from metrics as metric
  ), previous_ranked as (
    select metric.*, row_number() over (order by metric.corrected_count desc, metric.user_id)::integer as previous_rank
    from previous_metrics as metric
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
  from ranked left join previous_ranked as previous on previous.user_id = ranked.user_id
  order by ranked.current_rank;
$$;

revoke all on function public.get_study_group_ranking(uuid, text) from public, anon;
grant execute on function public.get_study_group_ranking(uuid, text) to authenticated;
