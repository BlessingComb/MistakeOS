import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveInitialProfile, type OnboardingAnswers } from './core';
import { ONBOARDING_STORAGE_KEY, OnboardingStore, type OnboardingStorage } from './storage';

class MemoryStorage implements OnboardingStorage {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

const answers: OnboardingAnswers = {
  subjects: ['mathematics', 'physics'],
  causes: ['conceptRecall', 'rushing'],
  goal: 'stopRepeating',
};

test('first launch has no completion record and therefore shows onboarding', async () => {
  const store = new OnboardingStore(new MemoryStorage());
  assert.equal(await store.load(), null);
});

test('completed onboarding persists and does not reappear after reload', async () => {
  const storage = new MemoryStorage();
  const store = new OnboardingStore(storage);
  await store.complete(answers, '2026-08-22T10:00:00.000Z');

  const reloaded = await new OnboardingStore(storage).load();
  assert.equal(reloaded?.completed, true);
  assert.equal(reloaded?.skipped, false);
  assert.deepEqual(reloaded?.answers, answers);
  assert.ok(storage.values.has(ONBOARDING_STORAGE_KEY));
});

test('reset removes completion and onboarding appears again', async () => {
  const storage = new MemoryStorage();
  const store = new OnboardingStore(storage);
  await store.complete(answers);
  await store.reset();
  assert.equal(await store.load(), null);
});

test('initial profile contains only causes explicitly provided by the user', () => {
  const profile = deriveInitialProfile(answers);
  assert.deepEqual(profile, {
    primaryRisk: 'conceptRecall',
    secondaryRisk: 'rushing',
    evidence: ['conceptRecall', 'rushing'],
    source: 'self_reported',
  });
  assert.equal(deriveInitialProfile({ ...answers, causes: [] }), null);
});
