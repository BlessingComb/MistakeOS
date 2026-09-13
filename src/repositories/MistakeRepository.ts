import type { SupabaseClient } from '@supabase/supabase-js';
import { trackEvent } from '../analytics';
import type { MistakeRecord } from '../mistakes/core';
import { MistakeStore } from '../mistakes/storage';

export class MistakeRepository {
  constructor(private readonly local: MistakeStore, private readonly cloud: SupabaseClient | null) {}
  async load(): Promise<MistakeRecord[]> {
    const cached = await this.local.load();
    const userId = await this.userId(); if (!userId || !this.cloud) return cached;
    // Locally-created records are the durable retry queue. Re-attempt their
    // idempotent upserts whenever the app becomes active or reloads data.
    await this.syncCached(cached, userId);
    const { data, error } = await this.cloud.from('mistakes').select('*').order('created_at', { ascending: false });
    if (error || !data) { trackEvent('sync_failed', { entity: 'mistake', operation: 'read' }); return cached; }
    const merged = merge(cached, data.map(fromRow)); await this.local.replaceAll(merged); return merged;
  }
  private async syncCached(records: readonly MistakeRecord[], userId: string) {
    if (!this.cloud || records.length === 0) return;
    const results = await Promise.all(records.map((record) => this.cloud!.from('mistakes').upsert(toRow(record, userId), { onConflict: record.photoAnalysis?.aiRequestId ? 'user_id,ai_request_id' : 'user_id,client_id' })));
    if (results.some(({ error }) => error)) trackEvent('sync_failed', { entity: 'mistake', operation: 'write' });
  }
  async add(record: MistakeRecord): Promise<MistakeRecord[]> {
    const next = await this.local.add(record); const userId = await this.userId(); if (!userId || !this.cloud) return next;
    const row = toRow(record, userId); const { error } = await this.cloud.from('mistakes').upsert(row, { onConflict: record.photoAnalysis?.aiRequestId ? 'user_id,ai_request_id' : 'user_id,client_id' });
    trackEvent(error ? 'sync_failed' : 'mistake_synced', error ? { entity: 'mistake', operation: 'write' } : { source: record.photoAnalysis ? 'ai_photo' : 'manual' });
    return next;
  }
  private async userId() { if (!this.cloud) return null; return (await this.cloud.auth.getSession()).data.session?.user.id ?? null; }
}
function toRow(m:MistakeRecord,user_id:string){return{user_id,client_id:m.id,subject:m.subject,custom_subject:m.customSubject??null,topic:m.topic??null,note:m.note,error_type:m.photoAnalysis?.errorType??null,mistake_summary:m.photoAnalysis?.errorSummary??null,explanation:m.photoAnalysis?.explanation??null,repair_rule:m.photoAnalysis?.repairRule??null,confidence:m.photoAnalysis?confidence(m.photoAnalysis.confidence):null,source:m.photoAnalysis?'ai_photo':'manual',ai_request_id:m.photoAnalysis?.aiRequestId??null,created_at:m.createdAt,updated_at:new Date().toISOString()};}
function fromRow(row:Record<string,unknown>):MistakeRecord{
  const errorType=typeof row.error_type==='string'?row.error_type:undefined; const summary=String(row.mistake_summary??row.note??''); const repairRule=String(row.repair_rule??'');
  return{id:String(row.client_id??`cloud-${row.id}`),subject:String(row.subject) as MistakeRecord['subject'],...(row.custom_subject?{customSubject:String(row.custom_subject)}:{}),...(row.topic?{topic:String(row.topic)}:{}),...(errorType?{cause:causeFor(errorType)}:{}),note:String(row.note??summary),...(row.source==='ai_photo'?{photoAnalysis:{status:'identified',transcription:'',errorSummary:summary,explanation:String(row.explanation??''),correctionSteps:repairRule?[repairRule]:[],suggestedSubject:String(row.subject) as MistakeRecord['subject'],...(row.topic?{topic:String(row.topic)}:{}),suggestedCause:causeFor(errorType??'OTHER'),errorType:errorType as NonNullable<MistakeRecord['photoAnalysis']>['errorType'],...(repairRule?{repairRule}:{}),confidence:confidenceLabel(Number(row.confidence)),model:'cloud-sync',analyzedAt:String(row.created_at),...(row.ai_request_id?{aiRequestId:String(row.ai_request_id)}:{})}}:{}),createdAt:String(row.created_at)};
}
function merge(local:MistakeRecord[],cloud:MistakeRecord[]){const seen=new Set(local.map(item=>item.id));return[...local,...cloud.filter(item=>!seen.has(item.id))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
function confidence(value:string){return value==='high'?.9:value==='medium'?.65:.35;}
function confidenceLabel(value:number):'low'|'medium'|'high'{return value>=.8?'high':value>=.5?'medium':'low';}
function causeFor(errorType:string):NonNullable<MistakeRecord['cause']>{if(['CONTENT_GAP','FORGOT_FORMULA'].includes(errorType))return'conceptRecall';if(['CALCULATION','SIGN_ERROR','UNIT_ERROR'].includes(errorType))return'calculation';if(errorType==='INTERPRETATION')return'questionInterpretation';if(['CARELESSNESS','TIME_PRESSURE'].includes(errorType))return'rushing';if(['WRONG_FORMULA','STOPPED_EARLY'].includes(errorType))return'startingStrategy';return'uncertain';}
