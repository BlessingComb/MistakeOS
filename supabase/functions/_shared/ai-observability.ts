export const AI_ROUTES = [
  'ocr_mathpix',
  'question_solver',
  'mistake_interpretation',
  'mistake_explanation',
  'practice_question_generation',
  'never_again_generation',
  'risk_score_analysis',
] as const;

export type AiRoute = (typeof AI_ROUTES)[number];

export const MISTAKE_INTERPRETATION_ROUTE: AiRoute = 'mistake_interpretation';

// Only opaque, allowlisted machine codes are stored. Never forward provider
// error bodies, prompts, photos, or student content to observability.
export function sanitizeAiErrorCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value) ? value : null;
}
