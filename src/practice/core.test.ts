import assert from 'node:assert/strict';
import test from 'node:test';
import { createPracticeAttemptId, normalizeAlternatives } from './core';

test('practice attempt ids are stable only when the caller retains the same id', () => {
  const first = createPracticeAttemptId(10, () => 0.1);
  assert.equal(first, createPracticeAttemptId(10, () => 0.1));
  assert.match(first, /^practice-a-[a-z0-9]+$/);
  assert.notEqual(first, createPracticeAttemptId(11, () => 0.1));
});

test('only safe string alternatives are accepted for a learner-facing question', () => {
  assert.deepEqual(normalizeAlternatives([' A ', 'B']), ['A', 'B']);
  assert.equal(normalizeAlternatives(['A', 2]), null);
  assert.equal(normalizeAlternatives(['A']), null);
});
