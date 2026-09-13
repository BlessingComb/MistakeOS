import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ensureFreshLocalCache, LOCAL_CACHE_RESET_KEY, LOCAL_CACHE_RESET_VERSION } from './localReset';

class MemoryStorage {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

describe('local data schema', () => {
  it('records the schema version without clearing learning or unrelated data', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@mistakeos/mistakes:v1', 'old');
    storage.values.set('@mistakeos/exams:v1', 'old');
    storage.values.set('@mistakeos/theme:v1', 'dark');
    assert.equal(await ensureFreshLocalCache(storage), true);
    assert.equal(storage.values.get('@mistakeos/mistakes:v1'), 'old');
    assert.equal(storage.values.get('@mistakeos/exams:v1'), 'old');
    assert.equal(storage.values.get('@mistakeos/theme:v1'), 'dark');
    assert.equal(storage.values.get(LOCAL_CACHE_RESET_KEY), LOCAL_CACHE_RESET_VERSION);
    assert.equal(await ensureFreshLocalCache(storage), false);
  });
});
