import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogs,
  detectLanguage,
  FEATURE_NAMES,
  LANGUAGE_STORAGE_KEY,
  LanguageController,
  localeForLanguage,
  translate,
  type LanguageStorage,
} from './core';

class MemoryStorage implements LanguageStorage {
  values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('detects Portuguese variants and defaults unsupported locales to English', () => {
  assert.equal(detectLanguage(['pt-BR']), 'pt-BR');
  assert.equal(detectLanguage(['pt-PT']), 'pt-BR');
  assert.equal(detectLanguage(['es-MX', 'fr-FR']), 'en');
  assert.equal(detectLanguage([]), 'en');
});

test('saved preference overrides device detection and invalid values fall back safely', async () => {
  const storage = new MemoryStorage();
  storage.values.set(LANGUAGE_STORAGE_KEY, 'en');
  const saved = new LanguageController(storage, ['pt-BR']);
  assert.equal(await saved.initialize(), 'en');

  storage.values.set(LANGUAGE_STORAGE_KEY, 'invalid-locale');
  const fallback = new LanguageController(storage, ['pt-BR']);
  assert.equal(await fallback.initialize(), 'pt-BR');
});

test('runtime language switching notifies subscribers and persists immediately', async () => {
  const storage = new MemoryStorage();
  const controller = new LanguageController(storage, ['en-US']);
  const changes: string[] = [];
  controller.subscribe((language) => changes.push(language));

  await controller.setLanguage('pt-BR');

  assert.equal(controller.language, 'pt-BR');
  assert.equal(storage.values.get(LANGUAGE_STORAGE_KEY), 'pt-BR');
  assert.deepEqual(changes, ['pt-BR']);
});

test('English and Portuguese catalogs have the same complete key set', () => {
  const englishKeys = Object.keys(catalogs.en).sort();
  const portugueseKeys = Object.keys(catalogs['pt-BR']).sort();
  assert.deepEqual(portugueseKeys, englishKeys);
  assert.ok(englishKeys.length > 100);
  for (const key of englishKeys) {
    assert.ok(catalogs.en[key as keyof typeof catalogs.en].trim());
    assert.ok(catalogs['pt-BR'][key as keyof typeof catalogs.en].trim());
  }
});

test('essential translations and product feature names are preserved', () => {
  assert.equal(translate('en', 'home.headline'), 'Your risk has a pattern.');
  assert.equal(translate('pt-BR', 'home.headline'), 'Seu risco tem um padrão.');
  assert.equal(translate('en', 'dna.title'), 'Mistake DNA');
  assert.equal(translate('pt-BR', 'dna.title'), 'Mistake DNA');
  assert.equal(translate('en', 'prepMap.title'), 'Exam Prep Map');
  assert.equal(translate('pt-BR', 'prepMap.title'), 'Mapa de Preparação');

  for (const featureName of FEATURE_NAMES) {
    const combinedCatalog = `${Object.values(catalogs.en).join(' ')} ${Object.values(catalogs['pt-BR']).join(' ')}`;
    assert.ok(combinedCatalog.includes(featureName));
  }
});

test('interpolation and locale-sensitive date and number formatting work', () => {
  assert.equal(translate('en', 'home.examInDays', { count: 14 }), 'EXAM IN 14 DAYS');
  assert.equal(translate('pt-BR', 'home.examInDays', { count: 14 }), 'PROVA EM 14 DIAS');
  const date = new Date(Date.UTC(2026, 7, 22));
  assert.match(new Intl.DateTimeFormat(localeForLanguage('en'), { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date), /August/);
  assert.match(new Intl.DateTimeFormat(localeForLanguage('pt-BR'), { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date), /agosto/);
  assert.equal(new Intl.NumberFormat(localeForLanguage('en')).format(2.4), '2.4');
  assert.equal(new Intl.NumberFormat(localeForLanguage('pt-BR')).format(2.4), '2,4');
});
