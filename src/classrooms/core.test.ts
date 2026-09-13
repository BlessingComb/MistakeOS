import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeClassroomInviteCode, sortClassroomAttention, type ClassroomSkillSummary } from './core';

test('normalizes an academic classroom invite code without changing its meaning', () => {
  assert.equal(normalizeClassroomInviteCode(' ab 12-cd '), 'AB12-CD');
});

test('prioritizes class attention with only aggregate categorical counts', () => {
  const items: ClassroomSkillSummary[] = [
    { skillCode: 'a', skillName: 'Algebra', subjectName: 'Mathematics', atRiskCount: 1, learningCount: 9, masteredCount: 0, notAssessedCount: 0 },
    { skillCode: 'b', skillName: 'Biology', subjectName: 'Biology', atRiskCount: 3, learningCount: 1, masteredCount: 0, notAssessedCount: 0 },
  ];
  assert.deepEqual(sortClassroomAttention(items).map((item) => item.skillCode), ['b', 'a']);
});
