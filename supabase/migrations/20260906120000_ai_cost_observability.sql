-- Extends the existing server-side AI usage ledger. It intentionally keeps
-- feature (quota semantics) separate from route (technical observability).

alter table public.ai_usage_events
  add column route text not null default 'mistake_interpretation',
  add column attempt smallint not null default 1 check (attempt > 0 and attempt <= 20),
  add column latency_ms integer check (latency_ms is null or latency_ms >= 0),
  add column success boolean not null default true,
  add column fallback_used boolean not null default false,
  add column error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,80}$');

alter table public.ai_usage_events
  add constraint ai_usage_events_route_allowed check (
    route in (
      'ocr_mathpix',
      'question_solver',
      'mistake_interpretation',
      'mistake_explanation',
      'practice_question_generation',
      'never_again_generation',
      'risk_score_analysis'
    )
  );

-- The legacy key allowed only one successful usage row per logical request.
-- The new key preserves request_id and supports server-side fallback attempts.
alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_user_id_feature_request_id_key;

create unique index ai_usage_events_request_attempt_unique
  on public.ai_usage_events(user_id, feature, route, request_id, attempt);

create index ai_usage_events_route_created_idx
  on public.ai_usage_events(route, created_at desc);

create index ai_usage_events_provider_model_created_idx
  on public.ai_usage_events(provider, model, created_at desc);

create index ai_usage_events_request_created_idx
  on public.ai_usage_events(request_id, created_at desc);

-- The existing user/created_at index already supports per-user and period
-- reporting. Do not duplicate it. Cost records are internal-only.
drop policy if exists "ai usage own select" on public.ai_usage_events;
revoke all on public.ai_usage_events from anon, authenticated;

-- Quota is one completed logical analysis, not one provider attempt. This is
-- necessary now that the ledger can include failed and fallback attempts.
create or replace function public.reserve_ai_analysis(
  p_user_id uuid,
  p_request_id uuid,
  p_feature text,
  p_provider text,
  p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day timestamptz := date_trunc('day', now());
  v_level text := 'free';
  v_limit integer;
  v_minute integer;
  v_used integer;
  v_attempt smallint;
  v_existing public.ai_analysis_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_day::text, 0));
  update public.ai_analysis_requests
  set status = 'failed', error_code = 'STALE_RESERVATION', completed_at = now()
  where user_id = p_user_id and status = 'pending' and created_at < now() - interval '2 minutes';

  select * into v_existing
  from public.ai_analysis_requests
  where user_id = p_user_id and feature = p_feature and request_id = p_request_id;

  if found then
    if exists (
      select 1 from public.subscription_entitlements
      where user_id = p_user_id and entitlement_id = 'pro' and active
        and (expires_at is null or expires_at > now())
    ) then v_level := 'pro'; end if;
    select daily_limit, per_minute_limit into v_limit, v_minute from public.ai_feature_limits where feature = p_feature and access_level = v_level;
    select count(*) into v_used from public.ai_analysis_requests
    where user_id = p_user_id and feature = p_feature and status = 'completed' and created_at >= v_day;
    if v_existing.status = 'failed' then
      if v_used >= v_limit then
        return jsonb_build_object('state', 'limit_reached', 'used', v_used, 'limit', v_limit, 'level', v_level);
      end if;
      if (
        select count(*) from public.ai_usage_events
        where user_id = p_user_id and created_at >= now() - interval '1 minute'
      ) >= v_minute then
        return jsonb_build_object('state', 'rate_limited');
      end if;
      select (coalesce(max(attempt), 0) + 1)::smallint into v_attempt
      from public.ai_usage_events
      where user_id = p_user_id and feature = p_feature and request_id = p_request_id;
      if v_attempt > 20 then return jsonb_build_object('state', 'rate_limited'); end if;
      update public.ai_analysis_requests
      set status = 'pending', provider = p_provider, model = p_model,
          error_code = null, completed_at = null
      where id = v_existing.id;
      return jsonb_build_object('state', 'reserved', 'attempt', v_attempt, 'used', v_used, 'limit', v_limit, 'level', v_level);
    end if;
    return jsonb_build_object('state', v_existing.status, 'result', v_existing.result, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0));
  end if;

  if exists (
    select 1 from public.subscription_entitlements
    where user_id = p_user_id and entitlement_id = 'pro' and active
      and (expires_at is null or expires_at > now())
  ) then v_level := 'pro'; end if;
  select daily_limit, per_minute_limit into v_limit, v_minute from public.ai_feature_limits where feature = p_feature and access_level = v_level;
  if v_limit is null then raise exception 'AI_FEATURE_NOT_CONFIGURED'; end if;
  select count(*) into v_used from public.ai_analysis_requests
  where user_id = p_user_id and feature = p_feature and status in ('pending', 'completed') and created_at >= v_day;
  if v_used >= v_limit then return jsonb_build_object('state', 'limit_reached', 'used', v_used, 'limit', v_limit, 'level', v_level); end if;
  if (
    select count(*) from public.ai_analysis_requests
    where user_id = p_user_id and created_at >= now() - interval '1 minute'
  ) >= v_minute then return jsonb_build_object('state', 'rate_limited'); end if;
  insert into public.ai_analysis_requests(user_id, request_id, feature, provider, model, status)
  values(p_user_id, p_request_id, p_feature, p_provider, p_model, 'pending');
  return jsonb_build_object('state', 'reserved', 'attempt', 1, 'used', v_used, 'limit', v_limit, 'level', v_level);
