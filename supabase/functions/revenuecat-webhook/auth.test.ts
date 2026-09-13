import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isAuthorizedRevenueCatRequest } from './auth';

const request = (value?: string) => ({ headers: { get: (name: string) => name === 'authorization' ? value ?? null : null } });

test('webhook without Authorization is rejected', () => assert.equal(isAuthorizedRevenueCatRequest(request(), 'secret'), false));
test('webhook with invalid Authorization is rejected', () => assert.equal(isAuthorizedRevenueCatRequest(request('Bearer wrong'), 'secret'), false));
test('webhook with correct Authorization is allowed', () => assert.equal(isAuthorizedRevenueCatRequest(request('Bearer secret'), 'secret'), true));
test('authorization helper does not log or expose secrets', () => {
  const source = readFileSync(new URL('./auth.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('console.'), false);
});
