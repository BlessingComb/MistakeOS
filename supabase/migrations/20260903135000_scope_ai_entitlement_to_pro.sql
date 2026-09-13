-- Keep completion-time usage reporting aligned with reservation-time access:
-- only the explicit `pro` entitlement may select the Pro allowance.

create or replace function public.complete_ai_analysis(
  p_user_id uuid,
  p_request_id uuid,
  p_feature text,
  p_result jsonb,
  p_input_tokens integer,
  p_image_tokens integer,
  p_output_tokens integer,
  p_estimated_cost numeric,
  p_mistake jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.ai_analysis_requests%rowtype;
  v_used integer;
  v_limit integer;
  v_level text := 'free';
  v_day timestamptz := date_trunc('day', now());
begin
  select * into v_request
  from public.ai_analysis_requests
  where user_id = p_user_id and feature = p_feature and request_id = p_request_id
  for update;
  if not found then raise exception 'AI_RESERVATION_NOT_FOUND'; end if;
  if v_request.status = 'completed' then
    return jsonb_build_object('state', 'completed', 'result', v_request.result);
  end if;
  if v_request.status <> 'pending' then raise exception 'AI_RESERVATION_NOT_PENDING'; end if;

  insert into public.ai_usage_events(user_id, feature, provider, model, request_id, input_tokens, image_tokens, output_tokens, estimated_cost_usd)
  values(p_user_id, p_feature, v_request.provider, v_request.model, p_request_id, p_input_tokens, p_image_tokens, p_output_tokens, p_estimated_cost)
  on conflict (user_id, feature, request_id) do nothing;
  insert into public.mistakes(user_id, subject, custom_subject, topic, note, error_type, mistake_summary, error_step, explanation, repair_rule, confidence, source, ai_request_id)
  values(p_user_id, p_mistake->>'subject', nullif(p_mistake->>'customSubject', ''), nullif(p_mistake->>'topic', ''), coalesce(p_mistake->>'note', ''), nullif(p_mistake->>'errorType', ''), nullif(p_mistake->>'mistakeSummary', ''), nullif(p_mistake->>'errorStep', ''), nullif(p_mistake->>'explanation', ''), nullif(p_mistake->>'repairRule', ''), nullif(p_mistake->>'confidence', '')::numeric, 'ai_photo', p_request_id)
  on conflict (user_id, ai_request_id) do nothing;
  update public.ai_analysis_requests set status = 'completed', result = p_result, completed_at = now() where id = v_request.id;

  if exists (
    select 1 from public.subscription_entitlements
    where user_id = p_user_id and entitlement_id = 'pro' and active and (expires_at is null or expires_at > now())
  ) then v_level := 'pro'; end if;
  select daily_limit into v_limit from public.ai_feature_limits where feature = p_feature and access_level = v_level;
  select count(*) into v_used from public.ai_usage_events where user_id = p_user_id and feature = p_feature and created_at >= v_day;
  return jsonb_build_object('state', 'completed', 'result', p_result, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit-v_used, 0));
end;
$$;

revoke all on function public.complete_ai_analysis(uuid, uuid, text, jsonb, integer, integer, integer, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.complete_ai_analysis(uuid, uuid, text, jsonb, integer, integer, integer, numeric, jsonb) to service_role;
