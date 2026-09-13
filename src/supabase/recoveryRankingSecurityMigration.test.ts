import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260903133000_verified_recovery_rankings.sql', 'utf8');

test('ranking accepts only server-verified recovery evidence', () => {
  assert.match(migration, /revoke insert, update on public\.recovery_sessions from authenticated/i);
  assert.match(migration, /revoke insert, update on public\.recovery_answers from authenticated/i);
  assert.match(migration, /create or replace function public\.submit_verified_recovery/i);
  assert.match(migration, /verified_at is not null/i);
  assert.match(migration, /selectedOption/i);
});

test('ranking reads verified correction events rather than client-written answers', () => {
  assert.match(migration, /event\.verified_at is not null/i);
  assert.match(migration, /revoke all on function public\.record_study_group_correction\(uuid\) from public, anon, authenticated/i);
});

test('ranking SQL resolves return-column names as table columns', () => {
  const fix = readFileSync('supabase/migrations/20260903136000_fix_ranking_variable_conflict.sql', 'utf8');
  assert.match(fix, /language sql/i);
  assert.match(fix, /correction\.user_id = member\.user_id/i);
});
