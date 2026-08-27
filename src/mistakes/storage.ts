import { MistakeRecord } from './core';

export const MISTAKES_STORAGE_KEY = '@mistakeos/mistakes:v1';

export interface MistakeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class MistakeStore {
  constructor(private readonly storage: MistakeStorage) {}

  async load(): Promise<MistakeRecord[]> {
    try {
      const value = await this.storage.getItem(MISTAKES_STORAGE_KEY);
      if (!value) return [];
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(dropLegacyPhotoData) : [];
    } catch {
      return [];
    }
  }

  async add(mistake: MistakeRecord): Promise<MistakeRecord[]> {
    const current = await this.load();
    const next = [mistake, ...current];
    await this.storage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async replaceAll(mistakes: readonly MistakeRecord[]): Promise<MistakeRecord[]> {
    const next = [...mistakes];
    await this.storage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}

// Older web builds placed a complete Base64 image inside AsyncStorage
// (localStorage on web). Keeping that data causes quota failures when a new
// mistake is saved. Photo bytes now live in IndexedDB and records retain only
// a short reference, so discard only the legacy inline image field here.
function dropLegacyPhotoData(value: unknown): MistakeRecord {
  const mistake = value as MistakeRecord;
  if (typeof mistake?.photoUri === 'string' && mistake.photoUri.startsWith('data:image/')) {
    const { photoUri: _photoUri, ...withoutPhoto } = mistake;
    return withoutPhoto;
  }
  return mistake;
}
