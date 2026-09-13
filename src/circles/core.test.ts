import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCollectiveEvidence, mostCommonSharedSubject, normalizeInviteCode, type CirclePost } from './core';

const post = (id: string, authorId: string, subject: string): CirclePost => ({ id, authorId, circleId: 'circle', subject, mistakeType: null, problemSummary: 'summary', whatWentWrong: null, lesson: null, preventionRule: null, createdAt: '2026-08-29T00:00:00.000Z' });

test('normalizes invite codes without exposing private data', () => {
  assert.equal(normalizeInviteCode(' abC-12d '), 'ABC-12D');
});

test('collective insight requires sufficient posts from more than one person', () => {
  assert.equal(hasCollectiveEvidence([post('1', 'a', 'Physics'), post('2', 'a', 'Physics'), post('3', 'a', 'Physics')], 1), false);
  assert.equal(hasCollectiveEvidence([post('1', 'a', 'Physics'), post('2', 'b', 'Physics'), post('3', 'b', 'Physics')], 2), true);
});

test('uses only shared post snapshots for common-subject insight', () => {
  assert.deepEqual(mostCommonSharedSubject([post('1', 'a', 'Physics'), post('2', 'b', 'Physics'), post('3', 'a', 'Mathematics')]), { subject: 'Physics', count: 2 });
});
