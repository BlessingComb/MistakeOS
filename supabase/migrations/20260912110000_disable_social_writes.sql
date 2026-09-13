-- Social is retained as historical data, but is no longer writable by app users.
-- RLS policies and existing rows remain intact; nothing is deleted or dropped.
revoke insert, update, delete on table
  public.study_circles,
  public.circle_members,
  public.circle_posts,
  public.circle_comments,
  public.circle_reactions
from authenticated;

revoke execute on function public.create_study_circle(text, text, text) from authenticated;
revoke execute on function public.preview_circle_by_code(text) from authenticated;
revoke execute on function public.join_circle_by_code(text) from authenticated;

-- A verified personal recovery remains valid. It simply no longer produces an
-- event for the retired social ranking system.
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
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_client_id is null or length(btrim(p_client_id)) between 1 and 160 is false then raise exception 'Invalid recovery id'; end if;
  if p_selected_options is null or jsonb_typeof(p_selected_options) <> 'array' or jsonb_array_length(p_selected_options) <> 3 then raise exception 'Exactly three recovery answers are required'; end if;
  if not exists (select 1 from public.mistakes where id = p_mistake_id and user_id = v_user_id) then raise exception 'Mistake not found'; end if;
  if (
    select count(*) from jsonb_array_elements(p_selected_options) as selection
    where selection ? 'questionId' and selection ? 'selectedOption'
      and selection ->> 'questionId' in ('same-skill', 'transfer', 'pattern-trap')
      and (selection ->> 'selectedOption') ~ '^[0-2]$'
  ) <> 3 or (
    select count(distinct selection ->> 'questionId') from jsonb_array_elements(p_selected_options) as selection
  ) <> 3 then raise exception 'Invalid recovery answers'; end if;

  insert into public.recovery_sessions (
    user_id, client_id, mistake_id, topic, targeted_error_type, generator_type, started_at, completed_at, verified_at
  ) values (
    v_user_id, btrim(p_client_id), p_mistake_id, left(coalesce(p_topic, ''), 240),
    left(coalesce(p_targeted_error_type, ''), 120), 'local', v_now, v_now, v_now
  ) on conflict (user_id, client_id) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select id into v_session_id from public.recovery_sessions
      where user_id = v_user_id and client_id = btrim(p_client_id) and verified_at is not null;
    if v_session_id is null then raise exception 'Recovery id already exists'; end if;
    select count(*) into v_correct_count from public.recovery_answers
      where session_id = v_session_id and correct and pattern_resisted;
    return jsonb_build_object('verified', true, 'correctCount', v_correct_count, 'duplicate', true);
  end if;

  insert into public.recovery_answers (user_id, session_id, question_id, correct, pattern_resisted, answered_at)
  select v_user_id, v_session_id, selection ->> 'questionId',
    (selection ->> 'selectedOption')::integer = 0, (selection ->> 'selectedOption')::integer = 0, v_now
  from jsonb_array_elements(p_selected_options) as selection;

  select count(*) into v_correct_count from public.recovery_answers
    where session_id = v_session_id and correct and pattern_resisted;
  return jsonb_build_object('verified', true, 'correctCount', v_correct_count, 'duplicate', false);
end;
$$;

revoke all on function public.submit_verified_recovery(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.submit_verified_recovery(uuid, text, text, text, jsonb) to authenticated;
