import assert from 'node:assert/strict';
import test from 'node:test';
import { createExam } from '../exams/core';
import { createMistake } from '../mistakes/core';
import { buildExamPrepMap, upcomingExam } from './core';
import { PrepMapEvidenceStore } from './storage';

const now = new Date('2026-09-01T12:00:00Z');
const exam = createExam({ date: '2026-09-04', subject: 'mathematics', notes: '' }, now, 'math');

test('prioritizes only real mistakes relevant to the next exam subject', () => {
  const mathRecent = createMistake({ subject: 'mathematics', cause: 'calculation', note: 'I lost a sign.' }, new Date('2026-08-30T12:00:00Z'), 'one');
  const mathOlder = createMistake({ subject: 'mathematics', cause: 'calculation', note: 'I lost another sign.' }, new Date('2026-08-15T12:00:00Z'), 'two');
  const physics = createMistake({ subject: 'physics', cause: 'conceptRecall', note: 'I forgot the formula.' }, now, 'three');
  const map = buildExamPrepMap(exam, [physics, mathOlder, mathRecent], {}, now);
  assert.equal(map.items.length, 1);
  assert.equal(map.items[0]?.subject, 'mathematics');
  assert.equal(map.items[0]?.mistakes.length, 2);
  assert.equal(map.items[0]?.state, 'HIGH RISK');
  assert.equal(map.pointsAtRisk > 0, true);
});

test('keeps separate content topics inside the same subject', () => {
  const exam = createExam({ subject: 'mathematics', date: '2026-09-02', notes: '' }, new Date('2026-08-25'), 'topic');
  const cosine = createMistake({ subject: 'mathematics', topic: 'Law of Cosines', note: 'Sign', cause: 'calculation' }, new Date('2026-08-24'), 'cos');
  const algebra = createMistake({ subject: 'mathematics', topic: 'Linear equations', note: 'Isolation', cause: 'calculation' }, new Date('2026-08-24'), 'alg');
  const map = buildExamPrepMap(exam, [cosine, algebra]);
  assert.deepEqual(map.items.map((item) => item.topic), ['Law of Cosines', 'Linear equations']);
});

test('review evidence deterministically lowers risk and changes preparation state', () => {
  const mistake = createMistake({ subject: 'mathematics', cause: 'calculation', note: 'I lost a sign.' }, now, 'one');
  const before = buildExamPrepMap(exam, [mistake], {}, now).items[0]!;
  const after = buildExamPrepMap(exam, [mistake], { [mistake.id]: 3 }, now).items[0]!;
  assert.equal(after.riskScore < before.riskScore, true);
  assert.equal(after.state, 'MASTERED');
});

test('selects the next upcoming exam and persists real review evidence', async () => {
  const older = createExam({ date: '2026-08-31', subject: 'physics', notes: '' }, now, 'old');
  assert.equal(upcomingExam([older, exam], now)?.id, exam.id);
  const values = new Map<string, string>();
  const store = new PrepMapEvidenceStore({ getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
  assert.deepEqual(await store.recordReview(['mistake-a', 'mistake-a']), { 'mistake-a': 2 });
});
