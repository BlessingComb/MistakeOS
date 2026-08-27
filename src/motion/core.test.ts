import assert from 'node:assert/strict';
import test from 'node:test';
import { motionTokens as motion } from './tokens';

test('motion tokens keep transitions short and press feedback restrained', () => {
  assert.equal(motion.duration.fast < motion.duration.normal, true);
  assert.equal(motion.duration.normal < motion.duration.slow, true);
  assert.equal(motion.pressScale > 0.97, true);
});
