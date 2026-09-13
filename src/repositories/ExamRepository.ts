import type { SupabaseClient } from '@supabase/supabase-js';
import { trackEvent } from '../analytics';
import type { ExamRecord } from '../exams/core';
import { ExamStore } from '../exams/storage';
export class ExamRepository{
  constructor(private readonly local:ExamStore,private readonly cloud:SupabaseClient|null){}
  async load(){const cached=await this.local.load();const userId=await this.userId();if(!userId||!this.cloud)return cached;await this.syncCached(cached,userId);const{data,error}=await this.cloud.from('exams').select('*').order('exam_date');if(error||!data){trackEvent('sync_failed',{entity:'exam',operation:'read'});return cached;}const merged=merge(cached,data.map(fromRow));await this.local.replaceAll(merged);return merged;}
  async add(exam:ExamRecord){const next=await this.local.add(exam);const userId=await this.userId();if(!userId||!this.cloud)return next;const{error}=await this.cloud.from('exams').upsert({user_id:userId,client_id:exam.id,exam_date:exam.date,subject:exam.subject,notes:exam.notes,updated_at:new Date().toISOString()},{onConflict:'user_id,client_id'});if(error)trackEvent('sync_failed',{entity:'exam',operation:'write'});return next;}
  async remove(id:string){const next=await this.local.remove(id);const userId=await this.userId();if(userId&&this.cloud){const{error}=await this.cloud.from('exams').delete().eq('client_id',id);if(error)trackEvent('sync_failed',{entity:'exam',operation:'delete'});}return next;}
  private async syncCached(exams:readonly ExamRecord[],userId:string){if(!this.cloud||exams.length===0)return;const results=await Promise.all(exams.map(exam=>this.cloud!.from('exams').upsert({user_id:userId,client_id:exam.id,exam_date:exam.date,subject:exam.subject,notes:exam.notes,updated_at:new Date().toISOString()},{onConflict:'user_id,client_id'})));if(results.some(({error})=>error))trackEvent('sync_failed',{entity:'exam',operation:'write'});}
  private async userId(){if(!this.cloud)return null;return(await this.cloud.auth.getSession()).data.session?.user.id??null;}
}
function fromRow(row:Record<string,unknown>):ExamRecord{return{id:String(row.client_id??`cloud-${row.id}`),date:String(row.exam_date),subject:String(row.subject) as ExamRecord['subject'],notes:String(row.notes??''),createdAt:String(row.created_at)};}
function merge(local:ExamRecord[],cloud:ExamRecord[]){const seen=new Set(local.map(item=>item.id));return[...local,...cloud.filter(item=>!seen.has(item.id))].sort((a,b)=>a.date.localeCompare(b.date));}
