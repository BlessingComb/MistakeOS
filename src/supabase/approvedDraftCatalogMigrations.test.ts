import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const structural = readFileSync('supabase/migrations/20260910120000_exam_assessment_framework.sql', 'utf8');
const psc1 = readFileSync('supabase/migrations/20260910121000_psc_2027_stage_1_draft.sql', 'utf8');
const psc2 = readFileSync('supabase/migrations/20260909121000_psc_2027_stage_2_draft.sql', 'utf8');
const psc3 = readFileSync('supabase/migrations/20260910122000_psc_2027_stage_3_draft.sql', 'utf8');
const enem = readFileSync('supabase/migrations/20260910123000_enem_2026_reference_matrix_draft.sql', 'utf8');
const readiness = readFileSync('src/examPrep/core.ts', 'utf8');

function mappedCodes(sql: string): Set<string> {
  if (sql.includes('insert into psc2_catalog_import')) {
    const section = sql.split('insert into psc2_catalog_import', 2)[1]?.split(';', 1)[0] ?? '';
    return new Set([...section.matchAll(/\('([^']+)','[^']+','/g)].map((match) => match[1]!));
  }
  const section = sql.split('insert into public.exam_catalog_skills', 2)[1] ?? '';
  return new Set([...section.matchAll(/::uuid,'([^']+)'/g)].map((match) => match[1]!));
}

test('assessment framework is nullable, versioned document metadata only', () => {
  assert.match(structural, /add column assessment_framework jsonb;/i);
  assert.doesNotMatch(structural, /assessment_framework jsonb not null/i);
  assert.match(structural, /assessment_framework -> 'schema_version'/i);
  assert.match(structural, /assessment_framework -> 'framework_type'/i);
  assert.doesNotMatch(readiness, /assessment_framework|assessmentFramework/i);
});

test('PSC drafts keep a null framework and PSC 2 remains unchanged', () => {
  assert.match(psc1, /'draft',now\(\),null,null/i);
  assert.match(psc3, /'draft',now\(\),null,null/i);
  assert.doesNotMatch(psc2, /assessment_framework/i);
  assert.equal(mappedCodes(psc2).size, 165);
});

test('ENEM framework is versioned and does not invent object-to-ability links', () => {
  assert.match(enem, /"schema_version":1/);
  assert.match(enem, /"framework_type":"enem_reference_matrix"/);
  assert.match(enem, /"cognitive_axes":\[/);
  assert.match(enem, /"essay_competencies":\[/);
  assert.match(enem, /"object_groups":\[/);
  assert.doesNotMatch(enem, /object_to_ability|ability_code|ability_codes/);
  assert.match(enem, /'draft',now\(\),null,\$framework\$/i);
});

test('catalog migrations reuse canonical skills and never publish', () => {
  const psc1Codes = mappedCodes(psc1);
  const psc2Codes = mappedCodes(psc2);
  const psc3Codes = mappedCodes(psc3);
  const enemCodes = mappedCodes(enem);
  assert.deepEqual(
    [psc1Codes.size, psc2Codes.size, psc3Codes.size, enemCodes.size],
    [313, 165, 285, 378],
  );
  assert.equal(new Set([...psc1Codes, ...psc2Codes, ...psc3Codes, ...enemCodes]).size, 1_137);
  const laterCodes = [...psc1Codes, ...psc3Codes, ...enemCodes];
  assert.ok(laterCodes.some((code) => psc2Codes.has(code)));
  for (const sql of [psc1, psc3, enem]) {
    assert.doesNotMatch(sql, /'published'/i);
    assert.doesNotMatch(sql, /published_at\s*=|status\s*=\s*'published'/i);
  }
});

test('shared skills do not duplicate learner mistakes', () => {
  const all = [mappedCodes(psc1), mappedCodes(psc2), mappedCodes(psc3), mappedCodes(enem)];
  const occurrences = new Map<string, number>();
  for (const codes of all) for (const code of codes) occurrences.set(code, (occurrences.get(code) ?? 0) + 1);
  assert.ok([...occurrences.values()].some((count) => count > 1));
  for (const sql of [psc1, psc3, enem]) {
    assert.doesNotMatch(sql, /insert into public\.mistakes/i);
    assert.doesNotMatch(sql, /insert into public\.mistake_skill_links/i);
  }
});
