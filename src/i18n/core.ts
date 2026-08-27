import { en, TranslationKey } from './en';
import { ptBR } from './ptBR';

export type AppLanguage = 'en' | 'pt-BR';
export type TranslationParams = Record<string, string | number>;

export interface LanguageStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = '@mistakeos/language:v1';
export const FEATURE_NAMES = ['Mistake DNA', 'Risk Score', 'Never Again', 'Exam Prep Map', 'Mapa de Preparação', 'MistakeOS'] as const;

export const catalogs: Record<AppLanguage, Record<TranslationKey, string>> = {
  en,
  'pt-BR': ptBR,
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'pt-BR';
}

export function detectLanguage(localeTags: readonly string[]): AppLanguage {
  for (const tag of localeTags) {
    const normalized = tag.toLowerCase();
    if (normalized === 'pt' || normalized.startsWith('pt-')) return 'pt-BR';
  }
  return DEFAULT_LANGUAGE;
}

export function translate(language: AppLanguage, key: TranslationKey, params: TranslationParams = {}): string {
  const template = catalogs[language]?.[key] ?? en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

export function localeForLanguage(language: AppLanguage): string {
  return language === 'pt-BR' ? 'pt-BR' : 'en-US';
}

type Listener = (language: AppLanguage) => void;

export class LanguageController {
  private listeners = new Set<Listener>();
  private readonly detectedLanguage: AppLanguage;

  language: AppLanguage;

  constructor(
    private readonly storage: LanguageStorage,
    deviceLocaleTags: readonly string[],
  ) {
    this.detectedLanguage = detectLanguage(deviceLocaleTags);
    this.language = this.detectedLanguage;
  }

  async initialize(): Promise<AppLanguage> {
    try {
      const savedLanguage = await this.storage.getItem(LANGUAGE_STORAGE_KEY);
      this.update(isAppLanguage(savedLanguage) ? savedLanguage : this.detectedLanguage);
    } catch {
      this.update(this.detectedLanguage);
    }
    return this.language;
  }

  async setLanguage(language: AppLanguage): Promise<void> {
    this.update(language);
    try {
      await this.storage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The runtime choice remains active even if local persistence is unavailable.
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(language: AppLanguage) {
    if (language === this.language) return;
    this.language = language;
    this.listeners.forEach((listener) => listener(language));
  }
}
