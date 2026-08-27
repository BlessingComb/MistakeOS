-- MistakeOS Phase 1: private learning data and server-enforced AI usage.
alter table public.profiles add column if not exists locale text not null default 'en' check (locale in ('en', 'pt-BR'));
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  subject text not null check (subject in ('mathematics','physics','chemistry','biology','languages','other')),
  custom_subject text check (custom_subject is null or char_length(custom_subject) between 1 and 80),
  topic text check (topic is null or char_length(topic) <= 120),
  note text not null default '',
  error_type text check (error_type is null or error_type in ('CONTENT_GAP','FORGOT_FORMULA','WRONG_FORMULA','CALCULATION','SIGN_ERROR','INTERPRETATION','CARELESSNESS','TIME_PRESSURE','STOPPED_EARLY','UNIT_ERROR','OTHER')),
  mistake_summary text,
  error_step text,
  explanation text,
  repair_rule text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null check (source in ('manual','ai_photo')),
  ai_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  unique (user_id, ai_request_id)
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  title text,
  exam_date date not null,
  subject text not null check (subject in ('mathematics','physics','chemistry','biology','languages','other')),
  topics text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create table public.recovery_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  mistake_id uuid references public.mistakes(id) on delete set null,
  topic text,
  targeted_error_type text,
  generator_type text not null default 'local' check (generator_type in ('local','ai')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, client_id)
);

create table public.recovery_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.recovery_sessions(id) on delete cascade,
  question_id text not null,
  correct boolean not null,
  pattern_resisted boolean not null,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table public.subscription_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entitlement_id text not null default 'pro' check (entitlement_id = 'pro'),
  active boolean not null default false,
  source text not null default 'revenuecat' check (source = 'revenuecat'),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.ai_feature_limits (
  feature text not null,
  access_level text not null check (access_level in ('free','pro')),
  monthly_limit integer not null check (monthly_limit >= 0),
  per_minute_limit integer not null default 5 check (per_minute_limit > 0),
  primary key (feature, access_level)
);
insert into public.ai_feature_limits(feature, access_level, monthly_limit, per_minute_limit)
values ('mistake_photo_analysis','free',5,5), ('mistake_photo_analysis','pro',100,10)
on conflict (feature, access_level) do update set monthly_limit = excluded.monthly_limit, per_minute_limit = excluded.per_minute_limit;

create table public.ai_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  feature text not null,
  provider text not null,
  model text not null,
  status text not null check (status in ('pending','completed','failed')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, feature, request_id)
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  provider text not null,
  model text not null,
  request_id uuid not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  image_tokens integer check (image_tokens is null or image_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(14,8) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, feature, request_id)
);

create index mistakes_user_created_idx on public.mistakes(user_id, created_at desc);
create index exams_user_date_idx on public.exams(user_id, exam_date);
create index recovery_sessions_user_idx on public.recovery_sessions(user_id, started_at desc);
create index recovery_answers_user_idx on public.recovery_answers(user_id, answered_at desc);
create index ai_usage_user_month_idx on public.ai_usage_events(user_id, created_at desc);
create index ai_usage_feature_month_idx on public.ai_usage_events(feature, created_at desc);
create index ai_requests_user_month_idx on public.ai_analysis_requests(user_id, created_at desc);

alter table public.mistakes enable row level security;
alter table public.exams enable row level security;
alter table public.recovery_sessions enable row level security;
alter table public.recovery_answers enable row level security;
alter table public.subscription_entitlements enable row level security;
alter table public.ai_feature_limits enable row level security;
alter table public.ai_analysis_requests enable row level security;
alter table public.ai_usage_events enable row level security;

revoke all on public.mistakes, public.exams, public.recovery_sessions, public.recovery_answers, public.subscription_entitlements, public.ai_feature_limits, public.ai_analysis_requests, public.ai_usage_events from anon, authenticated;
grant select, insert, update, delete on public.mistakes, public.exams, public.recovery_sessions, public.recovery_answers to authenticated;
grant select on public.subscription_entitlements, public.ai_analysis_requests, public.ai_usage_events to authenticated;

create policy "mistakes own select" on public.mistakes for select to authenticated using ((select auth.uid()) = user_id);
create policy "mistakes own insert" on public.mistakes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mistakes own update" on public.mistakes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mistakes own delete" on public.mistakes for delete to authenticated using ((select auth.uid()) = user_id);
create policy "exams own select" on public.exams for select to authenticated using ((select auth.uid()) = user_id);
create policy "exams own insert" on public.exams for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exams own update" on public.exams for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "exams own delete" on public.exams for delete to authenticated using ((select auth.uid()) = user_id);
create policy "recovery sessions own select" on public.recovery_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "recovery sessions own insert" on public.recovery_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recovery sessions own update" on public.recovery_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recovery answers own select" on public.recovery_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy "recovery answers own insert" on public.recovery_answers for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.recovery_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "recovery answers own update" on public.recovery_answers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.recovery_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "entitlements own select" on public.subscription_entitlements for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai requests own select" on public.ai_analysis_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai usage own select" on public.ai_usage_events for select to authenticated using ((select auth.uid()) = user_id);

