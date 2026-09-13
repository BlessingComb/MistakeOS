-- Academic classrooms replace the retired social surface. They deliberately use
-- separate tables: historical social data is never repurposed as school data.

do $$ begin
  create type public.app_user_role as enum ('teacher', 'student');
exception when duplicate_object then null;
end $$;

create table public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_user_role not null default 'student',
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  objective text check (objective is null or char_length(btrim(objective)) between 2 and 280),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8,16}$'),
  catalog_version_id uuid not null references public.exam_catalog_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_user_role not null default 'student',
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id),
  check (role in ('teacher', 'student'))
);

create table public.classroom_assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  skill_code text not null references public.curriculum_skills(code) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index classrooms_teacher_idx on public.classrooms(teacher_id, created_at desc);
create index classroom_members_user_idx on public.classroom_members(user_id, joined_at desc);
create index classroom_assignments_classroom_idx on public.classroom_assignments(classroom_id, created_at desc);

alter table public.app_user_roles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.classroom_assignments enable row level security;

revoke all on public.app_user_roles, public.classrooms, public.classroom_members, public.classroom_assignments from anon, authenticated;
grant all on public.app_user_roles, public.classrooms, public.classroom_members, public.classroom_assignments to service_role;

create or replace function public.get_my_app_role()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((select role::text from public.app_user_roles where user_id = (select auth.uid())), 'student')
$$;

create or replace function public.list_my_classrooms()
returns table(
  id uuid, name text, objective text, invite_code text, catalog_version_id uuid,
  catalog_label text, teacher_name text, role text, member_count integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select classroom.id, classroom.name, classroom.objective, classroom.invite_code, classroom.catalog_version_id,
    program.name || ' · ' || catalog.stage as catalog_label,
    coalesce(profile.display_name, 'Teacher ' || left(classroom.teacher_id::text, 8)) as teacher_name,
    member.role::text,
    (select count(*)::integer from public.classroom_members all_members where all_members.classroom_id = classroom.id) as member_count
  from public.classroom_members member
  join public.classrooms classroom on classroom.id = member.classroom_id
  join public.exam_catalog_versions catalog on catalog.id = classroom.catalog_version_id
  join public.exam_programs program on program.code = catalog.program_code
  left join public.profiles profile on profile.id = classroom.teacher_id
  where member.user_id = (select auth.uid())
  order by classroom.created_at desc
$$;

create or replace function public.create_classroom(
  p_name text, p_objective text, p_catalog_version_id uuid
)
returns table(
  id uuid, name text, objective text, invite_code text, catalog_version_id uuid,
  catalog_label text, teacher_name text, role text, member_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
  v_code text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.app_user_roles where user_id = v_user_id and role = 'teacher') then
    raise exception 'Teacher role required';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Invalid classroom name'; end if;
  if p_objective is not null and char_length(btrim(p_objective)) not between 2 and 280 then raise exception 'Invalid classroom objective'; end if;
  if not exists (select 1 from public.exam_catalog_versions where id = p_catalog_version_id and status = 'published') then
    raise exception 'Published academic target required';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.classrooms where invite_code = v_code);
  end loop;
  insert into public.classrooms(teacher_id, name, objective, invite_code, catalog_version_id)
  values (v_user_id, btrim(p_name), nullif(btrim(coalesce(p_objective, '')), ''), v_code, p_catalog_version_id)
  returning classrooms.id into v_id;
  insert into public.classroom_members(classroom_id, user_id, role) values (v_id, v_user_id, 'teacher');
  return query select * from public.list_my_classrooms() as listed where listed.id = v_id;
end;
$$;

