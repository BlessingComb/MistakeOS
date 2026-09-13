import type { AppLanguage } from '../i18n';
import { mistakeAnalysisUrl } from './config';
import { questionPhotoPayload } from './photoPayload';
import { requestQuestionPhotoAnalysis, parseAnalysisResponse, type AnalysisClientResult } from './service';
import { supabase } from '../supabase';
import { questionPhotoAnalysisBody, type QuestionPhotoAnalysisRequest } from './request';

export async function analyzeQuestionPhoto(
  photoUri: string,
  language: AppLanguage,
  request: QuestionPhotoAnalysisRequest,
  fetcher: typeof fetch = fetch,
): Promise<AnalysisClientResult> {
  try {
    const photo = await questionPhotoPayload(photoUri);
    if (supabase) return requestEdgeAnalysis(photo, language, request);
    if (!mistakeAnalysisUrl) return { status: 'unavailable' };
    return requestQuestionPhotoAnalysis(mistakeAnalysisUrl, photo, language, request.requestId, fetcher);
  } catch {
    return { status: 'error', reason: 'network' };
  }
}

async function requestEdgeAnalysis(photo: { base64: string; mimeType: string }, language: AppLanguage, request: QuestionPhotoAnalysisRequest): Promise<AnalysisClientResult> {
  if (!supabase) return { status: 'unavailable' };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { status: 'error', reason: 'unauthorized' };
  const { data, error } = await supabase.functions.invoke('analyze-mistake', { body: questionPhotoAnalysisBody(request, photo, language) });
  if (error) {
    const payload = await responsePayload(error);
    const code = typeof payload?.code === 'string' ? payload.code : '';
    if (code === 'AI_LIMIT_REACHED' && payload) return { status: 'error', reason: 'limit-reached', usage: numericUsage(payload) };
    if (code === 'RATE_LIMITED' || code === 'DUPLICATE_IN_PROGRESS') return { status: 'error', reason: 'rate-limit' };
    if (code === 'INVALID_IMAGE' || code === 'IMAGE_TOO_LARGE') return { status: 'error', reason: 'invalid-image' };
    if (code === 'UNAUTHORIZED') return { status: 'error', reason: 'unauthorized' };
    if (code === 'NOT_CONFIGURED') return { status: 'unavailable' };
    return { status: 'error', reason: 'server' };
  }
  const parsed = parseAnalysisResponse(data);
  return parsed ? { status: 'success', ...parsed } : { status: 'error', reason: 'server' };
}

async function responsePayload(error: unknown): Promise<Record<string, unknown> | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  return context.clone().json().catch(() => null) as Promise<Record<string, unknown> | null>;
}
function numericUsage(value: Record<string, unknown>) { const usedToday=Number(value.used),dailyLimit=Number(value.limit),remaining=Number(value.remaining??0); return [usedToday,dailyLimit,remaining].every(Number.isFinite)?{usedToday,dailyLimit,remaining}:undefined; }
