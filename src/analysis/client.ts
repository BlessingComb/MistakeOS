import type { AppLanguage } from '../i18n';
import { mistakeAnalysisUrl } from './config';
import { questionPhotoPayload } from './photoPayload';
import { requestQuestionPhotoAnalysis, parseAnalysisResponse, type AnalysisClientResult } from './service';
import { supabase } from '../supabase';

export async function analyzeQuestionPhoto(photoUri: string, language: AppLanguage, fetcher: typeof fetch = fetch): Promise<AnalysisClientResult> {
  try {
    const photo = await questionPhotoPayload(photoUri);
    if (supabase) return requestEdgeAnalysis(photo, language);
    if (!mistakeAnalysisUrl) return { status: 'unavailable' };
    return requestQuestionPhotoAnalysis(mistakeAnalysisUrl, photo, language, fetcher);
  } catch {
    return { status: 'error', reason: 'network' };
  }
}

async function requestEdgeAnalysis(photo: { base64: string; mimeType: string }, language: AppLanguage): Promise<AnalysisClientResult> {
  if (!supabase) return { status: 'unavailable' };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { status: 'error', reason: 'unauthorized' };
  const { data, error } = await supabase.functions.invoke('analyze-mistake', { body: { requestId: requestId(), image: photo, locale: language } });
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
function numericUsage(value: Record<string, unknown>) { const usedThisMonth=Number(value.used),monthlyLimit=Number(value.limit),remaining=Number(value.remaining??0); return [usedThisMonth,monthlyLimit,remaining].every(Number.isFinite)?{usedThisMonth,monthlyLimit,remaining}:undefined; }
function requestId() { const bytes=new Uint8Array(16); globalThis.crypto?.getRandomValues?.(bytes); bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128; const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join(''); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`; }
