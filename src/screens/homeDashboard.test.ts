import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOfficialExamReadiness, type CatalogSkill } from '../examPrep';
import { buildHomeDashboard, daysUntil } from './homeDashboard';

const skill: CatalogSkill = { code: 'math.fractions', subjectCode: 'mathematics', subjectName: 'Mathematics', name: 'Fractions' };
const base = { catalogs: [{ id: 'psc2', programCode: 'psc', programName: 'PSC', institution: 'UFAM', stage: '2ª Etapa', cycle: '2027', sourceUrl: 'https://example.test', sourceYear: 2026, examYear: 2027, projectYear: 2028, sourceDocument: 'Edital', documentVersion: 'Consolidado', catalogVersion: 'psc2' }], catalogSkills: [skill], mistakes: [], links: [], recoveries: [], available: true, status: 'ready' as const };

test('home dashboard keeps the no-target state explicit', () => {
  const readiness = buildOfficialExamReadiness([], [], [], []);
  assert.equal(buildHomeDashboard({ ...base, target: null }, readiness).target.kind, 'empty');
});

test('home dashboard exposes a real attention point only from assessed evidence', () => {
  const mistakes = [{ id: 'm1', createdAt: '2026-09-11T12:00:00Z' }, { id: 'm2', createdAt: '2026-09-12T08:00:00Z' }];
  const links = mistakes.map((mistake) => ({ mistakeId: mistake.id, skillCode: skill.code, source: 'user' as const }));
  const readiness = buildOfficialExamReadiness([skill], mistakes, links, [], new Date('2026-09-12T12:00:00Z'));
  const dashboard = buildHomeDashboard({ ...base, target: { id: 'target', catalogVersionId: 'psc2' }, mistakes, links }, readiness);
  assert.equal(dashboard.focus?.code, skill.code);
  assert.equal(dashboard.counts.atRisk, 1);
});

test('days remaining does not invent a date', () => {
  assert.equal(daysUntil(undefined), null);
  assert.equal(daysUntil('2026-09-15', new Date('2026-09-12T12:00:00Z')), 3);
});
