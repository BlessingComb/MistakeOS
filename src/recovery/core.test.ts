import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRecoverySet, isRecoveryAnswerCorrect } from './core';
import type { MistakeRecord } from '../mistakes';

const cosineMistake: MistakeRecord = { id: 'm1', subject: 'mathematics', cause: 'calculation', note: 'Used +2ab cos(C) in the Law of Cosines.', createdAt: '2026-08-24T00:00:00.000Z' };

test('generates three local recovery questions tied to a Law of Cosines sign mistake', () => {
  const set = generateRecoverySet(cosineMistake);
  assert.equal(set.questions.length, 3);
  assert.match(set.questions[0].prompt, /6 and 9/);
  assert.match(set.questions[2].prompt, /Pattern check/);
  assert.equal(set.questions[0].options[0], 'c² = 6² + 9² − 2(6)(9) cos 45°');
});

test('checks deterministic recovery answers without AI', () => {
  const question = generateRecoverySet(cosineMistake).questions[2];
  assert.equal(isRecoveryAnswerCorrect(question, 0), true);
  assert.equal(isRecoveryAnswerCorrect(question, 1), false);
});
