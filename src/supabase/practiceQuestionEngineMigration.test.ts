import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const sql = readFileSync('supabase/migrations/20260913120000_practice_question_engine.sql', 'utf8');
test('practice foundation preserves provenance and keeps answer keys server-side', () => {
  assert.match(sql, /create table public\.practice_question_sources/i);
  assert.match(sql, /rights_status text not null/i);
  assert.match(sql, /source_type in \('historical','generated'\)/i);
  assert.match(sql, /revoke all on public\.practice_question_sources, public\.practice_questions, public\.practice_question_skill_links from anon, authenticated/i);
  assert.match(sql, /returns table \(question_id uuid, statement text, alternatives jsonb, source_type text, source_label text, difficulty_profile jsonb\)/i);
  assert.match(sql, /q\.source_type = 'generated' or source\.rights_status = 'cleared'/i);
});
test('practice recovery derives identity and correctness in a secure RPC', () => {
  assert.match(sql, /submit_practice_recovery[\s\S]*security definer set search_path = ''/i);
  assert.match(sql, /v_user_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /p_skill_code text/i);
  assert.match(sql, /q\.catalog_version_id = v_catalog_id/i);
  assert.match(sql, /question_skill\.skill_code = p_skill_code/i);
  assert.match(sql, /question\.correct_answer = input\.selected_answer/i);
  assert.match(sql, /on conflict \(user_id, client_id\) do nothing/i);
  assert.match(sql, /generator_type in \('local','ai','practice'\)/i);
});