-- These functions are privileged only because they serialize reservations and write immutable usage.
-- PUBLIC/anon/authenticated execute is revoked immediately; only the Edge Function service role may call them.
create or replace function public.reserve_ai_analysis(p_user_id uuid, p_request_id uuid, p_feature text, p_provider text, p_model text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_month timestamptz := date_trunc('month', now()); v_level text := 'free'; v_limit integer; v_minute integer; v_used integer; v_existing public.ai_analysis_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_month::text, 0));
  update public.ai_analysis_requests set status='failed',error_code='STALE_RESERVATION',completed_at=now() where user_id=p_user_id and status='pending' and created_at < now()-interval '2 minutes';
  select * into v_existing from public.ai_analysis_requests where user_id=p_user_id and feature=p_feature and request_id=p_request_id;
  if found then
    if exists(select 1 from public.subscription_entitlements where user_id=p_user_id and entitlement_id='pro' and active and (expires_at is null or expires_at > now())) then v_level := 'pro'; end if;
    select monthly_limit into v_limit from public.ai_feature_limits where feature=p_feature and access_level=v_level;
    select count(*) into v_used from public.ai_usage_events where user_id=p_user_id and feature=p_feature and created_at>=v_month;
    return jsonb_build_object('state', v_existing.status, 'result', v_existing.result, 'used',v_used,'limit',v_limit,'remaining',greatest(v_limit-v_used,0));
  end if;
  if exists(select 1 from public.subscription_entitlements where user_id=p_user_id and entitlement_id='pro' and active and (expires_at is null or expires_at > now())) then v_level := 'pro'; end if;
  select monthly_limit, per_minute_limit into v_limit, v_minute from public.ai_feature_limits where feature=p_feature and access_level=v_level;
  if v_limit is null then raise exception 'AI_FEATURE_NOT_CONFIGURED'; end if;
  select count(*) into v_used from public.ai_analysis_requests where user_id=p_user_id and feature=p_feature and status in ('pending','completed') and created_at >= v_month;
  if v_used >= v_limit then return jsonb_build_object('state','limit_reached','used',v_used,'limit',v_limit,'level',v_level); end if;
  if (select count(*) from public.ai_analysis_requests where user_id=p_user_id and created_at >= now()-interval '1 minute' and status in ('pending','completed')) >= v_minute then
    return jsonb_build_object('state','rate_limited');
  end if;
  insert into public.ai_analysis_requests(user_id,request_id,feature,provider,model,status) values(p_user_id,p_request_id,p_feature,p_provider,p_model,'pending');
  return jsonb_build_object('state','reserved','used',v_used,'limit',v_limit,'level',v_level);
end $$;

create or replace function public.complete_ai_analysis(p_user_id uuid, p_request_id uuid, p_feature text, p_result jsonb, p_input_tokens integer, p_image_tokens integer, p_output_tokens integer, p_estimated_cost numeric, p_mistake jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.ai_analysis_requests%rowtype; v_used integer; v_limit integer; v_level text := 'free';
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
  select monthly_limit into v_limit from public.ai_feature_limits where feature=p_feature and access_level=v_level;
  select count(*) into v_used from public.ai_usage_events where user_id=p_user_id and feature=p_feature and created_at>=date_trunc('month',now());
  return jsonb_build_object('state','completed','result',p_result,'used',v_used,'limit',v_limit,'remaining',greatest(v_limit-v_used,0));
end $$;

create or replace function public.fail_ai_analysis(p_user_id uuid, p_request_id uuid, p_feature text, p_error_code text)
returns void language sql security definer set search_path = '' as $$
  update public.ai_analysis_requests set status='failed',error_code=left(p_error_code,80),completed_at=now()
  where user_id=p_user_id and feature=p_feature and request_id=p_request_id and status='pending';
$$;

revoke all on function public.reserve_ai_analysis(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.complete_ai_analysis(uuid,uuid,text,jsonb,integer,integer,integer,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.fail_ai_analysis(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.reserve_ai_analysis(uuid,uuid,text,text,text) to service_role;
grant execute on function public.complete_ai_analysis(uuid,uuid,text,jsonb,integer,integer,integer,numeric,jsonb) to service_role;
grant execute on function public.fail_ai_analysis(uuid,uuid,text,text) to service_role;
