import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migration = readFileSync('supabase/migrations/20260825010532_social_system.sql', 'utf8');

describe('social migration safety', () => {
  it('reuses an existing Auth-compatible profiles table', () => {
    assert.match(migration, /create table if not exists public\.profiles/);
    assert.match(migration, /add column if not exists display_name/);
    assert.match(migration, /references auth\.users\(id\) on delete cascade/);
  });

  it('makes every social schema object safe to encounter again', () => {
    assert.equal((migration.match(/create table if not exists public\./g) ?? []).length, 6);
    assert.equal((migration.match(/create index if not exists/g) ?? []).length, 3);
    assert.match(migration, /to_regtype\('public\.league_member_status'\) is null/);
    assert.match(migration, /from pg_policies/);
  });

  it('does not delete data or revoke unrelated public tables', () => {
    assert.doesNotMatch(migration, /drop\s+(table|schema)|truncate\s+/i);
    assert.doesNotMatch(migration, /revoke all on all tables in schema public/i);
    assert.match(migration, /revoke all privileges on table\s+public\.profiles,/i);
  });

  it('keeps social writes server-only while allowing profile ownership writes', () => {
    assert.match(migration, /grant select, insert, update on table public\.profiles to authenticated/i);
    assert.match(migration, /grant select on table\s+public\.leagues,/i);
  });
});
