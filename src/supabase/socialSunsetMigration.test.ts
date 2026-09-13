import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync('supabase/migrations/20260912110000_disable_social_writes.sql', 'utf8');

test('freezes new social writes without deleting historical social data', () => {
  assert.match(sql, /revoke insert, update, delete on table[\s\S]*public\.study_circles[\s\S]*public\.circle_reactions[\s\S]*from authenticated/i);
  assert.match(sql, /revoke execute on function public\.create_study_circle/i);
  assert.doesNotMatch(sql, /drop\s+table|truncate\s+/i);
});

test('verified recoveries remain personal and no longer create social ranking events', () => {
  const functionBody = sql.slice(sql.indexOf('create or replace function public.submit_verified_recovery'));
  assert.match(functionBody, /security definer/i);
  assert.match(functionBody, /set search_path = ''/i);
  assert.doesNotMatch(functionBody, /circle_correction_events/i);
});
