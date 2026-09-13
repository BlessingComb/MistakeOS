import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnalysisResponse, requestQuestionPhotoAnalysis } from './service';
import { createQuestionPhotoAnalysisRequest, questionPhotoAnalysisBody } from './request';

const validAnalysis = {
  status: 'identified', transcription: 'visible work', errorSummary: 'Sign error', explanation: 'The sign changed.',
  correctionSteps: ['Keep the negative sign.'], suggestedSubject: 'mathematics', suggestedCause: 'calculation', confidence: 'medium',
};

test('analysis client accepts only validated structured output', async () => {
  const fetcher = async () => new Response(JSON.stringify({ analysis: validAnalysis, model: 'groq-test' }), { status: 200, headers: { 'content-type': 'application/json' } });
  const result = await requestQuestionPhotoAnalysis('https://analysis.example.test', { base64: 'abc', mimeType: 'image/jpeg' }, 'en', undefined, fetcher as typeof fetch);
  assert.equal(result.status, 'success');
  if (result.status === 'success') assert.equal(result.analysis.model, 'groq-test');
});

test('analysis client exposes free-tier rate limits without inventing a result', async () => {
  const fetcher = async () => new Response(JSON.stringify({ code: 'rate_limited' }), { status: 429 });
  assert.deepEqual(await requestQuestionPhotoAnalysis('https://analysis.example.test', { base64: 'abc', mimeType: 'image/jpeg' }, 'pt-BR', undefined, fetcher as typeof fetch), { status: 'error', reason: 'rate-limit' });
});

test('analysis client keeps the app usable when the secure server has no key', async () => {
  const fetcher = async () => new Response(JSON.stringify({ code: 'analysis_not_configured' }), { status: 503 });
  assert.deepEqual(await requestQuestionPhotoAnalysis('https://analysis.example.test', { base64: 'abc', mimeType: 'image/jpeg' }, 'pt-BR', undefined, fetcher as typeof fetch), { status: 'unavailable' });
});

test('one logical analysis keeps its request id across a timeout retry', () => {
  const request = createQuestionPhotoAnalysisRequest(() => '550e8400-e29b-41d4-a716-446655440000');
  const photo = { base64: 'abc', mimeType: 'image/jpeg' };
  const firstCall = questionPhotoAnalysisBody(request, photo, 'pt-BR');
  const retryAfterTimeout = questionPhotoAnalysisBody(request, photo, 'pt-BR');
  assert.equal(firstCall.requestId, '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(retryAfterTimeout.requestId, firstCall.requestId);
});

test('a newly initiated analysis gets a new request id', () => {
  const ids = ['550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000'];
  const first = createQuestionPhotoAnalysisRequest(() => ids.shift()!);
  const next = createQuestionPhotoAnalysisRequest(() => ids.shift()!);
  assert.notEqual(next.requestId, first.requestId);
});

test('analysis usage uses the daily server contract', () => {
  const parsed = parseAnalysisResponse({ analysis: validAnalysis, model: 'groq-test', usage: { usedToday: 2, dailyLimit: 5, remaining: 3 } });
  assert.deepEqual(parsed?.usage, { usedToday: 2, dailyLimit: 5, remaining: 3 });
});
