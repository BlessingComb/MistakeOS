import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('photo analysis limits are daily and preserve the existing usage schema', () => {
  const migration = readFileSync('supabase/migrations/20260903120000_daily_ai_photo_limits.sql', 'utf8');
  assert.match(migration, /add column if not exists daily_limit integer/);
  assert.match(migration, /'free' then 5 when 'pro' then 50/);
  assert.match(migration, /date_trunc\('day', now\(\)\)/);
  assert.match(migration, /select daily_limit into v_limit/);
  assert.match(migration, /monthly_limit/);
});

test('completion-time allowance requires the explicit Pro entitlement', () => {
  const migration = readFileSync('supabase/migrations/20260903135000_scope_ai_entitlement_to_pro.sql', 'utf8');
  assert.match(migration, /entitlement_id = 'pro'/i);
  assert.match(migration, /grant execute on function public\.complete_ai_analysis[\s\S]*to service_role/i);
});
