begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_table('public', 'practice_question_sources', 'practice sources are versioned separately from question content');
select has_table('public', 'practice_questions', 'practice questions table exists');
select has_table('public', 'practice_question_skill_links', 'practice question skills table exists');
select col_is_pk('public', 'practice_question_skill_links', array['question_id', 'skill_code'], 'a question has one mapping per canonical skill');
select col_type_is('public', 'practice_questions', 'correct_answer', 'text', 'answer key stays server-side');
select has_index('public', 'practice_questions', 'practice_questions_historical_source_number_idx', 'historical questions cannot be duplicated within a source');

select ok(not has_table_privilege('anon', 'public.practice_question_sources', 'SELECT'), 'anon cannot read question-source metadata directly');
select ok(not has_table_privilege('authenticated', 'public.practice_questions', 'SELECT'), 'authenticated cannot read answer-bearing questions directly');
select ok(not has_table_privilege('authenticated', 'public.practice_questions', 'INSERT'), 'authenticated cannot insert questions');
select ok(not has_table_privilege('authenticated', 'public.practice_question_skill_links', 'UPDATE'), 'authenticated cannot alter question-to-skill mappings');
select ok(has_table_privilege('service_role', 'public.practice_questions', 'INSERT'), 'only server-side service role may write questions');

select ok(to_regprocedure('public.get_practice_questions_for_skill(text,integer)') is not null, 'safe practice delivery RPC exists');
select ok(to_regprocedure('public.submit_practice_recovery(uuid,text,text,uuid[],text[])') is not null, 'safe practice submission RPC exists');
select ok(has_function_privilege('authenticated', 'public.get_practice_questions_for_skill(text,integer)', 'EXECUTE'), 'authenticated users may request their own authorized practice questions');
select ok(has_function_privilege('authenticated', 'public.submit_practice_recovery(uuid,text,text,uuid[],text[])', 'EXECUTE'), 'authenticated users may submit their own recovery answers');
select ok(not has_function_privilege('anon', 'public.get_practice_questions_for_skill(text,integer)', 'EXECUTE'), 'anon cannot request practice questions');
select ok(not has_function_privilege('anon', 'public.submit_practice_recovery(uuid,text,text,uuid[],text[])', 'EXECUTE'), 'anon cannot submit a practice recovery');

select alike(pg_get_functiondef('public.get_practice_questions_for_skill(text,integer)'::regprocedure), '%auth.uid()%','delivery RPC derives the learner from JWT identity');
select alike(pg_get_functiondef('public.get_practice_questions_for_skill(text,integer)'::regprocedure), '%q.catalog_version_id = v_catalog_id%','delivery RPC scopes questions to the current target');
select unalike(pg_get_functiondef('public.get_practice_questions_for_skill(text,integer)'::regprocedure), '%correct_answer%','delivery RPC never selects the answer key');
select alike(pg_get_functiondef('public.submit_practice_recovery(uuid,text,text,uuid[],text[])'::regprocedure), '%auth.uid()%','submission RPC derives the learner from JWT identity');
select alike(pg_get_functiondef('public.submit_practice_recovery(uuid,text,text,uuid[],text[])'::regprocedure), '%q.catalog_version_id = v_catalog_id%','submission RPC prevents cross-catalog question use');
select alike(pg_get_functiondef('public.submit_practice_recovery(uuid,text,text,uuid[],text[])'::regprocedure), '%question_skill.skill_code = p_skill_code%','submission RPC pins all questions to the requested canonical skill');
select alike(pg_get_functiondef('public.submit_practice_recovery(uuid,text,text,uuid[],text[])'::regprocedure), '%on conflict (user_id, client_id) do nothing%','submission retry is idempotent');
select alike(pg_get_functiondef('public.submit_practice_recovery(uuid,text,text,uuid[],text[])'::regprocedure), '%question.correct_answer = input.selected_answer%','server calculates correctness from the stored answer key');

select alike(pg_get_constraintdef(oid), '%practice%','practice recoveries join the existing verified-recovery system')
from pg_constraint where conrelid = 'public.recovery_sessions'::regclass and conname = 'recovery_sessions_generator_type_check';

select * from finish();
rollback;
