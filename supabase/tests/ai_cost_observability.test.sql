begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select no_plan();

-- A successful clean migration run must expose the evolved ledger and RPCs.
select has_table('public', 'ai_usage_events', 'AI usage ledger exists');
select has_column('public', 'ai_usage_events', 'route', 'route column exists');
select has_column('public', 'ai_usage_events', 'attempt', 'attempt column exists');
select has_column('public', 'ai_usage_events', 'latency_ms', 'latency column exists');
select has_column('public', 'ai_usage_events', 'success', 'success column exists');
select has_column('public', 'ai_usage_events', 'fallback_used', 'fallback column exists');
select has_column('public', 'ai_usage_events', 'error_code', 'sanitized error column exists');
select col_type_is('public', 'ai_usage_events', 'estimated_cost_usd', 'numeric(14,8)', 'cost precision remains numeric(14,8)');

select ok(
  to_regprocedure('public.record_ai_usage_event(uuid,text,text,text,text,uuid,smallint,integer,integer,numeric,integer,boolean,boolean,text)') is not null,
  'record_ai_usage_event exists'
);
select ok(
  to_regprocedure('public.complete_ai_analysis_observed(uuid,uuid,text,text,smallint,jsonb,integer,integer,integer,numeric,integer,boolean,jsonb)') is not null,
  'complete_ai_analysis_observed exists'
);
select ok(
  to_regprocedure('public.fail_ai_analysis_observed(uuid,uuid,text,text,smallint,integer,integer,numeric,integer,boolean,text)') is not null,
  'fail_ai_analysis_observed exists'
);

-- Raw technical cost data is inaccessible to client roles.
select ok(not has_table_privilege('anon', 'public.ai_usage_events', 'SELECT'), 'anon cannot select cost events');
select ok(not has_table_privilege('anon', 'public.ai_usage_events', 'INSERT'), 'anon cannot insert cost events');
select ok(not has_table_privilege('anon', 'public.ai_usage_events', 'UPDATE'), 'anon cannot update cost events');
select ok(not has_table_privilege('anon', 'public.ai_usage_events', 'DELETE'), 'anon cannot delete cost events');
select ok(not has_table_privilege('authenticated', 'public.ai_usage_events', 'SELECT'), 'authenticated cannot select cost events');
select ok(not has_table_privilege('authenticated', 'public.ai_usage_events', 'INSERT'), 'authenticated cannot insert cost events');
select ok(not has_table_privilege('authenticated', 'public.ai_usage_events', 'UPDATE'), 'authenticated cannot update cost events');
select ok(not has_table_privilege('authenticated', 'public.ai_usage_events', 'DELETE'), 'authenticated cannot delete cost events');

select ok(not has_function_privilege('anon', 'public.record_ai_usage_event(uuid,text,text,text,text,uuid,smallint,integer,integer,numeric,integer,boolean,boolean,text)', 'EXECUTE'), 'anon cannot record usage');
select ok(not has_function_privilege('authenticated', 'public.record_ai_usage_event(uuid,text,text,text,text,uuid,smallint,integer,integer,numeric,integer,boolean,boolean,text)', 'EXECUTE'), 'authenticated cannot choose a user id or record usage');
select ok(has_function_privilege('service_role', 'public.record_ai_usage_event(uuid,text,text,text,text,uuid,smallint,integer,integer,numeric,integer,boolean,boolean,text)', 'EXECUTE'), 'service_role can record usage');
select ok(not has_function_privilege('anon', 'public.complete_ai_analysis_observed(uuid,uuid,text,text,smallint,jsonb,integer,integer,integer,numeric,integer,boolean,jsonb)', 'EXECUTE'), 'anon cannot complete observed analysis');
select ok(not has_function_privilege('authenticated', 'public.complete_ai_analysis_observed(uuid,uuid,text,text,smallint,jsonb,integer,integer,integer,numeric,integer,boolean,jsonb)', 'EXECUTE'), 'authenticated cannot complete observed analysis');
select ok(has_function_privilege('service_role', 'public.complete_ai_analysis_observed(uuid,uuid,text,text,smallint,jsonb,integer,integer,integer,numeric,integer,boolean,jsonb)', 'EXECUTE'), 'service_role can complete observed analysis');
select ok(not has_function_privilege('anon', 'public.fail_ai_analysis_observed(uuid,uuid,text,text,smallint,integer,integer,numeric,integer,boolean,text)', 'EXECUTE'), 'anon cannot fail observed analysis');
select ok(not has_function_privilege('authenticated', 'public.fail_ai_analysis_observed(uuid,uuid,text,text,smallint,integer,integer,numeric,integer,boolean,text)', 'EXECUTE'), 'authenticated cannot fail observed analysis');
select ok(has_function_privilege('service_role', 'public.fail_ai_analysis_observed(uuid,uuid,text,text,smallint,integer,integer,numeric,integer,boolean,text)', 'EXECUTE'), 'service_role can fail observed analysis');

