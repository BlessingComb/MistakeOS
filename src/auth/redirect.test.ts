import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_CALLBACK_REDIRECT, parseAuthRedirect, PASSWORD_RESET_REDIRECT } from './redirect';

test('uses dedicated MistakeOS callbacks for sign-up and password recovery', () => {
  assert.equal(AUTH_CALLBACK_REDIRECT, 'mistakeos://auth/callback');
  assert.equal(PASSWORD_RESET_REDIRECT, 'mistakeos://reset-password');
});

test('accepts a session callback only from the MistakeOS scheme', () => {
  assert.deepEqual(parseAuthRedirect('mistakeos://auth/callback?code=one-time-code&type=signup'), { recovery: false, code: 'one-time-code', accessToken: undefined, refreshToken: undefined });
  assert.equal(parseAuthRedirect('https://example.com/auth/callback?code=one-time-code'), null);
});

test('recognizes recovery callbacks whether Supabase returns query or fragment parameters', () => {
  assert.deepEqual(parseAuthRedirect('mistakeos://reset-password?code=one-time-code&type=recovery'), { recovery: true, code: 'one-time-code', accessToken: undefined, refreshToken: undefined });
  assert.deepEqual(parseAuthRedirect('mistakeos://reset-password#access_token=access&refresh_token=refresh&type=recovery'), { recovery: true, code: undefined, accessToken: 'access', refreshToken: 'refresh' });
});
