import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyClassroomLoadFailure } from './errors';

test('classroom errors separate unavailable backend schema from an empty membership list', () => {
  assert.equal(classifyClassroomLoadFailure({ code: 'PGRST202', message: 'Could not find the function' }), 'backend_unavailable');
  assert.equal(classifyClassroomLoadFailure(new Error('CLASSROOMS_UNAVAILABLE')), 'backend_unavailable');
});

test('classroom errors recognize transport errors without exposing their details to the UI', () => {
  assert.equal(classifyClassroomLoadFailure(new TypeError('Network request failed')), 'network');
  assert.equal(classifyClassroomLoadFailure({ message: 'socket timeout' }), 'network');
  assert.equal(classifyClassroomLoadFailure({ message: 'permission denied' }), 'unexpected');
});
