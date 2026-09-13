export type PracticeQuestion = {
  id: string;
  statement: string;
  alternatives: readonly string[];
  sourceType: 'historical' | 'generated';
  sourceLabel: string;
};

export type PracticeResult = { questionId: string; correct: boolean; explanation: string };
export type PracticeSubmission = { verified: boolean; correctCount: number; duplicate: boolean; results: readonly PracticeResult[] };

export function createPracticeAttemptId(now = Date.now(), random = Math.random): string {
  return `practice-${now.toString(36)}-${Math.floor(random() * 0x100000000).toString(36)}`;
}

export function normalizeAlternatives(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 5) return null;
  const alternatives = value.map((item) => typeof item === 'string' ? item.trim() : '');
  return alternatives.every(Boolean) ? alternatives : null;
}

export function isPracticeAnswer(value: string): value is 'A' | 'B' | 'C' | 'D' | 'E' {
  return /^[A-E]$/.test(value);
}
