import assert from 'node:assert/strict';
import test from 'node:test';
import { nextMilestone, rankingEntryForUser, sortRanking, topRanked, unlockedMilestone, weeklyHighlights, type GroupRankingEntry } from './ranking';

const entry = (userId: string, overrides: Partial<GroupRankingEntry> = {}): GroupRankingEntry => ({
  userId,
  displayName: userId,
  rank: 1,
  previousRank: null,
  rankDelta: 0,
  correctedCount: 0,
  sharedCount: 0,
  correctionRate: 0,
  answerCount: 0,
  activeDays: 0,
  streakDays: 0,
  allTimeCorrectedCount: 0,
  distanceToNextRank: 0,
  ...overrides,
});

test('ranking uses corrections, rate, active days, then a deterministic name tie-break', () => {
  const ranked = sortRanking([
    entry('z', { displayName: 'Zoe', correctedCount: 4, correctionRate: 80, activeDays: 2 }),
    entry('a', { displayName: 'Ana', correctedCount: 4, correctionRate: 90, activeDays: 1 }),
    entry('b', { displayName: 'Bruno', correctedCount: 4, correctionRate: 90, activeDays: 3 }),
    entry('c', { displayName: 'Carlos', correctedCount: 4, correctionRate: 90, activeDays: 3 }),
  ]);
  assert.deepEqual(ranked.map((item) => item.userId), ['b', 'c', 'a', 'z']);
});

test('top three, current user, milestones, and distance-ready entries remain safe for zero activity', () => {
  const entries = [entry('a', { correctedCount: 7, rank: 1 }), entry('b', { correctedCount: 0, rank: 2, distanceToNextRank: 8 })];
  assert.deepEqual(topRanked(entries).map((item) => item.userId), ['a', 'b']);
  assert.equal(rankingEntryForUser(entries, 'b')?.distanceToNextRank, 8);
  assert.equal(rankingEntryForUser(entries, 'missing'), null);
  assert.equal(nextMilestone(0), 1);
  assert.equal(nextMilestone(50), 100);
  assert.equal(nextMilestone(100), null);
  assert.equal(unlockedMilestone(10, 4), 10);
});

test('weekly highlights are capped and never rely on shared-post volume', () => {
  const highlights = weeklyHighlights([
    entry('a', { correctedCount: 4, sharedCount: 999, activeDays: 2, correctionRate: 80, answerCount: 3, rank: 1 }),
    entry('b', { correctedCount: 3, activeDays: 4, correctionRate: 100, answerCount: 3, rankDelta: 3, rank: 2 }),
  ]);
  assert.ok(highlights.length <= 3);
  assert.equal(highlights[0]?.kind, 'mostCorrected');
  assert.equal(highlights[0]?.entry.userId, 'a');
});

test('weekly highlights stay empty without verified correction activity', () => {
  const highlights = weeklyHighlights([
    entry('a', { sharedCount: 20, activeDays: 5, correctionRate: 100, answerCount: 10, rankDelta: 4 }),
    entry('b', { sharedCount: 10, activeDays: 4, correctionRate: 90, answerCount: 8, rankDelta: 2 }),
  ]);
  assert.deepEqual(highlights, []);
});
