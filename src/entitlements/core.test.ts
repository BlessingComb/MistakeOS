import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntitlements, hasCapability } from './core';

test('free users retain all essential product capabilities', () => {
  const free = createEntitlements();
  assert.equal(free.level, 'free');
  assert.equal(free.has('log_mistakes'), true);
  assert.equal(free.has('basic_mistake_dna'), true);
  assert.equal(free.has('essential_reviews'), true);
  assert.equal(free.has('deeper_mistake_dna'), false);
});

test('pro foundation exposes future capabilities without affecting free access', () => {
  assert.equal(hasCapability('pro', 'advanced_risk_score'), true);
  assert.equal(hasCapability('pro', 'unlimited_never_again'), true);
  assert.equal(hasCapability('pro', 'advanced_exam_prep_map'), true);
  assert.equal(hasCapability('free', 'log_mistakes'), true);
});
