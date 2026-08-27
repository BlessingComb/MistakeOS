import { deriveInitialProfile, EMPTY_ANSWERS, OnboardingAnswers, OnboardingRecord } from './core';

export const ONBOARDING_STORAGE_KEY = '@mistakeos/onboarding:v1';

export interface OnboardingStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function parseRecord(value: string | null): OnboardingRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OnboardingRecord>;
    if (parsed.version !== 1 || parsed.completed !== true || typeof parsed.completedAt !== 'string') return null;
    return parsed as OnboardingRecord;
  } catch {
    return null;
  }
}

export class OnboardingStore {
  constructor(private readonly storage: OnboardingStorage) {}

  async load(): Promise<OnboardingRecord | null> {
    return parseRecord(await this.storage.getItem(ONBOARDING_STORAGE_KEY));
  }

  async complete(answers: OnboardingAnswers, completedAt = new Date().toISOString()): Promise<OnboardingRecord> {
    const record: OnboardingRecord = {
      version: 1,
      completed: true,
      skipped: false,
      completedAt,
      answers,
      profile: deriveInitialProfile(answers),
    };
    await this.storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(record));
    return record;
  }

  async skip(completedAt = new Date().toISOString()): Promise<OnboardingRecord> {
    const record: OnboardingRecord = {
      version: 1,
      completed: true,
      skipped: true,
      completedAt,
      answers: EMPTY_ANSWERS,
      profile: null,
    };
    await this.storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(record));
    return record;
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(ONBOARDING_STORAGE_KEY);
  }
}
