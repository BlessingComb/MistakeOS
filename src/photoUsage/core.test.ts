import assert from 'node:assert/strict';
import test from 'node:test';
import { canAddPhoto, FREE_DAILY_PHOTO_LIMIT, normalizeDailyPhotoUsage, photoLimitFor, PRO_DAILY_PHOTO_LIMIT } from './core';

const today = new Date(2026, 7, 30, 12);
test('daily photo use resets on a new local day', () => {
  assert.deepEqual(normalizeDailyPhotoUsage({ day: '2026-08-29', used: 5 }, today), { day: '2026-08-30', used: 0 });
});
test('free and pro photo limits are distinct', () => {
  assert.equal(photoLimitFor('free'), FREE_DAILY_PHOTO_LIMIT);
  assert.equal(photoLimitFor('pro'), PRO_DAILY_PHOTO_LIMIT);
  assert.equal(canAddPhoto({ day: '2026-08-30', used: 5 }, 'free'), false);
  assert.equal(canAddPhoto({ day: '2026-08-30', used: 49 }, 'pro'), true);
  assert.equal(canAddPhoto({ day: '2026-08-30', used: 50 }, 'pro'), false);
});
