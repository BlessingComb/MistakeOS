import type { CauseId, SubjectId } from '../onboarding';

export type AnalysisConfidence = 'low' | 'medium' | 'high';
export type MistakeErrorType = 'CONTENT_GAP' | 'FORGOT_FORMULA' | 'WRONG_FORMULA' | 'CALCULATION' | 'SIGN_ERROR' | 'INTERPRETATION' | 'CARELESSNESS' | 'TIME_PRESSURE' | 'STOPPED_EARLY' | 'UNIT_ERROR' | 'OTHER';

export type QuestionPhotoAnalysis = {
  status: 'identified' | 'insufficient';
  transcription: string;
  errorSummary: string;
  explanation: string;
  correctionSteps: string[];
  suggestedSubject: SubjectId;
  topic?: string;
  suggestedCause?: CauseId;
  errorType?: MistakeErrorType;
  repairRule?: string;
  confidence: AnalysisConfidence;
  model: string;
  analyzedAt: string;
  aiRequestId?: string;
};

const SUBJECTS: SubjectId[] = ['mathematics', 'physics', 'chemistry', 'biology', 'languages', 'other'];
const CAUSES: CauseId[] = ['rushing', 'conceptRecall', 'questionInterpretation', 'calculation', 'startingStrategy', 'recurrence', 'uncertain'];
const CONFIDENCE: AnalysisConfidence[] = ['low', 'medium', 'high'];
const ERROR_TYPES: MistakeErrorType[] = ['CONTENT_GAP','FORGOT_FORMULA','WRONG_FORMULA','CALCULATION','SIGN_ERROR','INTERPRETATION','CARELESSNESS','TIME_PRESSURE','STOPPED_EARLY','UNIT_ERROR','OTHER'];

export function parseQuestionPhotoAnalysis(value: unknown, model: string, analyzedAt = new Date().toISOString()): QuestionPhotoAnalysis | null {
  if (!isRecord(value)) return null;
  if (value.status !== 'identified' && value.status !== 'insufficient') return null;
  if (!isString(value.transcription) || !isString(value.errorSummary) || !isString(value.explanation)) return null;
  if (!Array.isArray(value.correctionSteps) || !value.correctionSteps.every(isString)) return null;
  if (!SUBJECTS.includes(value.suggestedSubject as SubjectId)) return null;
  if (!CONFIDENCE.includes(value.confidence as AnalysisConfidence)) return null;
  if (value.topic !== undefined && !isString(value.topic)) return null;
  if (value.suggestedCause !== undefined && !CAUSES.includes(value.suggestedCause as CauseId)) return null;
  if (value.errorType !== undefined && !ERROR_TYPES.includes(value.errorType as MistakeErrorType)) return null;
  if (value.repairRule !== undefined && !isString(value.repairRule)) return null;
  if (value.aiRequestId !== undefined && !isString(value.aiRequestId)) return null;
  return {
    status: value.status,
    transcription: value.transcription.trim(),
    errorSummary: value.errorSummary.trim(),
    explanation: value.explanation.trim(),
    correctionSteps: value.correctionSteps.map((step) => step.trim()).filter(Boolean).slice(0, 5),
    suggestedSubject: value.suggestedSubject as SubjectId,
    ...(isString(value.topic) && value.topic.trim() ? { topic: value.topic.trim().slice(0, 80) } : {}),
    suggestedCause: value.suggestedCause as CauseId | undefined,
    errorType: value.errorType as MistakeErrorType | undefined,
    ...(isString(value.repairRule) && value.repairRule.trim() ? { repairRule: value.repairRule.trim().slice(0, 500) } : {}),
    confidence: value.confidence as AnalysisConfidence,
    model,
    analyzedAt,
    ...(isString(value.aiRequestId) ? { aiRequestId: value.aiRequestId } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