create or replace function public.join_classroom_by_code(p_code text)
returns table(
  id uuid, name text, objective text, invite_code text, catalog_version_id uuid,
  catalog_label text, teacher_name text, role text, member_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_classroom_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select classrooms.id into v_classroom_id from public.classrooms
    where invite_code = upper(btrim(coalesce(p_code, '')));
  if v_classroom_id is null then raise exception 'Classroom not found'; end if;
  insert into public.app_user_roles(user_id, role) values (v_user_id, 'student') on conflict (user_id) do nothing;
  insert into public.classroom_members(classroom_id, user_id, role) values (v_classroom_id, v_user_id, 'student')
    on conflict (classroom_id, user_id) do nothing;
  return query select * from public.list_my_classrooms() as listed where listed.id = v_classroom_id;
end;
$$;

create or replace function public.list_classroom_assignments(p_classroom_id uuid)
returns table(id uuid, skill_code text, skill_name text, title text, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select assignment.id, assignment.skill_code, skill.name_pt_br, assignment.title, assignment.created_at
  from public.classroom_assignments assignment
  join public.curriculum_skills skill on skill.code = assignment.skill_code
  where assignment.classroom_id = p_classroom_id and assignment.archived_at is null
    and exists (select 1 from public.classroom_members member where member.classroom_id = p_classroom_id and member.user_id = (select auth.uid()))
  order by assignment.created_at desc
$$;

create or replace function public.create_classroom_assignment(p_classroom_id uuid, p_skill_code text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 160 then raise exception 'Invalid activity title'; end if;
  if not exists (select 1 from public.classroom_members where classroom_id = p_classroom_id and user_id = v_user_id and role = 'teacher') then
    raise exception 'Teacher membership required';
  end if;
  if not exists (
    select 1 from public.classrooms classroom
    join public.exam_catalog_skills mapping on mapping.catalog_version_id = classroom.catalog_version_id
    where classroom.id = p_classroom_id and mapping.skill_code = p_skill_code
  ) then raise exception 'Skill is not in the classroom target'; end if;
  insert into public.classroom_assignments(classroom_id, skill_code, title, created_by)
  values (p_classroom_id, p_skill_code, btrim(p_title), v_user_id) returning id into v_id;
  return v_id;
end;
$$;

-- Only categorical skill states leave this helper. It never returns mistakes,
-- photos, answers, prompts, recovery records, or personal textual evidence.
create or replace function public.classroom_skill_states(p_classroom_id uuid, p_student_id uuid)
returns table(skill_code text, skill_name text, subject_name text, state text)
language sql
security definer
set search_path = ''
stable
as $$
  with access as (
    select 1 where exists (
      select 1 from public.classroom_members member
      where member.classroom_id = p_classroom_id and member.user_id = (select auth.uid())
        and (member.role = 'teacher' or member.user_id = p_student_id)
    ) and exists (select 1 from public.classroom_members student where student.classroom_id = p_classroom_id and student.user_id = p_student_id and student.role = 'student')
  ), skills as (
    select skill.code, skill.name_pt_br, subject.name_pt_br as subject_name
    from public.classrooms classroom
    join public.exam_catalog_skills mapping on mapping.catalog_version_id = classroom.catalog_version_id
    join public.curriculum_skills skill on skill.code = mapping.skill_code
    join public.academic_subjects subject on subject.code = skill.subject_code
    where classroom.id = p_classroom_id and exists (select 1 from access)
  ), evidence as (
    with linked_mistakes as (
      select link.skill_code, mistake.id as mistake_id, mistake.created_at
      from public.mistake_skill_links link
      join public.mistakes mistake on mistake.id = link.mistake_id and mistake.user_id = p_student_id
      where link.confirmed_at is not null or link.link_source <> 'ai' or link.confidence >= 0.85
    ), latest as (
      select skill_code, max(created_at) as latest_mistake_at from linked_mistakes group by skill_code
    )
    select linked.skill_code, count(distinct linked.mistake_id)::integer as mistake_count,
      count(distinct linked.mistake_id) filter (where linked.created_at >= now() - interval '14 days')::integer as recent_count,
      count(distinct session.id) filter (where session.verified_at > latest.latest_mistake_at and (
        select count(*) from public.recovery_answers answer
        where answer.session_id = session.id and answer.correct and answer.pattern_resisted
      ) >= 2)::integer as recovery_count,
      count(distinct session.verified_at::date) filter (where session.verified_at > latest.latest_mistake_at and (
        select count(*) from public.recovery_answers answer
        where answer.session_id = session.id and answer.correct and answer.pattern_resisted
      ) >= 2)::integer as recovery_days
    from linked_mistakes linked
    join latest on latest.skill_code = linked.skill_code
    left join public.recovery_sessions session on session.user_id = p_student_id and session.mistake_id = linked.mistake_id and session.verified_at is not null
    group by linked.skill_code, latest.latest_mistake_at
  )
  select skills.code, skills.name_pt_br, skills.subject_name,
    case
      when coalesce(evidence.mistake_count, 0) = 0 then 'not_assessed'
      when evidence.recovery_count >= 2 and evidence.recovery_days >= 2 then 'mastered'
      when greatest(8, least(100, 38 + evidence.mistake_count * 17 + evidence.recent_count * 5 - evidence.recovery_count * 18)) >= 70 then 'at_risk'
      else 'learning'
    end as state
  from skills left join evidence on evidence.skill_code = skills.code
$$;

create or replace function public.get_classroom_skill_summary(p_classroom_id uuid)
returns table(skill_code text, skill_name text, subject_name text, at_risk_count integer, learning_count integer, mastered_count integer, not_assessed_count integer)
language sql
security definer
set search_path = ''
stable
as $$
  with teacher as (
    select 1 from public.classroom_members where classroom_id = p_classroom_id and user_id = (select auth.uid()) and role = 'teacher'
  ), students as (
    select user_id from public.classroom_members where classroom_id = p_classroom_id and role = 'student' and exists (select 1 from teacher)
  ), states as (
    select state.* from students cross join lateral public.classroom_skill_states(p_classroom_id, students.user_id) state
  )
  select skill_code, max(skill_name), max(subject_name),
    count(*) filter (where state = 'at_risk')::integer, count(*) filter (where state = 'learning')::integer,
    count(*) filter (where state = 'mastered')::integer, count(*) filter (where state = 'not_assessed')::integer
  from states group by skill_code order by count(*) filter (where state = 'at_risk') desc, count(*) filter (where state = 'learning') desc, skill_code
$$;

create or replace function public.get_my_classroom_progress(p_classroom_id uuid)
returns table(at_risk_count integer, learning_count integer, mastered_count integer, not_assessed_count integer, coverage_percent integer)
language sql
security definer
set search_path = ''
stable
as $$
  with states as (select * from public.classroom_skill_states(p_classroom_id, (select auth.uid())))
  select count(*) filter (where state = 'at_risk')::integer, count(*) filter (where state = 'learning')::integer,
    count(*) filter (where state = 'mastered')::integer, count(*) filter (where state = 'not_assessed')::integer,
    coalesce(round(100.0 * count(*) filter (where state <> 'not_assessed') / nullif(count(*), 0))::integer, 0)
  from states
$$;

create or replace function public.list_classroom_roster(p_classroom_id uuid)
returns table(user_id uuid, display_name text, joined_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select student.user_id, coalesce(profile.display_name, 'Learner ' || left(student.user_id::text, 8)), student.joined_at
  from public.classroom_members student
  left join public.profiles profile on profile.id = student.user_id
  where student.classroom_id = p_classroom_id and student.role = 'student'
    and exists (select 1 from public.classroom_members teacher where teacher.classroom_id = p_classroom_id and teacher.user_id = (select auth.uid()) and teacher.role = 'teacher')
  order by student.joined_at asc
$$;

revoke all on function public.get_my_app_role() from public, anon;
revoke all on function public.list_my_classrooms() from public, anon;
revoke all on function public.create_classroom(text, text, uuid) from public, anon;
revoke all on function public.join_classroom_by_code(text) from public, anon;
revoke all on function public.list_classroom_assignments(uuid) from public, anon;
revoke all on function public.create_classroom_assignment(uuid, text, text) from public, anon;
revoke all on function public.classroom_skill_states(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_classroom_skill_summary(uuid) from public, anon;
revoke all on function public.get_my_classroom_progress(uuid) from public, anon;
revoke all on function public.list_classroom_roster(uuid) from public, anon;
grant execute on function public.get_my_app_role(), public.list_my_classrooms(), public.create_classroom(text, text, uuid), public.join_classroom_by_code(text), public.list_classroom_assignments(uuid), public.create_classroom_assignment(uuid, text, text), public.get_classroom_skill_summary(uuid), public.get_my_classroom_progress(uuid), public.list_classroom_roster(uuid) to authenticated;
grant execute on function public.get_my_app_role(), public.list_my_classrooms(), public.create_classroom(text, text, uuid), public.join_classroom_by_code(text), public.list_classroom_assignments(uuid), public.create_classroom_assignment(uuid, text, text), public.classroom_skill_states(uuid, uuid), public.get_classroom_skill_summary(uuid), public.get_my_classroom_progress(uuid), public.list_classroom_roster(uuid) to service_role;
