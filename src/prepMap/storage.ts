import type { ReviewEvidence } from './core';

export const PREP_MAP_EVIDENCE_STORAGE_KEY = '@mistakeos/exam-prep-map:evidence:v1';

export interface PrepMapStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class PrepMapEvidenceStore {
  constructor(private readonly storage: PrepMapStorage) {}

  async load(): Promise<ReviewEvidence> {
    try {
      const raw = await this.storage.getItem(PREP_MAP_EVIDENCE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 0));
    } catch { return {}; }
  }

  async recordReview(mistakeIds: readonly string[]): Promise<ReviewEvidence> {
    const current = await this.load();
    const next = { ...current };
    mistakeIds.forEach((id) => { next[id] = (next[id] ?? 0) + 1; });
    await this.storage.setItem(PREP_MAP_EVIDENCE_STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}
