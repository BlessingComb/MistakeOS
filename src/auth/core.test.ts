import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidEmail, isValidPassword, normalizeAuthForm, validateAuthForm } from './core';

const base = { displayName: ' Alex Rivera ', email: ' ALEX@EXAMPLE.COM ', password: 'safe-pass-9', passwordConfirmation: 'safe-pass-9' };

describe('account form validation', () => {
  it('normalizes only display and email fields', () => {
    assert.deepEqual(normalizeAuthForm(base), { ...base, displayName: 'Alex Rivera', email: 'alex@example.com' });
  });

  it('requires a valid email and a durable password for sign in', () => {
    assert.equal(validateAuthForm('signIn', { ...base, email: 'invalid' }), 'email');
    assert.equal(validateAuthForm('signIn', { ...base, password: 'short' }), 'password');
  });

  it('requires a valid display name and matching password confirmation for sign up', () => {
    assert.equal(validateAuthForm('signUp', { ...base, displayName: 'A' }), 'name');
    assert.equal(validateAuthForm('signUp', { ...base, passwordConfirmation: 'different' }), 'passwordConfirmation');
    assert.equal(validateAuthForm('signUp', base), null);
  });

  it('validates password-recovery credentials without normalizing the password', () => {
    assert.equal(isValidEmail(' person@example.com '), true);
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(isValidPassword('safe-pass-9'), true);
    assert.equal(isValidPassword('short'), false);
  });
});