end;
$$;

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
    if exists (
      select 1 from public.subscription_entitlements
      where user_id = p_user_id and entitlement_id = 'pro' and active
        and (expires_at is null or expires_at > now())
    ) then v_level := 'pro'; end if;
    select daily_limit into v_limit from public.ai_feature_limits where feature = p_feature and access_level = v_level;
    select count(*) into v_used from public.ai_analysis_requests
    where user_id = p_user_id and feature = p_feature and status = 'completed' and created_at >= v_day;
    return jsonb_build_object('state', 'completed', 'result', v_request.result, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0));
  end if;
  if v_request.status <> 'pending' then raise exception 'AI_RESERVATION_NOT_PENDING'; end if;

  insert into public.ai_usage_events(
    user_id, feature, provider, model, request_id, input_tokens, image_tokens,
    output_tokens, estimated_cost_usd
  ) values (
    p_user_id, p_feature, v_request.provider, v_request.model, p_request_id,
    p_input_tokens, p_image_tokens, p_output_tokens, p_estimated_cost
  ) on conflict (user_id, feature, route, request_id, attempt) do nothing;

  insert into public.mistakes(user_id, subject, custom_subject, topic, note, error_type, mistake_summary, error_step, explanation, repair_rule, confidence, source, ai_request_id)
  values(p_user_id, p_mistake->>'subject', nullif(p_mistake->>'customSubject', ''), nullif(p_mistake->>'topic', ''), coalesce(p_mistake->>'note', ''), nullif(p_mistake->>'errorType', ''), nullif(p_mistake->>'mistakeSummary', ''), nullif(p_mistake->>'errorStep', ''), nullif(p_mistake->>'explanation', ''), nullif(p_mistake->>'repairRule', ''), nullif(p_mistake->>'confidence', '')::numeric, 'ai_photo', p_request_id)
  on conflict (user_id, ai_request_id) do nothing;

  update public.ai_analysis_requests
  set status = 'completed', result = p_result, completed_at = now()
  where id = v_request.id;
  if exists (
    select 1 from public.subscription_entitlements
    where user_id = p_user_id and entitlement_id = 'pro' and active
      and (expires_at is null or expires_at > now())
  ) then v_level := 'pro'; end if;
  select daily_limit into v_limit from public.ai_feature_limits where feature = p_feature and access_level = v_level;
  select count(*) into v_used from public.ai_analysis_requests
  where user_id = p_user_id and feature = p_feature and status = 'completed' and created_at >= v_day;
  return jsonb_build_object('state', 'completed', 'result', p_result, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0));
end;
$$;

