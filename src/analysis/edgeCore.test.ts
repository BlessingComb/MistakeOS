import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { estimatedCost, MAX_IMAGE_BYTES, normalizeProviderAnalysis, validateAnalysisRequest } from '../../supabase/functions/_shared/analysis-core';

const request={requestId:'550e8400-e29b-41d4-a716-446655440000',image:{base64:'YWJj',mimeType:'image/jpeg'},locale:'pt-BR'};
describe('secure photo analysis boundary',()=>{
  it('accepts the supported locale and image contract',()=>assert.equal(validateAnalysisRequest(request).ok,true));
  it('rejects malformed and oversized images',()=>{assert.deepEqual(validateAnalysisRequest({...request,image:{base64:'not base64!',mimeType:'image/jpeg'}}),{ok:false,code:'INVALID_IMAGE'});assert.deepEqual(validateAnalysisRequest({...request,image:{base64:'A'.repeat(Math.ceil(MAX_IMAGE_BYTES/0.75)+8),mimeType:'image/jpeg'}}),{ok:false,code:'IMAGE_TOO_LARGE'});});
  it('rejects arbitrary provider enums and accepts normalized output',()=>{assert.equal(normalizeProviderAnalysis({...fixture(),errorType:'MADE_UP'},'test'),null);assert.equal(normalizeProviderAnalysis(fixture(),'test')?.errorType,'SIGN_ERROR');});
  it('keeps pricing calculation centralized and optional',()=>{assert.equal(estimatedCost(1_000_000,500_000,'0.1','0.2'),.2);assert.equal(estimatedCost(null,10,'0.1','0.2'),null);});
  it('keeps auth, idempotency and allowance enforcement server-side',()=>{const edge=readFileSync('supabase/functions/analyze-mistake/index.ts','utf8');const migration=readFileSync('supabase/migrations/20260826230759_core_persistence_ai_usage.sql','utf8');assert.match(edge,/auth:'user'/);assert.match(edge,/is_anonymous/);assert.match(migration,/pg_advisory_xact_lock/);assert.match(migration,/unique \(user_id, feature, request_id\)/);assert.match(migration,/revoke all on function public\.reserve_ai_analysis/);assert.doesNotMatch(edge,/isPro|is_pro/);});
});
function fixture(){return{status:'identified',transcription:'x',errorSummary:'Sign changed',explanation:'Check the isolation step',correctionSteps:['Keep the sign'],suggestedSubject:'mathematics',topic:'Linear equations',suggestedCause:'calculation',errorType:'SIGN_ERROR',repairRule:'Check the sign before dividing',confidence:'high'};}
