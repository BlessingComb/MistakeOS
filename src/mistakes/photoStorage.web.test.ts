import assert from 'node:assert/strict';
import test from 'node:test';
import { persistQuestionPhoto } from './photoStorage.web';

test('web photo storage keeps a lightweight URI instead of serializing Base64 into AsyncStorage', async () => {
  const uri = 'blob:http://localhost:8081/question-photo';
  const result = await persistQuestionPhoto(uri, 'very-large-base64-payload', 'image/jpeg');
  assert.equal(result, uri);
});
