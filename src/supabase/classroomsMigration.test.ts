import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync('supabase/migrations/20260912120000_classrooms.sql', 'utf8');

test('classrooms are a separate academic schema with RLS and no social-table reuse', () => {
  for (const table of ['app_user_roles', 'classrooms', 'classroom_members', 'classroom_assignments']) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.doesNotMatch(sql, /study_circles|circle_members|circle_posts/i);
});

test('classroom RPCs derive authorization from auth.uid and expose categorical aggregates only', () => {
  assert.match(sql, /v_user_id uuid := \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /p_user_id/i);
  assert.match(sql, /create or replace function public\.get_classroom_skill_summary/i);
  assert.match(sql, /create or replace function public\.get_my_classroom_progress/i);
  assert.match(sql, /create or replace function public\.list_classroom_roster/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.classroom_skill_states[\s\S]*authenticated/i);
});

test('student evidence stays private and teacher access is aggregate-only', () => {
  const helper = sql.slice(sql.indexOf('create or replace function public.classroom_skill_states'), sql.indexOf('create or replace function public.get_classroom_skill_summary'));
  assert.doesNotMatch(helper, /select\s+.*mistake\.(?:image|photo|summary|description|question)/i);
  assert.match(helper, /returns table\(skill_code text, skill_name text, subject_name text, state text\)/i);
  assert.match(sql, /count\(\*\) filter \(where state = 'at_risk'\)/i);
});