revoke all on function public.reserve_ai_analysis(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_ai_analysis(uuid, uuid, text, jsonb, integer, integer, integer, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_ai_analysis(uuid, uuid, text, text, text) to service_role;
grant execute on function public.complete_ai_analysis(uuid, uuid, text, jsonb, integer, integer, integer, numeric, jsonb) to service_role;

create or replace function public.record_ai_usage_event(
  p_user_id uuid,
  p_feature text,
  p_route text,
  p_provider text,
  p_model text,
  p_request_id uuid,
  p_attempt smallint,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_usd numeric,
  p_latency_ms integer,
  p_success boolean,
  p_fallback_used boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_feature is null or char_length(btrim(p_feature)) not between 1 and 80 then
    raise exception 'Invalid AI feature';
  end if;
  if p_route not in (
    'ocr_mathpix', 'question_solver', 'mistake_interpretation',
    'mistake_explanation', 'practice_question_generation',
    'never_again_generation', 'risk_score_analysis'
  ) then
    raise exception 'Invalid AI route';
  end if;
  if p_provider is null or char_length(btrim(p_provider)) not between 1 and 80 then
    raise exception 'Invalid AI provider';
  end if;
  if p_model is null or char_length(btrim(p_model)) not between 1 and 160 then
    raise exception 'Invalid AI model';
  end if;
  if p_attempt is null or p_attempt < 1 or p_attempt > 20 then
    raise exception 'Invalid AI attempt';
  end if;
  if p_input_tokens is not null and p_input_tokens < 0 then raise exception 'Invalid input token count'; end if;
  if p_output_tokens is not null and p_output_tokens < 0 then raise exception 'Invalid output token count'; end if;
  if p_estimated_cost_usd is not null and p_estimated_cost_usd < 0 then raise exception 'Invalid estimated cost'; end if;
  if p_latency_ms is null or p_latency_ms < 0 then raise exception 'Invalid AI latency'; end if;
  if p_error_code is not null and p_error_code !~ '^[A-Z0-9_]{1,80}$' then
    raise exception 'Invalid AI error code';
  end if;

  -- A service role caller must still be recording an analysis it reserved.
  if not exists (
    select 1
    from public.ai_analysis_requests
    where user_id = p_user_id
      and feature = p_feature
      and request_id = p_request_id
  ) then
    raise exception 'AI reservation not found';
  end if;

  insert into public.ai_usage_events (
    user_id, feature, route, provider, model, request_id, attempt,
    input_tokens, output_tokens, estimated_cost_usd, latency_ms,
    success, fallback_used, error_code
  ) values (
    p_user_id, p_feature, p_route, btrim(p_provider), btrim(p_model),
    p_request_id, p_attempt, p_input_tokens, p_output_tokens,
    p_estimated_cost_usd, p_latency_ms, p_success, p_fallback_used,
    nullif(p_error_code, '')
  )
  on conflict (user_id, feature, route, request_id, attempt) do update set
    feature = excluded.feature,
    provider = excluded.provider,
    model = excluded.model,
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    estimated_cost_usd = excluded.estimated_cost_usd,
    latency_ms = excluded.latency_ms,
    success = excluded.success,
    fallback_used = excluded.fallback_used,
    error_code = excluded.error_code;
end;
$$;

revoke all on function public.record_ai_usage_event(
  uuid, text, text, text, text, uuid, smallint, integer, integer,
  numeric, integer, boolean, boolean, text
) from public, anon, authenticated;

grant execute on function public.record_ai_usage_event(
  uuid, text, text, text, text, uuid, smallint, integer, integer,
  numeric, integer, boolean, boolean, text
) to service_role;

-- New callers use these atomic wrappers. The legacy completion function above
-- remains available for already deployed Functions during a rolling release.
create or replace function public.complete_ai_analysis_observed(
  p_user_id uuid,
  p_request_id uuid,
  p_feature text,
  p_route text,
  p_attempt smallint,
  p_result jsonb,
  p_input_tokens integer,
  p_image_tokens integer,
  p_output_tokens integer,
  p_estimated_cost numeric,
  p_latency_ms integer,
  p_fallback_used boolean,
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
    if exists (
      select 1 from public.subscription_entitlements
      where user_id = p_user_id and entitlement_id = 'pro' and active
        and (expires_at is null or expires_at > now())
    ) then v_level := 'pro'; end if;
    select daily_limit into v_limit from public.ai_feature_limits where feature = p_feature and access_level = v_level;
    select count(*) into v_used from public.ai_analysis_requests
    where user_id = p_user_id and feature = p_feature and status = 'completed' and created_at >= v_day;
    return jsonb_build_object('state', 'completed', 'result', v_request.result, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0));
  end if;
  if v_request.status <> 'pending' then raise exception 'AI_RESERVATION_NOT_PENDING'; end if;

  perform public.record_ai_usage_event(
    p_user_id, p_feature, p_route, v_request.provider, v_request.model,
    p_request_id, p_attempt, p_input_tokens, p_output_tokens,
    p_estimated_cost, p_latency_ms, true, p_fallback_used, null
  );

  insert into public.mistakes(user_id, subject, custom_subject, topic, note, error_type, mistake_summary, error_step, explanation, repair_rule, confidence, source, ai_request_id)
  values(p_user_id, p_mistake->>'subject', nullif(p_mistake->>'customSubject', ''), nullif(p_mistake->>'topic', ''), coalesce(p_mistake->>'note', ''), nullif(p_mistake->>'errorType', ''), nullif(p_mistake->>'mistakeSummary', ''), nullif(p_mistake->>'errorStep', ''), nullif(p_mistake->>'explanation', ''), nullif(p_mistake->>'repairRule', ''), nullif(p_mistake->>'confidence', '')::numeric, 'ai_photo', p_request_id)
  on conflict (user_id, ai_request_id) do nothing;

  update public.ai_analysis_requests
  set status = 'completed', result = p_result, completed_at = now()
  where id = v_request.id;
  if exists (
    select 1 from public.subscription_entitlements
    where user_id = p_user_id and entitlement_id = 'pro' and active
      and (expires_at is null or expires_at > now())
  ) then v_level := 'pro'; end if;
  select daily_limit into v_limit from public.ai_feature_limits where feature = p_feature and access_level = v_level;
  select count(*) into v_used from public.ai_analysis_requests
  where user_id = p_user_id and feature = p_feature and status = 'completed' and created_at >= v_day;
  return jsonb_build_object('state', 'completed', 'result', p_result, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0));
end;
$$;

create or replace function public.fail_ai_analysis_observed(
  p_user_id uuid,
  p_request_id uuid,
  p_feature text,
  p_route text,
  p_attempt smallint,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost numeric,
  p_latency_ms integer,
  p_fallback_used boolean,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.ai_analysis_requests%rowtype;
begin
  select * into v_request
  from public.ai_analysis_requests
  where user_id = p_user_id and feature = p_feature and request_id = p_request_id
  for update;
  if not found then raise exception 'AI_RESERVATION_NOT_FOUND'; end if;
  if v_request.status <> 'pending' then return; end if;

  perform public.record_ai_usage_event(
    p_user_id, p_feature, p_route, v_request.provider, v_request.model,
    p_request_id, p_attempt, p_input_tokens, p_output_tokens,
    p_estimated_cost, p_latency_ms, false, p_fallback_used, p_error_code
  );
  update public.ai_analysis_requests
  set status = 'failed', error_code = left(p_error_code, 80), completed_at = now()
  where id = v_request.id;
end;
$$;

revoke all on function public.complete_ai_analysis_observed(uuid, uuid, text, text, smallint, jsonb, integer, integer, integer, numeric, integer, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ai_analysis_observed(uuid, uuid, text, text, smallint, integer, integer, numeric, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_ai_analysis_observed(uuid, uuid, text, text, smallint, jsonb, integer, integer, integer, numeric, integer, boolean, jsonb) to service_role;
grant execute on function public.fail_ai_analysis_observed(uuid, uuid, text, text, smallint, integer, integer, numeric, integer, boolean, text) to service_role;
