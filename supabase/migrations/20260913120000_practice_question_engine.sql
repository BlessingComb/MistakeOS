-- Local-only foundation for validated SIS/PSC practice questions.
-- Historical text is not seeded while source rights remain under review.
create table public.practice_question_sources (
  id uuid primary key default gen_random_uuid(), institution text not null,
  program_code text not null references public.exam_programs(code) on delete restrict,
  stage text not null, exam_year integer not null check (exam_year between 2000 and 2200),
  title text not null, official_url text not null check (official_url ~ '^https://'),
  source_format text not null check (source_format in ('pdf','html','other')),
  rights_status text not null default 'review_required' check (rights_status in ('review_required','cleared','restricted')),
  created_at timestamptz not null default now(), unique (program_code, stage, exam_year, official_url)
);
create table public.practice_questions (
  id uuid primary key default gen_random_uuid(),
  catalog_version_id uuid not null references public.exam_catalog_versions(id) on delete restrict,
  source_id uuid references public.practice_question_sources(id) on delete restrict,
  source_type text not null check (source_type in ('historical','generated')),
  source_question_number integer check (source_question_number is null or source_question_number > 0),
  statement text not null check (char_length(btrim(statement)) between 1 and 12000),
  alternatives jsonb not null check (jsonb_typeof(alternatives) = 'array' and jsonb_array_length(alternatives) between 2 and 5),
  correct_answer text not null check (correct_answer ~ '^[A-E]$'),
  explanation text not null check (char_length(btrim(explanation)) between 1 and 6000),
  difficulty_profile jsonb not null default '{}'::jsonb check (jsonb_typeof(difficulty_profile) = 'object'),
  validation_status text not null default 'draft' check (validation_status in ('draft','validated','rejected')),
  validated_at timestamptz, validation_note text check (validation_note is null or char_length(validation_note) <= 1000),
  generated_request_id uuid unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((source_type = 'historical') = (source_id is not null)),
  check (validation_status <> 'validated' or validated_at is not null)
);
create unique index practice_questions_historical_source_number_idx on public.practice_questions(source_id, source_question_number) where source_type = 'historical';
create index practice_questions_catalog_validated_idx on public.practice_questions(catalog_version_id, validation_status, source_type, created_at desc);
create table public.practice_question_skill_links (
  question_id uuid not null references public.practice_questions(id) on delete cascade,
  skill_code text not null references public.curriculum_skills(code) on delete restrict,
  mapping_confidence numeric(5,4) not null check (mapping_confidence >= 0 and mapping_confidence <= 1),
  mapping_method text not null check (mapping_method in ('human_review','deterministic')),
  created_at timestamptz not null default now(), primary key (question_id, skill_code)
);
create index practice_question_skill_links_skill_idx on public.practice_question_skill_links(skill_code, question_id);

alter table public.recovery_sessions drop constraint if exists recovery_sessions_generator_type_check;
alter table public.recovery_sessions add constraint recovery_sessions_generator_type_check check (generator_type in ('local','ai','practice'));
alter table public.practice_question_sources enable row level security;
alter table public.practice_questions enable row level security;
alter table public.practice_question_skill_links enable row level security;
revoke all on public.practice_question_sources, public.practice_questions, public.practice_question_skill_links from anon, authenticated;
grant all on public.practice_question_sources, public.practice_questions, public.practice_question_skill_links to service_role;

-- No answer key leaves this function. A learner may receive only questions for
-- a skill in their own primary exam target.
create or replace function public.get_practice_questions_for_skill(p_skill_code text, p_limit integer default 3)
returns table (question_id uuid, statement text, alternatives jsonb, source_type text, source_label text, difficulty_profile jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid()); v_catalog_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_skill_code is null or p_skill_code !~ '^[a-z][a-z0-9._-]{2,159}$' then raise exception 'Invalid skill'; end if;
  select catalog_version_id into v_catalog_id from public.user_exam_targets where user_id = v_user_id and is_primary;
  if v_catalog_id is null then raise exception 'Exam target required'; end if;
  if not exists (select 1 from public.exam_catalog_skills where catalog_version_id = v_catalog_id and skill_code = p_skill_code) then raise exception 'Skill is not available for the current target'; end if;
  return query select q.id, q.statement, q.alternatives, q.source_type,
    case when q.source_type = 'historical' then coalesce(source.title, 'Official exam question') else 'Practice question' end, q.difficulty_profile
  from public.practice_questions q join public.practice_question_skill_links link on link.question_id = q.id and link.skill_code = p_skill_code
  left join public.practice_question_sources source on source.id = q.source_id
  where q.catalog_version_id = v_catalog_id and q.validation_status = 'validated'
    and (q.source_type = 'generated' or source.rights_status = 'cleared')
  order by case q.source_type when 'historical' then 0 else 1 end, q.created_at desc
  limit greatest(1, least(coalesce(p_limit, 3), 5));
end $$;

