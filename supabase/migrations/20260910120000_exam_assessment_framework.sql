-- Optional, versioned document framework for exam-specific structures.
-- This metadata is deliberately separate from curriculum_skills and must not
-- participate in mastery, coverage, readiness, Never Again, or mistake links.
alter table public.exam_catalog_versions
  add column assessment_framework jsonb;

alter table public.exam_catalog_versions
  add constraint exam_catalog_versions_assessment_framework_check
  check (
    assessment_framework is null
    or (
      jsonb_typeof(assessment_framework) = 'object'
      and jsonb_typeof(assessment_framework -> 'schema_version') = 'number'
      and (assessment_framework ->> 'schema_version')::integer >= 1
      and jsonb_typeof(assessment_framework -> 'framework_type') = 'string'
      and char_length(btrim(assessment_framework ->> 'framework_type')) between 1 and 80
    )
  );

comment on column public.exam_catalog_versions.assessment_framework is
  'Versioned, exam-document-specific framework. It is descriptive metadata only and is excluded from learner evidence and readiness calculations.';
