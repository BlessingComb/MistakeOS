import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_SKILL_LINK_MIN_CONFIDENCE, buildOfficialExamReadiness, type CatalogSkill, type MistakeEvidence, type MistakeSkillLink, type VerifiedRecoveryEvidence } from './core';

const now = new Date('2026-09-09T12:00:00Z');
const skills: CatalogSkill[] = Array.from({ length: 10 }, (_, index) => ({ code: `math.skill.${index + 1}`, subjectCode: 'mathematics', name: `Skill ${index + 1}` }));
function mistake(id: string, createdAt = '2026-09-01T12:00:00Z'): MistakeEvidence { return { id, createdAt }; }
function link(mistakeId: string, skillCode = skills[0]!.code, extra: Partial<MistakeSkillLink> = {}): MistakeSkillLink { return { mistakeId, skillCode, source: 'deterministic', ...extra }; }
function recovery(id: string, mistakeId: string, verifiedAt: string): VerifiedRecoveryEvidence { return { id, mistakeId, verifiedAt, successful: true }; }

test('a canonical skill can be reused by multiple catalogs without duplication', () => {
  assert.equal(buildOfficialExamReadiness([skills[0]!, skills[0]!], [], [], [], now).totalSkills, 1);
});
test('document framework elements never enter readiness or coverage denominators', () => {
  const catalogDocument = {
    assessmentFramework: { schemaVersion: 1, elements: Array.from({ length: 539 }, (_, index) => ({ code: `framework.${index}` })) },
    catalogSkills: [skills[0]!],
  };
  assert.equal(catalogDocument.assessmentFramework.elements.length, 539);
  const result = buildOfficialExamReadiness(catalogDocument.catalogSkills, [], [], [], now);
  assert.equal(result.totalSkills, 1);
  assert.equal(result.coverage, 0);
  assert.equal(result.readiness, null);
});
test('the same mistake is counted once even when its link is duplicated', () => {
  const result = buildOfficialExamReadiness([skills[0]!], [mistake('m1')], [link('m1'), link('m1')], [], now);
  assert.equal(result.skills[0]!.mistakeCount, 1);
});
test('not assessed affects coverage but not the assessed mastery denominator', () => {
  const result = buildOfficialExamReadiness(skills, [mistake('m1')], [link('m1')], [], now);
  assert.equal(result.assessedSkills, 1); assert.equal(result.coverage, 0.1); assert.equal(result.assessedMastery, 0.5);
  assert.equal(result.counts.not_assessed, 9); assert.equal(result.readiness, null);
});
test('readiness appears only after centralized evidence thresholds', () => {
  const mistakes = skills.slice(0, 5).map((_, index) => mistake(`m${index}`));
  const links = mistakes.map((entry, index) => link(entry.id, skills[index]!.code));
  const result = buildOfficialExamReadiness(skills, mistakes, links, [], now);
  assert.equal(result.coverage, 0.5); assert.equal(result.readinessVisible, true); assert.equal(result.readiness, 50);
});
test('readiness remains hidden when skill count passes but coverage is insufficient', () => {
  const largeCatalog = Array.from({ length: 30 }, (_, index) => ({ code: `large.skill.${index}`, subjectCode: 'mathematics', name: `Large ${index}` }));
  const mistakes = largeCatalog.slice(0, 5).map((_, index) => mistake(`large-${index}`));
  const links = mistakes.map((entry, index) => link(entry.id, largeCatalog[index]!.code));
  const result = buildOfficialExamReadiness(largeCatalog, mistakes, links, [], now);
  assert.equal(result.assessedSkills, 5); assert.equal(result.readinessVisible, false); assert.equal(result.readiness, null);
});
test('mastery requires verified recoveries on distinct days after the latest mistake', () => {
  const result = buildOfficialExamReadiness([skills[0]!], [mistake('m1')], [link('m1')], [recovery('r1', 'm1', '2026-09-03T10:00:00Z'), recovery('r2', 'm1', '2026-09-04T10:00:00Z')], now);
  assert.equal(result.skills[0]!.state, 'mastered');
});
test('a new mistake after mastery invalidates earlier recovery evidence', () => {
  const result = buildOfficialExamReadiness([skills[0]!], [mistake('m1'), mistake('m2', '2026-09-05T12:00:00Z')], [link('m1'), link('m2')], [recovery('r1', 'm1', '2026-09-03T10:00:00Z'), recovery('r2', 'm1', '2026-09-04T10:00:00Z')], now);
  assert.notEqual(result.skills[0]!.state, 'mastered');
});
test('low-confidence AI links do not affect metrics until confirmed', () => {
  const low = link('m1', skills[0]!.code, { source: 'ai', confidence: AI_SKILL_LINK_MIN_CONFIDENCE - 0.01 });
  assert.equal(buildOfficialExamReadiness([skills[0]!], [mistake('m1')], [low], [], now).skills[0]!.state, 'not_assessed');
  assert.notEqual(buildOfficialExamReadiness([skills[0]!], [mistake('m1')], [{ ...low, confirmedAt: '2026-09-02T12:00:00Z' }], [], now).skills[0]!.state, 'not_assessed');
});
test('legacy free-text mistakes stay compatible and unclassified', () => {
  assert.equal(buildOfficialExamReadiness([skills[0]!], [mistake('legacy')], [], [], now).skills[0]!.state, 'not_assessed');
});
