import type { TranslationKey } from '../i18n';
import type { CauseId, GoalId, SubjectId } from './core';

export const SUBJECT_OPTIONS: { id: SubjectId; labelKey: TranslationKey }[] = [
  { id: 'mathematics', labelKey: 'onboarding.subject.mathematics' },
  { id: 'physics', labelKey: 'onboarding.subject.physics' },
  { id: 'chemistry', labelKey: 'onboarding.subject.chemistry' },
  { id: 'biology', labelKey: 'onboarding.subject.biology' },
  { id: 'languages', labelKey: 'onboarding.subject.languages' },
  { id: 'other', labelKey: 'onboarding.subject.other' },
];

export const CAUSE_OPTIONS: { id: CauseId; labelKey: TranslationKey; riskKey: TranslationKey }[] = [
  { id: 'rushing', labelKey: 'onboarding.cause.rushing', riskKey: 'onboarding.risk.rushing' },
  { id: 'conceptRecall', labelKey: 'onboarding.cause.conceptRecall', riskKey: 'onboarding.risk.conceptRecall' },
  { id: 'questionInterpretation', labelKey: 'onboarding.cause.questionInterpretation', riskKey: 'onboarding.risk.questionInterpretation' },
  { id: 'calculation', labelKey: 'onboarding.cause.calculation', riskKey: 'onboarding.risk.calculation' },
  { id: 'startingStrategy', labelKey: 'onboarding.cause.startingStrategy', riskKey: 'onboarding.risk.startingStrategy' },
  { id: 'recurrence', labelKey: 'onboarding.cause.recurrence', riskKey: 'onboarding.risk.recurrence' },
  { id: 'uncertain', labelKey: 'onboarding.cause.uncertain', riskKey: 'onboarding.risk.uncertain' },
];

export const GOAL_OPTIONS: { id: GoalId; labelKey: TranslationKey }[] = [
  { id: 'stopRepeating', labelKey: 'onboarding.goal.stopRepeating' },
  { id: 'improveGrades', labelKey: 'onboarding.goal.improveGrades' },
  { id: 'prepareExams', labelKey: 'onboarding.goal.prepareExams' },
  { id: 'understandThinking', labelKey: 'onboarding.goal.understandThinking' },
  { id: 'studyEfficiently', labelKey: 'onboarding.goal.studyEfficiently' },
];

export function riskLabelKey(cause: CauseId): TranslationKey {
  return CAUSE_OPTIONS.find((option) => option.id === cause)?.riskKey ?? 'onboarding.risk.uncertain';
}

export function subjectLabelKey(subject: SubjectId): TranslationKey {
  return SUBJECT_OPTIONS.find((option) => option.id === subject)?.labelKey ?? 'onboarding.subject.other';
}
