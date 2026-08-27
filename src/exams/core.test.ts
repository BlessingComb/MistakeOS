import assert from 'node:assert/strict';
import test from 'node:test';
import { createExam, sortExams } from './core';
import { EXAMS_STORAGE_KEY, ExamStore } from './storage';

test('creates a normalized exam record and orders the agenda by date', () => {
  const created = createExam({ date: '2026-09-12', subject: 'mathematics', notes: '  Bring calculator.  ' }, new Date('2026-08-24T12:00:00Z'), 'test');
  assert.equal(created.notes, 'Bring calculator.');
  assert.equal(created.id, 'exam-1787572800000-test');
  assert.deepEqual(sortExams([created, { ...created, id: 'earlier', date: '2026-09-01' }]).map((exam) => exam.id), ['earlier', created.id]);
});

test('persists and removes scheduled exams', async () => {
  const data = new Map<string, string>();
  const storage = { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { data.set(key, value); } };
  const store = new ExamStore(storage);
  const record = createExam({ date: '2026-10-01', subject: 'physics', notes: '' }, new Date('2026-08-24T12:00:00Z'), 'one');
  await store.add(record);
  assert.equal((await store.load())[0]?.id, record.id);
  await store.remove(record.id);
  assert.deepEqual(await store.load(), []);
  assert.ok(data.has(EXAMS_STORAGE_KEY));
});
