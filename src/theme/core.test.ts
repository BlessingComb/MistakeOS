import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTheme, THEME_STORAGE_KEY } from './core';

test('theme preference uses a versioned storage key', () => {
  assert.equal(THEME_STORAGE_KEY, '@mistakeos/theme:v1');
});

test('theme preference accepts light and safely defaults to dark', () => {
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('unexpected'), 'dark');
  assert.equal(normalizeTheme(null), 'dark');
});
