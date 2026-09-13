begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_column('public','exam_catalog_versions','assessment_framework','catalog supports optional document framework');
select is(
  (select is_nullable from information_schema.columns where table_schema='public' and table_name='exam_catalog_versions' and column_name='assessment_framework'),
  'YES',
  'assessment framework is nullable'
);
select is((select count(*)::integer from public.exam_catalog_versions where program_code in ('psc','enem') and status='published'),0,'approved imports remain draft');
select is((select count(*)::integer from public.exam_catalog_versions where program_code='psc' and assessment_framework is not null),0,'PSC 1, 2, and 3 use a null framework');
select is((select assessment_framework->>'framework_type' from public.exam_catalog_versions where catalog_version='enem-2026-reference-matrix-v1'),'enem_reference_matrix','ENEM framework type is explicit');
select is((select (assessment_framework->>'schema_version')::integer from public.exam_catalog_versions where catalog_version='enem-2026-reference-matrix-v1'),1,'ENEM framework schema is versioned');
select ok(
  not exists (
    select 1 from public.exam_catalog_versions,
    lateral jsonb_path_query(assessment_framework, 'strict $.**') value
    where catalog_version='enem-2026-reference-matrix-v1'
      and jsonb_typeof(value)='object'
      and (value ? 'ability_code' or value ? 'ability_codes' or value ? 'object_to_ability')
  ),
  'ENEM does not invent object-to-ability associations'
);
select is((select count(*)::integer from public.exam_catalog_skills ecs join public.exam_catalog_versions ecv on ecv.id=ecs.catalog_version_id where ecv.catalog_version='psc-2027-stage-2-project-2028-v1'),165,'PSC 2 remains compatible and unchanged');
select is((select count(*)::integer from public.exam_catalog_skills ecs join public.exam_catalog_versions ecv on ecv.id=ecs.catalog_version_id where ecv.catalog_version='psc-2027-stage-1-project-2029-v1'),313,'PSC 1 has the reviewed number of mappings');
select is((select count(*)::integer from public.exam_catalog_skills ecs join public.exam_catalog_versions ecv on ecv.id=ecs.catalog_version_id where ecv.catalog_version='psc-2027-stage-3-project-2027-v1'),285,'PSC 3 has the reviewed number of mappings');
select is((select count(*)::integer from public.exam_catalog_skills ecs join public.exam_catalog_versions ecv on ecv.id=ecs.catalog_version_id where ecv.catalog_version='enem-2026-reference-matrix-v1'),378,'ENEM has the reviewed number of unique mappings');
select is((select count(*)::integer from public.exam_catalog_skills),1141,'all four draft catalogs contain 1,141 mappings');
select is((select count(*)::integer from public.curriculum_skills),1137,'canonical reuse leaves 1,137 unique skills');
select ok(exists(select 1 from public.exam_catalog_skills a join public.exam_catalog_skills b using (skill_code) where a.catalog_version_id<>b.catalog_version_id),'canonical skills are reusable across catalogs');
select is((select count(*)::integer from public.curriculum_skills skill where not exists (select 1 from public.exam_catalog_skills mapping where mapping.skill_code=skill.code)),0,'there are no orphan canonical skills');
select is((select count(*)::integer from public.academic_subjects subject where not exists (select 1 from public.curriculum_skills skill where skill.subject_code=subject.code)),0,'there are no orphan subjects');
select is((select count(*)::integer from public.curriculum_skill_aliases alias where not exists (select 1 from public.curriculum_skills skill where skill.code=alias.skill_code)),0,'there are no orphan aliases');
select is((select count(*)::integer from public.exam_catalog_versions where source_url is null or btrim(source_url)='' or source_document is null or btrim(source_document)=''),0,'every catalog version has source metadata');
select is((select count(*)::integer from public.exam_catalog_skills where source_locator is null or btrim(source_locator)='' or source_excerpt is null or btrim(source_excerpt)=''),0,'every catalog mapping has source traceability');
select is((select count(*)::integer from public.user_exam_targets target join public.exam_catalog_versions catalog on catalog.id=target.catalog_version_id where catalog.status='draft'),0,'no user target points to a draft catalog');

set local role anon;
select is((select count(*)::integer from public.exam_catalog_versions where catalog_version in ('psc-2027-stage-1-project-2029-v1','psc-2027-stage-3-project-2027-v1','enem-2026-reference-matrix-v1')),0,'anon cannot see draft imports');
reset role;
set local role authenticated;
select is((select count(*)::integer from public.exam_catalog_versions where catalog_version in ('psc-2027-stage-1-project-2029-v1','psc-2027-stage-3-project-2027-v1','enem-2026-reference-matrix-v1')),0,'authenticated cannot see draft imports');
reset role;

select * from finish();
rollback;
