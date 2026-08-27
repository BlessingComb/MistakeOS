export type SubjectId = 'mathematics' | 'physics' | 'chemistry' | 'biology' | 'languages' | 'other';

export type CauseId =
  | 'rushing'
  | 'conceptRecall'
  | 'questionInterpretation'
  | 'calculation'
  | 'startingStrategy'
  | 'recurrence'
  | 'uncertain';

export type GoalId = 'stopRepeating' | 'improveGrades' | 'prepareExams' | 'understandThinking' | 'studyEfficiently';

export type OnboardingAnswers = {
  subjects: SubjectId[];
  causes: CauseId[];
  goal: GoalId | null;
};

export type InitialProfile = {
  primaryRisk: CauseId;
  secondaryRisk?: CauseId;
  evidence: CauseId[];
  source: 'self_reported';
};

export type OnboardingRecord = {
  version: 1;
  completed: true;
  skipped: boolean;
  completedAt: string;
  answers: OnboardingAnswers;
  profile: InitialProfile | null;
};

export const EMPTY_ANSWERS: OnboardingAnswers = { subjects: [], causes: [], goal: null };

export function deriveInitialProfile(answers: OnboardingAnswers): InitialProfile | null {
  const uniqueCauses = [...new Set(answers.causes)];
  if (uniqueCauses.length === 0) return null;
  return {
    primaryRisk: uniqueCauses[0],
    secondaryRisk: uniqueCauses[1],
    evidence: uniqueCauses,
    source: 'self_reported',
  };
}

export function isCompleteAnswers(answers: OnboardingAnswers): boolean {
  return answers.subjects.length > 0 && answers.causes.length > 0 && answers.goal !== null;
}
