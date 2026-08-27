import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeWithGroq, validateGroqAnalysisRequest } from './groq';

test('server accepts only supported images and languages', () => {
  assert.deepEqual(validateGroqAnalysisRequest({ imageBase64: 'abc', mimeType: 'image/jpeg', language: 'pt-BR' }), { imageBase64: 'abc', mimeType: 'image/jpeg', language: 'pt-BR' });
  assert.equal(validateGroqAnalysisRequest({ imageBase64: 'abc', mimeType: 'image/svg+xml', language: 'pt-BR' }), null);
  assert.equal(validateGroqAnalysisRequest({ imageBase64: 'abc', mimeType: 'image/jpeg', language: 'fr' }), null);
});

test('server sends the image to Groq and validates its structured response', async () => {
  let capturedUrl = '';
  let capturedAuthorization = '';
  let capturedBody = '';
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedAuthorization = String((init?.headers as Record<string, string>)?.authorization);
    capturedBody = String(init?.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      status: 'identified', transcription: '2 + 2 = 5', errorSummary: 'Addition error', explanation: 'The sum is four.',
      correctionSteps: ['Add the two values again.'], suggestedSubject: 'mathematics', suggestedCause: 'calculation', confidence: 'high',
    }) } }] }), { status: 200 });
  };
  const result = await analyzeWithGroq({ imageBase64: 'abc', mimeType: 'image/jpeg', language: 'en' }, 'secret-test-key', 'groq-test', fetcher as typeof fetch);
  assert.equal(capturedUrl, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(capturedAuthorization, 'Bearer secret-test-key');
  assert.match(capturedBody, /data:image\/jpeg;base64,abc/);
  assert.equal(result.analysis.model, 'groq-test');
});
