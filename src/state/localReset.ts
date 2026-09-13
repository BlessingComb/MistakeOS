import { clearQuestionPhotos } from '../mistakes/photoStorage';

export const LOCAL_CACHE_RESET_KEY = '@mistakeos/local-data-schema:v1';
export const LOCAL_CACHE_RESET_VERSION = 'preserve-learning-data';

const learningKeys = [
  '@mistakeos/onboarding:v1',
  '@mistakeos/mistakes:v1',
  '@mistakeos/exams:v1',
  '@mistakeos/exam-prep-map:evidence:v1',
  '@mistakeos/photo-usage:v1',
] as const;

export interface ResetStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Records the local schema version without discarding a learner's progress.
 *
 * A previous startup migration removed every learning record and photo. Startup
 * migrations must be non-destructive: account deletion is the only path that
 * intentionally clears these artifacts.
 */
export async function ensureFreshLocalCache(storage: ResetStorage): Promise<boolean> {
  if (await storage.getItem(LOCAL_CACHE_RESET_KEY) === LOCAL_CACHE_RESET_VERSION) return false;
  await storage.setItem(LOCAL_CACHE_RESET_KEY, LOCAL_CACHE_RESET_VERSION);
  return true;
}

/** Clears local learning artifacts only after a confirmed account deletion. */
export async function clearPersonalLearningData(storage: ResetStorage): Promise<void> {
  // Remote account deletion has already completed. Continue clearing every
  // local artifact even if one storage backend is temporarily unavailable.
  await Promise.allSettled([...learningKeys.map((key) => storage.removeItem(key)), clearQuestionPhotos()]);
}
