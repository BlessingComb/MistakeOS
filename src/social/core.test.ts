import assert from 'node:assert/strict';
import test from 'node:test';
import { awardXp, canJoinLeague, normalizeMembershipsForAccess, weeklyXp } from './core';

test('free may join one active league and pro may join more', () => {
  const memberships = [{ leagueId: 'a', userId: 'u', status: 'active' as const, joinedAt: '2026-08-24T00:00:00Z' }];
  assert.equal(canJoinLeague('free', memberships), false);
  assert.equal(canJoinLeague('pro', memberships), true);
});

test('downgrade preserves memberships but pauses all except one', () => {
  const memberships = [{ leagueId: 'a', userId: 'u', status: 'active' as const, joinedAt: '' }, { leagueId: 'b', userId: 'u', status: 'active' as const, joinedAt: '' }];
  assert.deepEqual(normalizeMembershipsForAccess('free', memberships).map((item) => item.status), ['active', 'paused']);
  assert.deepEqual(normalizeMembershipsForAccess('pro', normalizeMembershipsForAccess('free', memberships)).map((item) => item.status), ['active', 'active']);
});

test('xp is deterministic, idempotent and weekly totals use Monday boundary', () => {
  const base = { userId: 'u', type: 'pattern_resisted' as const, sourceId: 'session-1', createdAt: '2026-08-24T10:00:00Z' };
  const once = awardXp([], base);
  assert.equal(once[0].amount, 20);
  assert.equal(awardXp(once, base).length, 1);
  assert.equal(weeklyXp(once, 'u', new Date('2026-08-24T12:00:00Z')), 20);
});
