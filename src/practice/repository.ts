import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAlternatives, type PracticeQuestion, type PracticeResult, type PracticeSubmission } from './core';

export type PracticeLoadResult =
  | { kind: 'ready'; questions: readonly PracticeQuestion[] }
  | { kind: 'empty' }
  | { kind: 'unavailable' }
  | { kind: 'error' };

export class PracticeQuestionRepository {
  constructor(private readonly cloud: SupabaseClient | null) {}

  async load(skillCode: string): Promise<PracticeLoadResult> {
    if (!this.cloud) return { kind: 'unavailable' };
    const { data, error } = await this.cloud.rpc('get_practice_questions_for_skill', { p_skill_code: skillCode, p_limit: 3 });
    if (error) return { kind: isPracticeBackendUnavailable(error) ? 'unavailable' : 'error' };
    const questions = (Array.isArray(data) ? data : []).flatMap(parseQuestion);
    return questions.length === 3 ? { kind: 'ready', questions } : { kind: 'empty' };
  }

  async submit(input: { mistakeId: string; skillCode: string; clientId: string; questionIds: readonly string[]; selectedAnswers: readonly string[] }): Promise<PracticeSubmission | null> {
    if (!this.cloud) return null;
    const { data, error } = await this.cloud.rpc('submit_practice_recovery', {
      p_mistake_id: input.mistakeId,
      p_skill_code: input.skillCode,
      p_client_id: input.clientId,
      p_question_ids: [...input.questionIds],
      p_selected_answers: [...input.selectedAnswers],
    });
    if (error || !data || typeof data !== 'object') return null;
    const value = data as Record<string, unknown>;
    const results = Array.isArray(value.results) ? value.results.flatMap(parseResult) : [];
    const correctCount = typeof value.correctCount === 'number' ? value.correctCount : Number(value.correctCount);
    return value.verified === true && Number.isInteger(correctCount) && results.length === input.questionIds.length
      ? { verified: true, correctCount, duplicate: value.duplicate === true, results }
      : null;
  }
}

function parseQuestion(value: unknown): PracticeQuestion[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  const alternatives = normalizeAlternatives(row.alternatives);
  if (typeof row.question_id !== 'string' || typeof row.statement !== 'string' || !alternatives || (row.source_type !== 'historical' && row.source_type !== 'generated')) return [];
  return [{ id: row.question_id, statement: row.statement, alternatives, sourceType: row.source_type, sourceLabel: typeof row.source_label === 'string' ? row.source_label : 'Practice question' }];
}

function parseResult(value: unknown): PracticeResult[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  return typeof row.questionId === 'string' && typeof row.correct === 'boolean' && typeof row.explanation === 'string'
    ? [{ questionId: row.questionId, correct: row.correct, explanation: row.explanation }]
    : [];
}

function isPracticeBackendUnavailable(error: { code?: string; message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return error.code === 'PGRST202' || error.code === '42P01' || message.includes('get_practice_questions_for_skill') || message.includes('practice_questions');
}
