-- AI photo analysis follows the visible photo allowance: 5/day Free, 50/day Pro.
-- The old monthly column is deliberately retained so this migration preserves
-- the deployed schema and any future feature that still needs a monthly policy.

alter table public.ai_feature_limits add column if not exists daily_limit integer;

update public.ai_feature_limits
set daily_limit = coalesce(daily_limit, monthly_limit)
where daily_limit is null;

update public.ai_feature_limits
set daily_limit = case access_level when 'free' then 5 when 'pro' then 50 end
where feature = 'mistake_photo_analysis';

alter table public.ai_feature_limits alter column daily_limit set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_feature_limits_daily_limit_nonnegative'
      and conrelid = 'public.ai_feature_limits'::regclass
  ) then
    alter table public.ai_feature_limits
      add constraint ai_feature_limits_daily_limit_nonnegative check (daily_limit >= 0);
  end if;
end $$;

create or replace function public.reserve_ai_analysis(p_user_id uuid, p_request_id uuid, p_feature text, p_provider text, p_model text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_day timestamptz := date_trunc('day', now()); v_level text := 'free'; v_limit integer; v_minute integer; v_used integer; v_existing public.ai_analysis_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_day::text, 0));
  update public.ai_analysis_requests set status='failed',error_code='STALE_RESERVATION',completed_at=now() where user_id=p_user_id and status='pending' and created_at < now()-interval '2 minutes';
  select * into v_existing from public.ai_analysis_requests where user_id=p_user_id and feature=p_feature and request_id=p_request_id;
  if found then
    if exists(select 1 from public.subscription_entitlements where user_id=p_user_id and entitlement_id='pro' and active and (expires_at is null or expires_at > now())) then v_level := 'pro'; end if;
    select daily_limit into v_limit from public.ai_feature_limits where feature=p_feature and access_level=v_level;
    select count(*) into v_used from public.ai_usage_events where user_id=p_user_id and feature=p_feature and created_at>=v_day;
    return jsonb_build_object('state', v_existing.status, 'result', v_existing.result, 'used',v_used,'limit',v_limit,'remaining',greatest(v_limit-v_used,0));
  end if;
  if exists(select 1 from public.subscription_entitlements where user_id=p_user_id and entitlement_id='pro' and active and (expires_at is null or expires_at > now())) then v_level := 'pro'; end if;
  select daily_limit, per_minute_limit into v_limit, v_minute from public.ai_feature_limits where feature=p_feature and access_level=v_level;
  if v_limit is null then raise exception 'AI_FEATURE_NOT_CONFIGURED'; end if;
  select count(*) into v_used from public.ai_analysis_requests where user_id=p_user_id and feature=p_feature and status in ('pending','completed') and created_at >= v_day;
  if v_used >= v_limit then return jsonb_build_object('state','limit_reached','used',v_used,'limit',v_limit,'level',v_level); end if;
  if (select count(*) from public.ai_analysis_requests where user_id=p_user_id and created_at >= now()-interval '1 minute' and status in ('pending','completed')) >= v_minute then
    return jsonb_build_object('state','rate_limited');
  end if;
  insert into public.ai_analysis_requests(user_id,request_id,feature,provider,model,status) values(p_user_id,p_request_id,p_feature,p_provider,p_model,'pending');
  return jsonb_build_object('state','reserved','used',v_used,'limit',v_limit,'level',v_level);
end $$;

create or replace function public.complete_ai_analysis(p_user_id uuid, p_request_id uuid, p_feature text, p_result jsonb, p_input_tokens integer, p_image_tokens integer, p_output_tokens integer, p_estimated_cost numeric, p_mistake jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.ai_analysis_requests%rowtype; v_used integer; v_limit integer; v_level text := 'free'; v_day timestamptz := date_trunc('day', now());
begin
  select * into v_request from public.ai_analysis_requests where user_id=p_user_id and feature=p_feature and request_id=p_request_id for update;
  if not found then raise exception 'AI_RESERVATION_NOT_FOUND'; end if;
  if v_request.status='completed' then return jsonb_build_object('state','completed','result',v_request.result); end if;
  if v_request.status<>'pending' then raise exception 'AI_RESERVATION_NOT_PENDING'; end if;
  insert into public.ai_usage_events(user_id,feature,provider,model,request_id,input_tokens,image_tokens,output_tokens,estimated_cost_usd)
  values(p_user_id,p_feature,v_request.provider,v_request.model,p_request_id,p_input_tokens,p_image_tokens,p_output_tokens,p_estimated_cost)
  on conflict (user_id,feature,request_id) do nothing;
  insert into public.mistakes(user_id,subject,custom_subject,topic,note,error_type,mistake_summary,error_step,explanation,repair_rule,confidence,source,ai_request_id)
  values(p_user_id,p_mistake->>'subject',nullif(p_mistake->>'customSubject',''),nullif(p_mistake->>'topic',''),coalesce(p_mistake->>'note',''),nullif(p_mistake->>'errorType',''),nullif(p_mistake->>'mistakeSummary',''),nullif(p_mistake->>'errorStep',''),nullif(p_mistake->>'explanation',''),nullif(p_mistake->>'repairRule',''),nullif(p_mistake->>'confidence','')::numeric,'ai_photo',p_request_id)
  on conflict (user_id,ai_request_id) do nothing;
  update public.ai_analysis_requests set status='completed',result=p_result,completed_at=now() where id=v_request.id;
  if exists(select 1 from public.subscription_entitlements where user_id=p_user_id and active and (expires_at is null or expires_at>now())) then v_level:='pro'; end if;
  select daily_limit into v_limit from public.ai_feature_limits where feature=p_feature and access_level=v_level;
  select count(*) into v_used from public.ai_usage_events where user_id=p_user_id and feature=p_feature and created_at>=v_day;
  return jsonb_build_object('state','completed','result',p_result,'used',v_used,'limit',v_limit,'remaining',greatest(v_limit-v_used,0));
end $$;

revoke all on function public.reserve_ai_analysis(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.complete_ai_analysis(uuid,uuid,text,jsonb,integer,integer,integer,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_ai_analysis(uuid,uuid,text,text,text) to service_role;
grant execute on function public.complete_ai_analysis(uuid,uuid,text,jsonb,integer,integer,integer,numeric,jsonb) to service_role;
