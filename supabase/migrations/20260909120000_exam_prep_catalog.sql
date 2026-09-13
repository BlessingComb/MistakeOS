-- Official exam-preparation catalog and private learner evidence.
-- No catalog rows are seeded: PSC 2 requires an explicitly approved official document.
create table public.academic_subjects (
  code text primary key check (code ~ '^[a-z][a-z0-9._-]{1,79}$'), name_pt_br text not null, name_en text not null,
  legacy_subject_id text check (legacy_subject_id is null or legacy_subject_id in ('mathematics','physics','chemistry','biology','languages','other')),
  display_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.exam_programs (
  code text primary key check (code ~ '^[a-z][a-z0-9._-]{1,79}$'), institution text not null, name text not null, created_at timestamptz not null default now()
);
create table public.exam_catalog_versions (
  id uuid primary key default gen_random_uuid(), program_code text not null references public.exam_programs(code) on delete restrict,
  stage text not null, cycle text not null, exam_year integer not null check (exam_year between 2000 and 2200),
  project_year integer not null check (project_year between 2000 and 2200), source_url text not null check (source_url ~ '^https://'),
  source_year integer not null check (source_year between 2000 and 2200), source_document text not null, document_version text not null,
  catalog_version text not null check (catalog_version ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  status text not null default 'draft' check (status in ('draft','published','retired')), imported_at timestamptz, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (program_code, stage, cycle, catalog_version), check (status <> 'published' or (imported_at is not null and published_at is not null))
);
create table public.curriculum_skills (
  code text primary key check (code ~ '^[a-z][a-z0-9._-]{2,159}$'), subject_code text not null references public.academic_subjects(code) on delete restrict,
  parent_code text references public.curriculum_skills(code) on delete restrict, level text not null check (level in ('topic','subtopic','skill')),
  name_pt_br text not null, name_en text not null, created_at timestamptz not null default now(), check (parent_code is null or parent_code <> code)
);
create table public.curriculum_skill_aliases (
  normalized_alias text primary key check (normalized_alias = lower(btrim(normalized_alias)) and char_length(normalized_alias) between 2 and 200),
  skill_code text not null references public.curriculum_skills(code) on delete cascade, created_at timestamptz not null default now()
);
create table public.exam_catalog_skills (
  catalog_version_id uuid not null references public.exam_catalog_versions(id) on delete cascade,
  skill_code text not null references public.curriculum_skills(code) on delete restrict, source_locator text not null,
  source_excerpt text not null, display_order integer not null default 0,
  created_at timestamptz not null default now(), primary key (catalog_version_id, skill_code)
);
create table public.user_exam_targets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  catalog_version_id uuid not null references public.exam_catalog_versions(id) on delete restrict, target_date date, is_primary boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, catalog_version_id)
);
create unique index user_exam_targets_one_primary_idx on public.user_exam_targets(user_id) where is_primary;
create index user_exam_targets_catalog_idx on public.user_exam_targets(catalog_version_id);
create table public.mistake_skill_links (
  mistake_id uuid not null references public.mistakes(id) on delete cascade,
  skill_code text not null references public.curriculum_skills(code) on delete restrict,
  link_source text not null check (link_source in ('deterministic','ai','user','reviewed')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)), confirmed_at timestamptz,
  created_at timestamptz not null default now(), primary key (mistake_id, skill_code),
  check (link_source <> 'ai' or confidence is not null), check (link_source = 'ai' or confidence is null or confidence = 1)
);
create index mistake_skill_links_skill_idx on public.mistake_skill_links(skill_code, mistake_id);

alter table public.academic_subjects enable row level security;
alter table public.exam_programs enable row level security;
alter table public.exam_catalog_versions enable row level security;
alter table public.curriculum_skills enable row level security;
alter table public.curriculum_skill_aliases enable row level security;
alter table public.exam_catalog_skills enable row level security;
alter table public.user_exam_targets enable row level security;
alter table public.mistake_skill_links enable row level security;
revoke all on public.academic_subjects, public.exam_programs, public.exam_catalog_versions, public.curriculum_skills,
  public.curriculum_skill_aliases, public.exam_catalog_skills, public.user_exam_targets, public.mistake_skill_links from anon, authenticated;
