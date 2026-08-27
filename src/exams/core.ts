import type { SubjectId } from '../onboarding';

export type ExamDraft = {
  date: string;
  subject: SubjectId;
  notes: string;
};

export type ExamRecord = ExamDraft & {
  id: string;
  createdAt: string;
};

export function createExam(draft: ExamDraft, now = new Date(), idSuffix = Math.random().toString(36).slice(2, 8)): ExamRecord {
  return {
    ...draft,
    notes: draft.notes.trim(),
    id: `exam-${now.getTime()}-${idSuffix}`,
    createdAt: now.toISOString(),
  };
}

export function sortExams(exams: readonly ExamRecord[]): ExamRecord[] {
  return [...exams].sort((a, b) => a.date.localeCompare(b.date));
}
