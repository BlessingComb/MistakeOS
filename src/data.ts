import type { TranslationKey } from './i18n';

export type DnaPattern = {
  id: string;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  strength: number;
  instances: number;
  tone: 'risk' | 'recovering' | 'mastered';
};

export const dnaPatterns: DnaPattern[] = [
  {
    id: 'sign-switch',
    labelKey: 'pattern.signSwitch',
    detailKey: 'pattern.signSwitchDetail',
    strength: 86,
    instances: 7,
    tone: 'risk',
  },
  {
    id: 'rush-reading',
    labelKey: 'pattern.rushReading',
    detailKey: 'pattern.rushReadingDetail',
    strength: 63,
    instances: 5,
    tone: 'recovering',
  },
  {
    id: 'formula-recall',
    labelKey: 'pattern.formulaRecall',
    detailKey: 'pattern.formulaRecallDetail',
    strength: 41,
    instances: 3,
    tone: 'recovering',
  },
  {
    id: 'unit-check',
    labelKey: 'pattern.unitCheck',
    detailKey: 'pattern.unitCheckDetail',
    strength: 14,
    instances: 1,
    tone: 'mastered',
  },
];

export type ReviewQuestion = {
  id: string;
  promptKey: TranslationKey;
  contextKey: TranslationKey;
  optionKeys: [TranslationKey, TranslationKey, TranslationKey];
  correct: number;
  correctionKey: TranslationKey;
};

export const reviewQuestions: ReviewQuestion[] = [
  {
    id: 'q1',
    contextKey: 'question.q1.context',
    promptKey: 'question.q1.prompt',
    optionKeys: ['question.q1.a', 'question.q1.b', 'question.q1.c'],
    correct: 0,
    correctionKey: 'question.q1.correction',
  },
  {
    id: 'q2',
    contextKey: 'question.q2.context',
    promptKey: 'question.q2.prompt',
    optionKeys: ['question.q2.a', 'question.q2.b', 'question.q2.c'],
    correct: 1,
    correctionKey: 'question.q2.correction',
  },
  {
    id: 'q3',
    contextKey: 'question.q3.context',
    promptKey: 'question.q3.prompt',
    optionKeys: ['question.q3.a', 'question.q3.b', 'question.q3.c'],
    correct: 0,
    correctionKey: 'question.q3.correction',
  },
];
