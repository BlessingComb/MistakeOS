export const FEATURE = 'mistake_photo_analysis';
export const PROVIDER = 'groq';
export const DEFAULT_MODEL = 'qwen/qwen3.6-27b';
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AnalysisErrorCode = 'UNAUTHORIZED'|'INVALID_IMAGE'|'IMAGE_TOO_LARGE'|'AI_LIMIT_REACHED'|'RATE_LIMITED'|'DUPLICATE_IN_PROGRESS'|'AI_PROVIDER_TIMEOUT'|'AI_PROVIDER_ERROR'|'INVALID_AI_RESPONSE'|'PERSISTENCE_RETRYABLE'|'INTERNAL_ERROR'|'NOT_CONFIGURED';
export type ValidatedRequest = { requestId:string; image:{base64:string;mimeType:string}; locale:'en'|'pt-BR'; context?:{examId?:string;subjectHint?:string;topicHint?:string} };
export type NormalizedAnalysis={status:'identified'|'insufficient';transcription:string;errorSummary:string;explanation:string;correctionSteps:string[];suggestedSubject:string;topic:string;suggestedCause:string;errorType:string;repairRule:string;confidence:'low'|'medium'|'high';model:string;analyzedAt:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i; const BASE64=/^[A-Za-z0-9+/]+={0,2}$/;
export function validateAnalysisRequest(value:unknown):{ok:true;value:ValidatedRequest}|{ok:false;code:'INVALID_IMAGE'|'IMAGE_TOO_LARGE'}{
  if(!isRecord(value)||!UUID.test(String(value.requestId??''))||!isRecord(value.image)) return {ok:false,code:'INVALID_IMAGE'};
  const base64=typeof value.image.base64==='string'?value.image.base64.replace(/\s/g,''):''; const mimeType=typeof value.image.mimeType==='string'?value.image.mimeType.toLowerCase():'';
  if(!base64||!BASE64.test(base64)||!ALLOWED_MIME_TYPES.includes(mimeType as never)) return {ok:false,code:'INVALID_IMAGE'};
  if(Math.floor(base64.length*.75)>MAX_IMAGE_BYTES) return {ok:false,code:'IMAGE_TOO_LARGE'};
  if(value.locale!=='en'&&value.locale!=='pt-BR') return {ok:false,code:'INVALID_IMAGE'};
  const context=isRecord(value.context)?cleanContext(value.context):undefined;
  return {ok:true,value:{requestId:String(value.requestId),image:{base64,mimeType},locale:value.locale,...(context?{context}:{})}};
}
const SUBJECTS=['mathematics','physics','chemistry','biology','languages','other']; const CAUSES=['rushing','conceptRecall','questionInterpretation','calculation','startingStrategy','recurrence','uncertain']; const ERROR_TYPES=['CONTENT_GAP','FORGOT_FORMULA','WRONG_FORMULA','CALCULATION','SIGN_ERROR','INTERPRETATION','CARELESSNESS','TIME_PRESSURE','STOPPED_EARLY','UNIT_ERROR','OTHER']; const CONFIDENCE=['low','medium','high'];
export function normalizeProviderAnalysis(value:unknown,model:string,now=new Date().toISOString()):NormalizedAnalysis|null{
  if(!isRecord(value)||!['identified','insufficient'].includes(String(value.status))) return null;
  if(!strings(value,['transcription','errorSummary','explanation','repairRule'])||!Array.isArray(value.correctionSteps)||!value.correctionSteps.every(v=>typeof v==='string')) return null;
  if(!SUBJECTS.includes(String(value.suggestedSubject))||!CAUSES.includes(String(value.suggestedCause))||!ERROR_TYPES.includes(String(value.errorType))||!CONFIDENCE.includes(String(value.confidence))) return null;
  return {status:value.status as NormalizedAnalysis['status'],transcription:trim(value.transcription,4000),errorSummary:trim(value.errorSummary,500),explanation:trim(value.explanation,3000),correctionSteps:(value.correctionSteps as string[]).map(v=>trim(v,500)).filter(Boolean).slice(0,5),suggestedSubject:String(value.suggestedSubject),topic:trim(value.topic,120),suggestedCause:String(value.suggestedCause),errorType:String(value.errorType),repairRule:trim(value.repairRule,500),confidence:value.confidence as NormalizedAnalysis['confidence'],model,analyzedAt:now};
}
export function confidenceNumber(confidence:string){return confidence==='high'?.9:confidence==='medium'?.65:.35;}
export function estimatedCost(inputTokens:number|null,outputTokens:number|null,inputPerMillion?:string,outputPerMillion?:string){const i=Number(inputPerMillion),o=Number(outputPerMillion);if(inputTokens===null||outputTokens===null||!Number.isFinite(i)||!Number.isFinite(o)||i<0||o<0)return null;return(inputTokens*i+outputTokens*o)/1_000_000;}
function cleanContext(value:Record<string,unknown>){const result:Record<string,string>={};for(const key of ['examId','subjectHint','topicHint'])if(typeof value[key]==='string'&&value[key].trim())result[key]=value[key].trim().slice(0,120);return Object.keys(result).length?result:undefined;}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);} function strings(value:Record<string,unknown>,keys:string[]){return keys.every(key=>typeof value[key]==='string');} function trim(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
