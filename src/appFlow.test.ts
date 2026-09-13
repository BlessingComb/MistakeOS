import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAuthGate, shouldShowTabBar } from './appFlow';

test('app flow keeps a visitor out of private surfaces while session state is restored', () => {
  assert.equal(resolveAuthGate({ status: 'loading', hasAccount: false, passwordRecovery: false }), 'loading');
  assert.equal(resolveAuthGate({ status: 'ready', hasAccount: false, passwordRecovery: false }), 'visitor');
  assert.equal(resolveAuthGate({ status: 'unavailable', hasAccount: false, passwordRecovery: false }), 'visitor');
});

test('app flow routes a restored session and recovery link to their proper gates', () => {
  assert.equal(resolveAuthGate({ status: 'ready', hasAccount: true, passwordRecovery: false }), 'authenticated');
  assert.equal(resolveAuthGate({ status: 'ready', hasAccount: false, passwordRecovery: true }), 'passwordRecovery');
});

test('app flow keeps tabs for normal study screens and hides them only for focused surfaces', () => {
  assert.equal(shouldShowTabBar('mistakeForm'), true);
  assert.equal(shouldShowTabBar('review'), true);
  assert.equal(shouldShowTabBar('fullscreen'), false);
  assert.equal(shouldShowTabBar('modal'), false);
});
