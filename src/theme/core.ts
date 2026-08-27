import type { ThemeMode } from '../theme';

export const THEME_STORAGE_KEY = '@mistakeos/theme:v1';

export function normalizeTheme(value: string | null | undefined): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}