-- Technical fixture only. No real learner content is used in database tests.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ai-ledger-test@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

update public.ai_feature_limits
set daily_limit = 50, per_minute_limit = 100
where feature = 'mistake_photo_analysis' and access_level = 'free';

-- feature and route remain separate. Duplicate attempt writes are idempotent,
-- while a distinct fallback attempt can coexist under the same request_id.
insert into public.ai_analysis_requests(user_id, request_id, feature, provider, model, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'mistake_photo_analysis', 'groq', 'test-model', 'pending'
);

select public.record_ai_usage_event(
  '10000000-0000-4000-8000-000000000001', 'mistake_photo_analysis',
  'mistake_interpretation', 'groq', 'test-model',
  '20000000-0000-4000-8000-000000000001', 1, 10, 5, 0.00000123,
  120, false, false, 'AI_PROVIDER_ERROR'
);

create temporary table first_attempt_time as
select created_at
from public.ai_usage_events
where request_id = '20000000-0000-4000-8000-000000000001' and attempt = 1;

select public.record_ai_usage_event(
  '10000000-0000-4000-8000-000000000001', 'mistake_photo_analysis',
  'mistake_interpretation', 'groq', 'test-model',
  '20000000-0000-4000-8000-000000000001', 1, 10, 5, 0.00000123,
  125, false, false, 'AI_PROVIDER_ERROR'
);

