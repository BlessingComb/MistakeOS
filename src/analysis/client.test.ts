import assert from 'node:assert/strict';
import test from 'node:test';
import { requestQuestionPhotoAnalysis } from './service';

const validAnalysis = {
  status: 'identified', transcription: 'visible work', errorSummary: 'Sign error', explanation: 'The sign changed.',
  correctionSteps: ['Keep the negative sign.'], suggestedSubject: 'mathematics', suggestedCause: 'calculation', confidence: 'medium',
};

test('analysis client accepts only validated structured output', async () => {
  const fetcher = async () => new Response(JSON.stringify({ analysis: validAnalysis, model: 'groq-test' }), { status: 200, headers: { 'content-type': 'application/json' } });
  const result = await requestQuestionPhotoAnalysis('https://analysis.example.test', { base64: 'abc', mimeType: 'image/jpeg' }, 'en', fetcher as typeof fetch);
  assert.equal(result.status, 'success');
  if (result.status === 'success') assert.equal(result.analysis.model, 'groq-test');
});

test('analysis client exposes free-tier rate limits without inventing a result', async () => {
  const fetcher = async () => new Response(JSON.stringify({ code: 'rate_limited' }), { status: 429 });
  assert.deepEqual(await requestQuestionPhotoAnalysis('https://analysis.example.test', { base64: 'abc', mimeType: 'image/jpeg' }, 'pt-BR', fetcher as typeof fetch), { status: 'error', reason: 'rate-limit' });
});

test('analysis client keeps the app usable when the secure server has no key', async () => {
  const fetcher = async () => new Response(JSON.stringify({ code: 'analysis_not_configured' }), { status: 503 });
  assert.deepEqual(await requestQuestionPhotoAnalysis('https://analysis.example.test', { base64: 'abc', mimeType: 'image/jpeg' }, 'pt-BR', fetcher as typeof fetch), { status: 'unavailable' });
});