-- Correctness is calculated from server-stored validated questions. The client
-- provides only its selected answers and never chooses the user id.
create or replace function public.submit_practice_recovery(p_mistake_id uuid, p_skill_code text, p_client_id text, p_question_ids uuid[], p_selected_answers text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid()); v_session_id uuid; v_correct_count integer; v_now timestamptz := now(); v_catalog_id uuid; v_results jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_skill_code is null or p_skill_code !~ '^[a-z][a-z0-9._-]{2,159}$' then raise exception 'Invalid skill'; end if;
  if p_client_id is null or length(btrim(p_client_id)) not between 1 and 160 then raise exception 'Invalid recovery id'; end if;
  if coalesce(array_length(p_question_ids, 1), 0) <> 3 or coalesce(array_length(p_selected_answers, 1), 0) <> 3 or (select count(distinct question_id) from unnest(p_question_ids) question_id) <> 3 or exists (select 1 from unnest(p_selected_answers) selected_answer where selected_answer !~ '^[A-E]$') then raise exception 'Exactly three valid answers are required'; end if;
  if not exists (select 1 from public.mistakes where id = p_mistake_id and user_id = v_user_id) then raise exception 'Mistake not found'; end if;
  select catalog_version_id into v_catalog_id from public.user_exam_targets where user_id = v_user_id and is_primary;
  if v_catalog_id is null then raise exception 'Exam target required'; end if;
  if not exists (select 1 from public.exam_catalog_skills where catalog_version_id = v_catalog_id and skill_code = p_skill_code) then raise exception 'Skill is not available for the current target'; end if;
  if not exists (select 1 from public.mistake_skill_links where mistake_id = p_mistake_id and skill_code = p_skill_code) then raise exception 'Skill is not linked to the selected mistake'; end if;
  if (select count(*) from public.practice_questions q join public.practice_question_skill_links question_skill on question_skill.question_id = q.id left join public.practice_question_sources source on source.id = q.source_id where q.id = any(p_question_ids) and q.catalog_version_id = v_catalog_id and q.validation_status = 'validated' and question_skill.skill_code = p_skill_code and (q.source_type = 'generated' or source.rights_status = 'cleared')) <> 3 then raise exception 'Questions do not match the selected recovery'; end if;
  insert into public.recovery_sessions(user_id, client_id, mistake_id, topic, targeted_error_type, generator_type, started_at, completed_at, verified_at)
  select v_user_id, btrim(p_client_id), p_mistake_id, skill.name_pt_br, coalesce(mistake.error_type, 'OTHER'), 'practice', v_now, v_now, v_now
  from public.mistakes mistake join public.curriculum_skills skill on skill.code = p_skill_code where mistake.id = p_mistake_id
  on conflict (user_id, client_id) do nothing returning id into v_session_id;
  if v_session_id is null then
    select id into v_session_id from public.recovery_sessions where user_id = v_user_id and client_id = btrim(p_client_id) and verified_at is not null;
    if v_session_id is null then raise exception 'Recovery id already exists'; end if;
    select count(*) into v_correct_count from public.recovery_answers where session_id = v_session_id and correct and pattern_resisted;
    select coalesce(jsonb_agg(jsonb_build_object('questionId', answer.question_id, 'correct', answer.correct and answer.pattern_resisted, 'explanation', question.explanation) order by array_position(p_question_ids, question.id)), '[]'::jsonb)
      into v_results
    from public.recovery_answers answer join public.practice_questions question on question.id::text = answer.question_id where answer.session_id = v_session_id;
    return jsonb_build_object('verified', true, 'correctCount', v_correct_count, 'duplicate', true, 'results', v_results);
  end if;
  insert into public.recovery_answers(user_id, session_id, question_id, correct, pattern_resisted, answered_at)
  select v_user_id, v_session_id, input.question_id::text, question.correct_answer = input.selected_answer, question.correct_answer = input.selected_answer, v_now
  from unnest(p_question_ids, p_selected_answers) as input(question_id, selected_answer) join public.practice_questions question on question.id = input.question_id;
  select count(*) into v_correct_count from public.recovery_answers where session_id = v_session_id and correct and pattern_resisted;
  select coalesce(jsonb_agg(jsonb_build_object('questionId', answer.question_id, 'correct', answer.correct and answer.pattern_resisted, 'explanation', question.explanation) order by array_position(p_question_ids, question.id)), '[]'::jsonb)
    into v_results
  from public.recovery_answers answer join public.practice_questions question on question.id::text = answer.question_id where answer.session_id = v_session_id;
  return jsonb_build_object('verified', true, 'correctCount', v_correct_count, 'duplicate', false, 'results', v_results);
end $$;
revoke all on function public.get_practice_questions_for_skill(text, integer) from public, anon;
revoke all on function public.submit_practice_recovery(uuid, text, text, uuid[], text[]) from public, anon;
grant execute on function public.get_practice_questions_for_skill(text, integer) to authenticated, service_role;
grant execute on function public.submit_practice_recovery(uuid, text, text, uuid[], text[]) to authenticated, service_role;

-- Metadata only. No copyrighted question statement, alternative, image, answer or explanation is imported.
insert into public.practice_question_sources(institution, program_code, stage, exam_year, title, official_url, source_format, rights_status)
values ('Universidade Federal do Amazonas — UFAM','psc','2ª Etapa',2023,'PSC 2023 — 2ª Etapa','https://edoc.ufam.edu.br/handle/123456789/6871','pdf','review_required')
on conflict (program_code, stage, exam_year, official_url) do nothing;
