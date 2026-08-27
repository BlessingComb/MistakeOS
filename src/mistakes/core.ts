import type { CauseId, SubjectId } from '../onboarding';
import type { QuestionPhotoAnalysis } from '../analysis';

export type MistakeDraft = {
  subject: SubjectId;
  customSubject?: string;
  topic?: string;
  note: string;
  cause?: CauseId;
  photoUri?: string;
  photoAnalysis?: QuestionPhotoAnalysis;
};

export type MistakeRecord = MistakeDraft & {
  id: string;
  createdAt: string;
};

export function createMistake(draft: MistakeDraft, now = new Date(), idSuffix = Math.random().toString(36).slice(2, 8)): MistakeRecord {
  return {
    ...draft,
    ...(draft.customSubject?.trim() ? { customSubject: draft.customSubject.trim() } : {}),
    ...(draft.topic?.trim() ? { topic: draft.topic.trim().slice(0, 80) } : {}),
    note: draft.note.trim(),
    id: `mistake-${now.getTime()}-${idSuffix}`,
    createdAt: now.toISOString(),
  };
}

export function hasMistakeEvidence(draft: Pick<MistakeDraft, 'note' | 'photoUri'>): boolean {
  return Boolean(draft.note.trim() || draft.photoUri);
}

export function mostFrequentCause(mistakes: readonly MistakeRecord[]): CauseId | null {
  const counts = new Map<CauseId, number>();
  mistakes.forEach((mistake) => {
    if (mistake.cause) counts.set(mistake.cause, (counts.get(mistake.cause) ?? 0) + 1);
  });
  let result: CauseId | null = null;
  let highest = 0;
  counts.forEach((count, cause) => {
    if (count > highest) {
      highest = count;
      result = cause;
    }
  });
  return result;
}

export type SubjectReviewGroup = {
  subject: SubjectId;
  customSubject?: string;
  mistakes: MistakeRecord[];
};

export function groupMistakesBySubject(mistakes: readonly MistakeRecord[]): SubjectReviewGroup[] {
  const groups = new Map<SubjectId, MistakeRecord[]>();
  mistakes.forEach((mistake) => {
    const current = groups.get(mistake.subject) ?? [];
    current.push(mistake);
    groups.set(mistake.subject, current);
  });
  return [...groups.entries()].map(([subject, subjectMistakes]) => {
    const customSubject = subjectMistakes.find((mistake) => mistake.customSubject)?.customSubject;
    return customSubject ? { subject, customSubject, mistakes: subjectMistakes } : { subject, mistakes: subjectMistakes };
  });
}

export function mistakesForSubject(mistakes: readonly MistakeRecord[], subject: SubjectId): MistakeRecord[] {
  return mistakes.filter((mistake) => mistake.subject === subject);
}
