import type { AppLanguage } from '../i18n';
import { parseQuestionPhotoAnalysis, type QuestionPhotoAnalysis } from './core';

export type AnalysisClientResult =
  | { status: 'success'; analysis: QuestionPhotoAnalysis; usage?: AnalysisUsage }
  | { status: 'unavailable' }
  | { status: 'error'; reason: 'network' | 'rate-limit' | 'limit-reached' | 'invalid-image' | 'unauthorized' | 'server'; usage?: AnalysisUsage };

export type AnalysisUsage = { usedThisMonth: number; monthlyLimit: number; remaining: number };

export async function requestQuestionPhotoAnalysis(
  url: string,
  photo: { base64: string; mimeType: string },
  language: AppLanguage,
  fetcher: typeof fetch = fetch,
): Promise<AnalysisClientResult> {
  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64: photo.base64, mimeType: photo.mimeType, language }),
    });
    if (response.status === 429) return { status: 'error', reason: 'rate-limit' };
    if (response.status === 400 || response.status === 413 || response.status === 415) return { status: 'error', reason: 'invalid-image' };
    if (response.status === 503) {
      const unavailable = await response.clone().json().catch(() => null) as { code?: unknown } | null;
      if (unavailable?.code === 'analysis_not_configured') return { status: 'unavailable' };
    }
    if (!response.ok) return { status: 'error', reason: 'server' };
    const payload = await response.json() as { analysis?: unknown; model?: unknown };
    const analysis = parseQuestionPhotoAnalysis(payload.analysis, typeof payload.model === 'string' ? payload.model : 'groq');
    return analysis ? { status: 'success', analysis } : { status: 'error', reason: 'server' };
  } catch {
    return { status: 'error', reason: 'network' };
  }
}

export function parseAnalysisResponse(payload: unknown): { analysis: QuestionPhotoAnalysis; usage?: AnalysisUsage } | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as { analysis?: unknown; model?: unknown; usage?: unknown };
  const analysis = parseQuestionPhotoAnalysis(value.analysis, typeof value.model === 'string' ? value.model : 'groq');
  if (!analysis) return null;
  const usageValue = value.usage as Partial<AnalysisUsage> | undefined;
  const usage = usageValue && [usageValue.usedThisMonth, usageValue.monthlyLimit, usageValue.remaining].every((item) => typeof item === 'number')
    ? usageValue as AnalysisUsage : undefined;
  return { analysis, ...(usage ? { usage } : {}) };
}
