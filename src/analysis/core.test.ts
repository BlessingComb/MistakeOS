import assert from 'node:assert/strict';
import test from 'node:test';
import { parseQuestionPhotoAnalysis } from './core';

test('accepts structured evidence analysis and stamps model metadata', () => {
  const analysis = parseQuestionPhotoAnalysis({
    status: 'identified',
    transcription: '2x + 3 = 7; x = 5',
    errorSummary: 'Subtraction was applied incorrectly.',
    explanation: 'Subtracting 3 gives 2x = 4.',
    correctionSteps: ['Subtract 3.', 'Divide by 2.'],
    suggestedSubject: 'mathematics',
    suggestedCause: 'calculation',
    confidence: 'high',
  }, 'groq-test', '2026-08-23T12:00:00.000Z');
  assert.equal(analysis?.model, 'groq-test');
  assert.equal(analysis?.errorSummary, 'Subtraction was applied incorrectly.');
  assert.equal(analysis?.suggestedCause, 'calculation');
});

test('rejects invented or malformed analysis shapes', () => {
  assert.equal(parseQuestionPhotoAnalysis({ status: 'identified', confidence: 'absolute' }, 'groq-test'), null);
  assert.equal(parseQuestionPhotoAnalysis({
    status: 'identified', transcription: '', errorSummary: '', explanation: '', correctionSteps: [], suggestedSubject: 'history', confidence: 'low',
  }, 'groq-test'), null);
});
