import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migration = readFileSync('supabase/migrations/20260901202833_study_group_rankings.sql', 'utf8');

describe('study group ranking migration safety', () => {
  it('derives correction events from persisted recovery evidence instead of client counters', () => {
    assert.match(migration, /create table public\.circle_correction_events/i);
    assert.match(migration, /p_recovery_session_id uuid/i);
    assert.doesNotMatch(migration, /p_corrected_count|corrected_count\s+integer\s+not null/i);
    assert.match(migration, /count\(\*\)[\s\S]*correct[\s\S]*pattern_resisted[\s\S]*\) < 2/i);
  });

  it('counts one completed correction per error per group and does not allow direct client writes', () => {
    assert.match(migration, /unique \(circle_id, recovery_session_id\)/i);
    assert.match(migration, /unique \(circle_id, mistake_id\)/i);
    assert.match(migration, /revoke all on public\.circle_correction_events from anon, authenticated/i);
    assert.match(migration, /on conflict do nothing/i);
  });

  it('protects ranking data with membership checks, RLS, and explicit RPC grants', () => {
    assert.match(migration, /alter table public\.circle_correction_events enable row level security/i);
    assert.match(migration, /Circle membership required/i);
    assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
    assert.match(migration, /grant execute on function public\.record_study_group_correction\(uuid\), public\.get_study_group_ranking\(uuid, text\) to authenticated/i);
  });

  it('keeps private mistake content out of the ranking table and response', () => {
    assert.doesNotMatch(migration, /question_photo|problem_summary|what_went_wrong|repair_rule/i);
    assert.match(migration, /display_name text,[\s\S]*corrected_count integer,[\s\S]*correction_rate numeric/i);
  });
});
