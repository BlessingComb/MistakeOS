import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildOfficialExamReadiness } from './core';
import { buildExamProgramItems, buildHomeExamPrepSummary, officialPrepView, summarizeSubjects } from './presentation';
import { emptyOfficialExamPrepData, type PublishedExamCatalog } from './repository';

const catalog = (overrides: Partial<PublishedExamCatalog> = {}): PublishedExamCatalog => ({
  id: 'psc-2', programCode: 'psc', programName: 'PSC', institution: 'UFAM', stage: '2ª Etapa', cycle: 'Projeto 2028',
  sourceUrl: 'https://example.invalid', sourceYear: 2026, examYear: 2027, projectYear: 2028,
  sourceDocument: 'Official source', documentVersion: 'v1', catalogVersion: 'psc-2-v1', ...overrides,
});

test('repository requests only published catalogs and orders skills by display order', () => {
  const source = readFileSync('src/examPrep/repository.ts', 'utf8');
  assert.match(source, /\.eq\('status', 'published'\)/);
  assert.match(source, /\.order\('display_order', \{ ascending: true \}\)/);
});

test('draft-only programs remain visible but never become selectable catalogs', () => {
  const programs = buildExamProgramItems([]);
  assert.deepEqual(programs.map((item) => item.label), ['PSC 1', 'PSC 2', 'PSC 3', 'SIS 1', 'SIS 2', 'SIS 3', 'Vestibular UEA', 'ENEM']);
  assert.ok(programs.every((item) => item.catalog === null));
});

test('only a catalog returned by the published-catalog repository becomes selectable', () => {
  const programs = buildExamProgramItems([catalog()]);
  assert.equal(programs.find((item) => item.id === 'psc-2')?.catalog?.id, 'psc-2');
  assert.equal(programs.find((item) => item.id === 'sis-2')?.catalog, null);
  assert.equal(programs.find((item) => item.id === 'uea-vestibular')?.catalog, null);
});

test('loading, network error, empty target and valid target remain distinct', () => {
  assert.equal(officialPrepView(emptyOfficialExamPrepData('loading')), 'loading');
  assert.equal(officialPrepView(emptyOfficialExamPrepData('error')), 'error');
  assert.equal(officialPrepView(emptyOfficialExamPrepData('ready')), 'catalog-home');
  assert.equal(officialPrepView({ ...emptyOfficialExamPrepData('ready'), catalogs: [catalog()], target: { id: 'target', catalogVersionId: 'psc-2' } }), 'target');
});

test('subject summaries preserve display order and all four visible states', () => {
  const readiness = buildOfficialExamReadiness([
    { code: 'first', subjectCode: 'math', subjectName: 'Matemática', name: 'Primeira' },
    { code: 'second', subjectCode: 'math', subjectName: 'Matemática', name: 'Segunda' },
  ], [{ id: 'm1', createdAt: '2026-09-09T12:00:00Z' }], [{ mistakeId: 'm1', skillCode: 'second', source: 'user' }], [], new Date('2026-09-10T12:00:00Z'));
  const [subject] = summarizeSubjects(readiness);
  assert.deepEqual(subject?.skills.map((skill) => skill.code), ['first', 'second']);
  assert.equal(subject?.counts.not_assessed, 1);
  assert.equal((subject?.counts.at_risk ?? 0) + (subject?.counts.critical ?? 0) + (subject?.counts.learning ?? 0), 1);
});

test('home differentiates no target from a real target with insufficient evidence', () => {
  const readiness = buildOfficialExamReadiness([{ code: 'one', subjectCode: 'math', name: 'One' }], [], [], []);
  assert.equal(buildHomeExamPrepSummary(emptyOfficialExamPrepData('ready'), readiness).kind, 'empty');
  const data = { ...emptyOfficialExamPrepData('ready'), catalogs: [catalog()], target: { id: 'target', catalogVersionId: 'psc-2' } };
  const summary = buildHomeExamPrepSummary(data, readiness);
  assert.equal(summary.kind, 'target');
  if (summary.kind === 'target') {
    assert.equal(summary.readiness, null);
    assert.equal(summary.assessedSkills, 0);
  }
});
