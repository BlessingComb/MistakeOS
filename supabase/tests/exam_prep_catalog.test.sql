begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select no_plan();

select has_table('public','exam_catalog_versions','versioned catalog exists');
select has_table('public','curriculum_skills','canonical skills exist');
select has_table('public','exam_catalog_skills','catalog-to-skill mapping exists');
select has_table('public','user_exam_targets','private exam targets exist');
select has_table('public','mistake_skill_links','private mistake links exist');
select col_is_pk('public','curriculum_skills','code','canonical skill code is stable identity');
select col_is_pk('public','exam_catalog_skills',array['catalog_version_id','skill_code'],'one skill maps once per catalog');
select ok(not has_table_privilege('anon','public.user_exam_targets','SELECT'),'anon cannot read targets');
select ok(not has_table_privilege('authenticated','public.user_exam_targets','INSERT'),'client cannot insert targets directly');
select ok(not has_table_privilege('authenticated','public.mistake_skill_links','INSERT'),'client cannot insert links directly');
select ok(has_function_privilege('authenticated','public.set_exam_target(uuid,date)','EXECUTE'),'authenticated users can choose their own target');
select ok(not has_function_privilege('anon','public.set_exam_target(uuid,date)','EXECUTE'),'anon cannot choose a target');
select ok(has_function_privilege('service_role','public.set_exam_target(uuid,date)','EXECUTE'),'service role can execute target RPC');
select ok(to_regprocedure('public.set_exam_target(uuid,date)') is not null,'target RPC has no user id parameter');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('31000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','prep-one@example.invalid','',now(),'{}','{}',now(),now()),
('31000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','prep-two@example.invalid','',now(),'{}','{}',now(),now());
insert into public.academic_subjects(code,name_pt_br,name_en,legacy_subject_id) values('mathematics','Matemática','Mathematics','mathematics');
insert into public.exam_programs(code,institution,name) values('fixture-a','UFAM','Fixture A'),('fixture-b','UFAM','Fixture B');
insert into public.exam_catalog_versions(id,program_code,stage,cycle,exam_year,project_year,source_url,source_year,source_document,document_version,catalog_version,status,imported_at,published_at)
values
('32000000-0000-4000-8000-000000000001','fixture-a','2','fixture',2027,2028,'https://example.invalid/a',2026,'fixture','fixture','fixture-a','published',now(),now()),
('32000000-0000-4000-8000-000000000002','fixture-b','2','fixture',2027,2028,'https://example.invalid/b',2026,'fixture','fixture','fixture-b','published',now(),now()),
('32000000-0000-4000-8000-000000000003','fixture-a','2','draft',2027,2028,'https://example.invalid/draft',2026,'fixture','draft','fixture-draft','draft',now(),null);
insert into public.curriculum_skills(code,subject_code,level,name_pt_br,name_en) values('math.fixture.shared','mathematics','skill','Habilidade compartilhada','Shared skill');
insert into public.exam_catalog_skills(catalog_version_id,skill_code,source_locator,source_excerpt) values
('32000000-0000-4000-8000-000000000001','math.fixture.shared','fixture','fixture'),('32000000-0000-4000-8000-000000000002','math.fixture.shared','fixture','fixture');
insert into public.mistakes(id,user_id,client_id,subject,note,source) values
('33000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','prep-one','mathematics','fixture','manual'),
('33000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','prep-two','mathematics','fixture','manual');
insert into public.mistake_skill_links(mistake_id,skill_code,link_source,confidence) values
('33000000-0000-4000-8000-000000000001','math.fixture.shared','ai',0.5000),
('33000000-0000-4000-8000-000000000002','math.fixture.shared','deterministic',null);

set local role anon;
select is((select count(*)::integer from public.exam_catalog_versions),2,'anon sees published catalogs but not draft');
select is((select count(*)::integer from public.curriculum_skills),1,'published canonical skill is publicly readable');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_exam_target('32000000-0000-4000-8000-000000000001',null)$$,'user selects a published target');
select lives_ok($$select public.set_exam_target('32000000-0000-4000-8000-000000000002',null)$$,'switching target is atomic');
select is((select count(*)::integer from public.user_exam_targets where is_primary),1,'switch leaves exactly one primary target');
select is((select catalog_version_id from public.user_exam_targets where is_primary),'32000000-0000-4000-8000-000000000002'::uuid,'new target becomes primary');
select is((select count(*)::integer from public.mistake_skill_links),1,'RLS exposes only links owned through the real mistake');
select is((select confidence from public.mistake_skill_links),0.5000::numeric,'low-confidence AI link remains explicitly reviewable');
select throws_ok($$select public.set_exam_target('32000000-0000-4000-8000-000000000003',null)$$,'P0001','Published exam catalog not found','draft target cannot be selected');
reset role;

select * from finish();
rollback;
