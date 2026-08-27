import assert from 'node:assert/strict';
import test from 'node:test';
import { createMistake, groupMistakesBySubject, hasMistakeEvidence, mistakesForSubject, mostFrequentCause } from './core';

test('creates a real timestamped mistake without adding synthetic data', () => {
  const mistake = createMistake(
    { subject: 'mathematics', cause: 'calculation', note: '  Changed the sign.  ' },
    new Date('2026-08-22T12:00:00.000Z'),
    'fixed',
  );
  assert.deepEqual(mistake, {
    id: 'mistake-1787400000000-fixed',
    subject: 'mathematics',
    cause: 'calculation',
    note: 'Changed the sign.',
    createdAt: '2026-08-22T12:00:00.000Z',
  });
});

test('derives cause frequency only from saved mistakes', () => {
  const first = createMistake({ subject: 'physics', cause: 'rushing', note: 'A' }, new Date(1), 'a');
  const second = createMistake({ subject: 'physics', cause: 'rushing', note: 'B' }, new Date(2), 'b');
  const third = createMistake({ subject: 'physics', cause: 'calculation', note: 'C' }, new Date(3), 'c');
  assert.equal(mostFrequentCause([first, second, third]), 'rushing');
  assert.equal(mostFrequentCause([]), null);
});

test('preserves a real question photo without synthesizing question data', () => {
  const mistake = createMistake(
    { subject: 'chemistry', note: 'Balanced oxygen incorrectly.', photoUri: 'file:///questions/chemistry-1.jpg' },
    new Date('2026-08-23T12:00:00.000Z'),
    'photo',
  );
  assert.equal(mistake.photoUri, 'file:///questions/chemistry-1.jpg');
  assert.equal('answer' in mistake, false);
});

test('accepts either a written note or a real question photo as mistake evidence', () => {
  assert.equal(hasMistakeEvidence({ note: 'A sign changed.', photoUri: undefined }), true);
  assert.equal(hasMistakeEvidence({ note: '   ', photoUri: 'file:///question.jpg' }), true);
  assert.equal(hasMistakeEvidence({ note: '   ', photoUri: undefined }), false);
});

test('groups review questions by their real subject and filters a selected topic', () => {
  const mathematics = createMistake({ subject: 'mathematics', note: 'A' }, new Date(3), 'math');
  const physics = createMistake({ subject: 'physics', note: 'B' }, new Date(2), 'physics');
  const mathematicsAgain = createMistake({ subject: 'mathematics', note: 'C' }, new Date(1), 'math-2');
  const groups = groupMistakesBySubject([mathematics, physics, mathematicsAgain]);

  assert.deepEqual(groups.map((group) => [group.subject, group.mistakes.length]), [['mathematics', 2], ['physics', 1]]);
  assert.deepEqual(mistakesForSubject([mathematics, physics, mathematicsAgain], 'physics'), [physics]);
});
