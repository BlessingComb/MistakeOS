import assert from 'node:assert/strict';
import test from 'node:test';
import { clearAuthFailures, mayAttemptAuth, recordAuthFailure, resetAuthAttemptGuardForTests } from './attemptGuard';

test('temporarily blocks repeated failed authentication attempts', () => {
  resetAuthAttemptGuardForTests();
  const now = 1_800_000_000_000;
  for (let index = 0; index < 5; index += 1) recordAuthFailure('signIn', now + index);
  assert.equal(mayAttemptAuth('signIn', now + 10), false);
  assert.equal(mayAttemptAuth('signIn', now + 15 * 60 * 1000 + 10), true);
});

test('a successful authentication clears only its own failure history', () => {
  resetAuthAttemptGuardForTests();
  recordAuthFailure('signUp', 1);
  clearAuthFailures('signUp');
  assert.equal(mayAttemptAuth('signUp', 2), true);
});
