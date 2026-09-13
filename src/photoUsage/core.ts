export const PHOTO_USAGE_STORAGE_KEY = '@mistakeos/photo-usage:v1';
export const FREE_DAILY_PHOTO_LIMIT = 5;
export const PRO_DAILY_PHOTO_LIMIT = 50;

export type DailyPhotoUsage = { day: string; used: number };
export type PhotoUsageStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

export function localDayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDailyPhotoUsage(value: unknown, now = new Date()): DailyPhotoUsage {
  const day = localDayKey(now);
  if (!value || typeof value !== 'object') return { day, used: 0 };
  const parsed = value as Partial<DailyPhotoUsage>;
  return parsed.day === day && Number.isInteger(parsed.used) && (parsed.used ?? 0) >= 0 ? { day, used: parsed.used ?? 0 } : { day, used: 0 };
}

export function photoLimitFor(level: 'free' | 'pro') { return level === 'pro' ? PRO_DAILY_PHOTO_LIMIT : FREE_DAILY_PHOTO_LIMIT; }
export function canAddPhoto(usage: DailyPhotoUsage, level: 'free' | 'pro') { return usage.used < photoLimitFor(level); }

export class DailyPhotoUsageStore {
  constructor(private readonly storage: PhotoUsageStorage) {}
  async load(now = new Date()): Promise<DailyPhotoUsage> {
    try { return normalizeDailyPhotoUsage(JSON.parse((await this.storage.getItem(PHOTO_USAGE_STORAGE_KEY)) ?? 'null'), now); } catch { return { day: localDayKey(now), used: 0 }; }
  }
  async consume(level: 'free' | 'pro', now = new Date()): Promise<DailyPhotoUsage | null> {
    const current = await this.load(now);
    if (!canAddPhoto(current, level)) return null;
    const next = { ...current, used: current.used + 1 };
    await this.storage.setItem(PHOTO_USAGE_STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}