grant select on public.academic_subjects, public.exam_programs, public.exam_catalog_versions, public.curriculum_skills,
  public.curriculum_skill_aliases, public.exam_catalog_skills to anon, authenticated;
grant select on public.user_exam_targets, public.mistake_skill_links to authenticated;
grant all on public.academic_subjects, public.exam_programs, public.exam_catalog_versions, public.curriculum_skills,
  public.curriculum_skill_aliases, public.exam_catalog_skills, public.user_exam_targets, public.mistake_skill_links to service_role;

create policy "published subjects are readable" on public.academic_subjects for select to anon, authenticated using (
  exists (select 1 from public.curriculum_skills skill join public.exam_catalog_skills mapping on mapping.skill_code=skill.code join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id where skill.subject_code=academic_subjects.code and catalog.status='published'));
create policy "published programs are readable" on public.exam_programs for select to anon, authenticated using (
  exists (select 1 from public.exam_catalog_versions catalog where catalog.program_code=exam_programs.code and catalog.status='published'));
create policy "published catalogs are readable" on public.exam_catalog_versions for select to anon, authenticated using (status='published');
create policy "published skills are readable" on public.curriculum_skills for select to anon, authenticated using (
  exists (select 1 from public.exam_catalog_skills mapping join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id where mapping.skill_code=curriculum_skills.code and catalog.status='published'));
create policy "published aliases are readable" on public.curriculum_skill_aliases for select to anon, authenticated using (
  exists (select 1 from public.exam_catalog_skills mapping join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id where mapping.skill_code=curriculum_skill_aliases.skill_code and catalog.status='published'));
create policy "published catalog mappings are readable" on public.exam_catalog_skills for select to anon, authenticated using (
  exists (select 1 from public.exam_catalog_versions catalog where catalog.id=exam_catalog_skills.catalog_version_id and catalog.status='published'));
create policy "exam targets own select" on public.user_exam_targets for select to authenticated using ((select auth.uid())=user_id);
create policy "mistake skill links own select" on public.mistake_skill_links for select to authenticated using (
  exists (select 1 from public.mistakes mistake where mistake.id=mistake_skill_links.mistake_id and mistake.user_id=(select auth.uid())));

create or replace function public.set_exam_target(p_catalog_version_id uuid, p_target_date date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid()); v_target_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.exam_catalog_versions where id=p_catalog_version_id and status='published') then raise exception 'Published exam catalog not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('exam-target:' || v_user_id::text,0));
  update public.user_exam_targets set is_primary=false,updated_at=now() where user_id=v_user_id and is_primary;
  insert into public.user_exam_targets(user_id,catalog_version_id,target_date,is_primary) values(v_user_id,p_catalog_version_id,p_target_date,true)
  on conflict (user_id,catalog_version_id) do update set target_date=excluded.target_date,is_primary=true,updated_at=now()
  returning id into v_target_id;
  return v_target_id;
end $$;

create or replace function public.link_mistake_to_skill(p_mistake_id uuid, p_skill_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.mistakes where id=p_mistake_id and user_id=v_user_id) then raise exception 'Mistake not found'; end if;
  if not exists (select 1 from public.exam_catalog_skills mapping join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id where mapping.skill_code=p_skill_code and catalog.status='published') then raise exception 'Published skill not found'; end if;
  insert into public.mistake_skill_links(mistake_id,skill_code,link_source,confidence,confirmed_at) values(p_mistake_id,p_skill_code,'user',null,now())
  on conflict (mistake_id,skill_code) do update set link_source='reviewed',confidence=null,confirmed_at=now();
end $$;
revoke all on function public.set_exam_target(uuid,date) from public,anon;
revoke all on function public.link_mistake_to_skill(uuid,text) from public,anon;
grant execute on function public.set_exam_target(uuid,date) to authenticated;
grant execute on function public.link_mistake_to_skill(uuid,text) to authenticated;
grant execute on function public.set_exam_target(uuid,date) to service_role;
grant execute on function public.link_mistake_to_skill(uuid,text) to service_role;
