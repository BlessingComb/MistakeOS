import assert from 'node:assert/strict';
import test from 'node:test';
import { MistakeStore, MISTAKES_STORAGE_KEY } from './storage';

test('drops only legacy inline photo data before saving a new mistake', async () => {
  const values = new Map<string, string>();
  values.set(MISTAKES_STORAGE_KEY, JSON.stringify([{
    id: 'mistake-legacy',
    subject: 'mathematics',
    note: 'Legacy image record',
    createdAt: '2026-08-24T00:00:00.000Z',
    photoUri: 'data:image/jpeg;base64,very-large-photo',
  }]));
  const store = new MistakeStore({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  });

  const saved = await store.add({
    id: 'mistake-new',
    subject: 'physics',
    note: 'New record',
    createdAt: '2026-08-24T01:00:00.000Z',
  });

  assert.equal(saved[1].photoUri, undefined);
  assert.equal(values.get(MISTAKES_STORAGE_KEY)?.includes('very-large-photo'), false);
});
