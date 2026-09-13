begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select is(
  (select status from public.exam_catalog_versions where catalog_version='psc-2027-stage-2-project-2028-v1'),
  'draft',
  'PSC pilot catalog remains draft'
);
select is(
  (select published_at from public.exam_catalog_versions where catalog_version='psc-2027-stage-2-project-2028-v1'),
  null::timestamptz,
  'PSC pilot catalog has not been published'
);
select results_eq(
  $$select exam_year,project_year,source_year,source_document,source_url
    from public.exam_catalog_versions
    where catalog_version='psc-2027-stage-2-project-2028-v1'$$,
  $$values (2027,2028,2026,'Edital 14 de 2026 [Consolidado]'::text,'https://edoc.ufam.edu.br/handle/123456789/12242'::text)$$,
  'approved provenance is stored exactly'
);
select is(
  (select count(*)::integer
   from public.exam_catalog_skills mapping
   join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id
   where catalog.catalog_version='psc-2027-stage-2-project-2028-v1'),
  165,
  'catalog has the audited number of skills'
);
select is(
  (select count(distinct skill.subject_code)::integer
   from public.exam_catalog_skills mapping
   join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id
   join public.curriculum_skills skill on skill.code=mapping.skill_code
   where catalog.catalog_version='psc-2027-stage-2-project-2028-v1'),
  7,
  'catalog preserves the seven Annex 1 academic areas'
);
select is(
  (select count(*)::integer from (
    select lower(btrim(skill.name_pt_br))
    from public.exam_catalog_skills mapping
    join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id
    join public.curriculum_skills skill on skill.code=mapping.skill_code
    where catalog.catalog_version='psc-2027-stage-2-project-2028-v1'
    group by lower(btrim(skill.name_pt_br))
    having count(*) > 1
  ) duplicates),
  0,
  'catalog has no duplicate canonical labels'
);
select is(
  (select count(*)::integer
   from public.exam_catalog_skills mapping
   join public.exam_catalog_versions catalog on catalog.id=mapping.catalog_version_id
   left join public.curriculum_skills skill on skill.code=mapping.skill_code
   left join public.academic_subjects subject on subject.code=skill.subject_code
   where catalog.catalog_version='psc-2027-stage-2-project-2028-v1'
     and (skill.code is null or subject.code is null or btrim(mapping.source_locator)='' or btrim(mapping.source_excerpt)='')),
  0,
  'catalog has no orphan skill or missing source reference'
);
select is(
  (select count(*)::integer from public.curriculum_skill_aliases
   where normalized_alias in ('colonização do continente americano','pa','pg','zfm','zee','rmm')),
  6,
  'reviewed aliases resolve to canonical skills'
);

set local role anon;
select is(
  (select count(*)::integer from public.exam_catalog_versions where catalog_version='psc-2027-stage-2-project-2028-v1'),
  0,
  'anon cannot read the draft catalog'
);
select is(
  (select count(*)::integer from public.curriculum_skills),
  0,
  'anon cannot read skills that exist only in a draft catalog'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000099',true);
select is(
  (select count(*)::integer from public.exam_catalog_versions where catalog_version='psc-2027-stage-2-project-2028-v1'),
  0,
  'authenticated users cannot read the draft catalog'
);
select throws_ok(
  $$select public.set_exam_target('27000000-0000-4000-8000-000000000002',null)$$,
  'P0001',
  'Published exam catalog not found',
  'authenticated users cannot select the draft catalog'
);
reset role;

select * from finish();
rollback;
