import type { MistakeRecord } from '../mistakes';

export type RecoveryQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string];
  correctOption: number;
  targetErrorType: string;
  trapReason?: string;
};

export type RecoverySet = {
  id: string;
  sourceMistakeId: string;
  repairRule: string;
  generator: 'local';
  questions: [RecoveryQuestion, RecoveryQuestion, RecoveryQuestion];
};

export function recoveryRule(mistake: MistakeRecord): string {
  if (mistake.photoAnalysis?.status === 'identified') {
    return mistake.photoAnalysis.correctionSteps[0] ?? mistake.photoAnalysis.errorSummary;
  }
  return mistake.note;
}

export function generateRecoverySet(mistake: MistakeRecord): RecoverySet {
  const rule = recoveryRule(mistake);
  const source = `${mistake.note} ${rule}`.toLowerCase();
  const target = mistake.cause ?? 'uncertain';
  const questions = /cosine|cosseno/.test(source)
    ? lawOfCosinesQuestions(target)
    : ruleQuestions(rule, target);
  return { id: `recovery-${mistake.id}`, sourceMistakeId: mistake.id, repairRule: rule, generator: 'local', questions };
}

function lawOfCosinesQuestions(target: string): [RecoveryQuestion, RecoveryQuestion, RecoveryQuestion] {
  return [
    question('same-skill', 'For sides 6 and 9 with included angle 45°, which setup is correct for the opposite side c?', ['c² = 6² + 9² − 2(6)(9) cos 45°', 'c² = 6² + 9² + 2(6)(9) cos 45°', 'c = 6 + 9 − 45'], 0, target),
    question('transfer', 'A triangle has two known sides and the angle between them. What should you verify before calculating the third side?', ['That the Law of Cosines uses the included angle', 'That both known sides are equal', 'That the angle is converted to radians'], 0, target),
    question('pattern-trap', 'Pattern check: which term must keep its negative sign in the Law of Cosines?', ['−2ab cos(C)', '+2ab cos(C)', 'a² + b²'], 0, target, 'The positive-sign version matches the previous sign-error trap.'),
  ];
}

function ruleQuestions(rule: string, target: string): [RecoveryQuestion, RecoveryQuestion, RecoveryQuestion] {
  const cleanRule = rule.length > 120 ? `${rule.slice(0, 117)}…` : rule;
  return [
    question('same-skill', 'Before solving a similar question, what is the most important check?', [cleanRule, 'Skip directly to the calculation', 'Use the first formula that looks familiar'], 0, target),
    question('transfer', 'In a differently worded version of this problem, when should you use your Repair Rule?', ['Before committing to the calculation', 'Only after the final answer looks wrong', 'After choosing an answer at random'], 0, target),
    question('pattern-trap', 'Pattern trap: the old shortcut looks tempting. What should you do instead?', [cleanRule, 'Repeat the previous shortcut faster', 'Ignore the condition in the question'], 0, target, 'This choice tests the exact check that protects against the recurring pattern.'),
  ];
}

function question(id: string, prompt: string, options: [string, string, string], correctOption: number, targetErrorType: string, trapReason?: string): RecoveryQuestion {
  return { id, prompt, options, correctOption, targetErrorType, trapReason };
}

export function isRecoveryAnswerCorrect(question: RecoveryQuestion, option: number | null) {
  return option === question.correctOption;
}