select is(
  (select count(*)::integer from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000001' and attempt = 1),
  1,
  'a duplicate request_id and attempt is idempotent'
);
select is(
  (select created_at from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000001' and attempt = 1),
  (select created_at from first_attempt_time),
  'created_at does not change on conflict'
);
select is(
  (select feature from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000001' and attempt = 1),
  'mistake_photo_analysis',
  'feature keeps quota semantics'
);
select is(
  (select route from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000001' and attempt = 1),
  'mistake_interpretation',
  'route keeps technical observability semantics'
);

select public.record_ai_usage_event(
  '10000000-0000-4000-8000-000000000001', 'mistake_photo_analysis',
  'mistake_interpretation', 'groq', 'fallback-model',
  '20000000-0000-4000-8000-000000000001', 2, 11, 6, 0.00000150,
  90, true, true, null
);
select is(
  (select count(*)::integer from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000001'),
  2,
  'attempt 1 and attempt 2 coexist'
);

select throws_ok(
  $$select public.record_ai_usage_event(
    '10000000-0000-4000-8000-000000000001', 'mistake_photo_analysis',
    'ocr_local', 'local', 'device',
    '20000000-0000-4000-8000-000000000001', 3, null, null, 0,
    1, true, false, null
  )$$,
  'P0001', 'Invalid AI route', 'local OCR is rejected by the authoritative server ledger'
);
select throws_ok(
  $$select public.record_ai_usage_event(
    '10000000-0000-4000-8000-000000000001', 'mistake_photo_analysis',
    'mistake_interpretation', 'groq', 'test-model',
    '20000000-0000-4000-8000-000000000001', 3, null, null, null,
    1, false, false, 'raw provider message: private'
  )$$,
  'P0001', 'Invalid AI error code', 'raw provider error messages are rejected'
);

-- A failed logical request produces a cost attempt but does not increase the
-- completed-analysis quota.
insert into public.ai_analysis_requests(user_id, request_id, feature, provider, model, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'mistake_photo_analysis', 'groq', 'test-model', 'pending'
);
select public.fail_ai_analysis_observed(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'mistake_photo_analysis', 'mistake_interpretation', 1,
  null, null, null, 250, false, 'AI_PROVIDER_TIMEOUT'
);
select is(
  (
    public.reserve_ai_analysis(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000003',
      'mistake_photo_analysis', 'groq', 'test-model'
    )->>'used'
  )::integer,
  0,
  'a failed request does not increase daily quota'
);
create temporary table failed_request_retry as
select public.reserve_ai_analysis(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'mistake_photo_analysis', 'groq', 'test-model'
) as result;
select is(
  (select result->>'state' from failed_request_retry),
  'reserved',
  'a provider failure can retry the same logical request'
);
select is(
  (select (result->>'attempt')::integer from failed_request_retry),
  2,
  'a provider retry advances only the technical attempt'
);

-- Completion is one logical analysis even when the atomic completion RPC is
-- repeated with the same request_id and attempt.
insert into public.ai_analysis_requests(user_id, request_id, feature, provider, model, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004',
  'mistake_photo_analysis', 'groq', 'test-model', 'pending'
);
select public.complete_ai_analysis_observed(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004',
  'mistake_photo_analysis', 'mistake_interpretation', 1,
  '{"analysis":{"status":"identified"}}'::jsonb,
  20, null, 10, 0.00000200, 300, false,
  '{"subject":"mathematics","topic":"fixture","note":"fixture","errorType":"CALCULATION","mistakeSummary":"fixture","explanation":"fixture","repairRule":"fixture","confidence":"0.9"}'::jsonb
);
select public.complete_ai_analysis_observed(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004',
  'mistake_photo_analysis', 'mistake_interpretation', 1,
  '{"analysis":{"status":"identified"}}'::jsonb,
  20, null, 10, 0.00000200, 300, false,
  '{"subject":"mathematics","topic":"fixture","note":"fixture","errorType":"CALCULATION","mistakeSummary":"fixture","explanation":"fixture","repairRule":"fixture","confidence":"0.9"}'::jsonb
);
select is(
  (select count(*)::integer from public.ai_analysis_requests where request_id = '20000000-0000-4000-8000-000000000004' and status = 'completed'),
  1,
  'completed request exists exactly once'
);
select is(
  (select count(*)::integer from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000004'),
  1,
  'repeated completion does not duplicate usage'
);
select is(
  (select count(*)::integer from public.mistakes where ai_request_id = '20000000-0000-4000-8000-000000000004'),
  1,
  'repeated completion does not duplicate the corrected mistake'
);
select is(
  (
    public.reserve_ai_analysis(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000005',
      'mistake_photo_analysis', 'groq', 'test-model'
    )->>'used'
  )::integer,
  1,
  'completed logical analysis increases daily quota once'
);

-- Sequentially reproduces the state reached by two concurrent callers after
-- the advisory lock serializes them: one reservation and one pending response.
select is(
  public.reserve_ai_analysis(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    'mistake_photo_analysis', 'groq', 'test-model'
  )->>'state',
  'reserved',
  'first reservation owns the logical request'
);
select is(
  public.reserve_ai_analysis(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    'mistake_photo_analysis', 'groq', 'test-model'
  )->>'state',
  'pending',
  'second reservation with the same request_id does not create another analysis'
);
select is(
  (select count(*)::integer from public.ai_analysis_requests where request_id = '20000000-0000-4000-8000-000000000006'),
  1,
  'same request_id has one logical analysis row'
);

-- Failure while writing usage leaves the reservation pending and creates no
-- mistake or partial ledger row.
insert into public.ai_analysis_requests(user_id, request_id, feature, provider, model, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000007',
  'mistake_photo_analysis', 'groq', 'test-model', 'pending'
);
select throws_ok(
  $$select public.complete_ai_analysis_observed(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000007',
    'mistake_photo_analysis', 'ocr_local', 1, '{}'::jsonb,
    1, null, 1, 0.00000010, 10, false,
    '{"subject":"mathematics","note":"fixture"}'::jsonb
  )$$,
  'P0001', 'Invalid AI route', 'usage failure aborts atomic completion'
);
select is((select status from public.ai_analysis_requests where request_id = '20000000-0000-4000-8000-000000000007'), 'pending', 'usage failure leaves request pending');
select is((select count(*)::integer from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000007'), 0, 'usage failure leaves no ledger row');
select is((select count(*)::integer from public.mistakes where ai_request_id = '20000000-0000-4000-8000-000000000007'), 0, 'usage failure leaves no mistake');

-- Failure while writing the corrected mistake occurs after the usage insert;
-- PostgreSQL must roll the usage insert back with the whole RPC transaction.
insert into public.ai_analysis_requests(user_id, request_id, feature, provider, model, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000008',
  'mistake_photo_analysis', 'groq', 'test-model', 'pending'
);
select throws_ok(
  $$select public.complete_ai_analysis_observed(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000008',
    'mistake_photo_analysis', 'mistake_interpretation', 1, '{}'::jsonb,
    1, null, 1, 0.00000010, 10, false,
    '{"subject":"invalid-subject","note":"fixture"}'::jsonb
  )$$,
  '23514', null, 'mistake constraint failure aborts atomic completion'
);
select is((select status from public.ai_analysis_requests where request_id = '20000000-0000-4000-8000-000000000008'), 'pending', 'mistake failure leaves request pending');
select is((select count(*)::integer from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000008'), 0, 'mistake failure rolls usage back');
select is((select count(*)::integer from public.mistakes where ai_request_id = '20000000-0000-4000-8000-000000000008'), 0, 'mistake failure leaves no mistake');

-- Force the final request update to fail after both prior inserts. The entire
-- function call must still roll back.
insert into public.ai_analysis_requests(user_id, request_id, feature, provider, model, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000009',
  'mistake_photo_analysis', 'groq', 'test-model', 'pending'
);
create function public.pgtap_reject_observed_completion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.request_id = '20000000-0000-4000-8000-000000000009'::uuid and new.status = 'completed' then
    raise exception 'forced analysis update failure';
  end if;
  return new;
end;
$$;
create trigger pgtap_reject_observed_completion
before update on public.ai_analysis_requests
for each row execute function public.pgtap_reject_observed_completion();

select throws_ok(
  $$select public.complete_ai_analysis_observed(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000009',
    'mistake_photo_analysis', 'mistake_interpretation', 1, '{}'::jsonb,
    1, null, 1, 0.00000010, 10, false,
    '{"subject":"mathematics","note":"fixture"}'::jsonb
  )$$,
  'P0001', 'forced analysis update failure', 'analysis update failure aborts atomic completion'
);
select is((select status from public.ai_analysis_requests where request_id = '20000000-0000-4000-8000-000000000009'), 'pending', 'analysis update failure leaves request pending');
select is((select count(*)::integer from public.ai_usage_events where request_id = '20000000-0000-4000-8000-000000000009'), 0, 'analysis update failure rolls usage back');
select is((select count(*)::integer from public.mistakes where ai_request_id = '20000000-0000-4000-8000-000000000009'), 0, 'analysis update failure rolls mistake back');

drop trigger pgtap_reject_observed_completion on public.ai_analysis_requests;
drop function public.pgtap_reject_observed_completion();

select * from finish();
rollback;
