import type { ExamRecord } from '../exams';
import { linkAffectsOfficialMetrics, type AssessedSkill, type OfficialExamPrepData } from '../examPrep';
import type { MistakeRecord } from '../mistakes';
import type { SubjectId } from '../onboarding';
import type { ReviewEvidence } from '../prepMap';
import { PracticeQuestionRepository } from '../practice';
import { supabase } from '../supabase';
import { useState } from 'react';
import { OfficialExamPrepExperience } from './OfficialExamPrepExperience';
import { PracticeQuestionsScreen } from './PracticeQuestionsScreen';

type Props = {
  // Preserved while the legacy personal map is progressively represented by
  // official catalog skills. These inputs are never used to invent progress.
  exams: readonly ExamRecord[];
  mistakes: readonly MistakeRecord[];
  reviewEvidence: ReviewEvidence;
  officialExamPrep: OfficialExamPrepData;
  onSelectExamTarget: (catalogVersionId: string) => Promise<boolean>;
  onReloadExamPrep: () => Promise<void>;
  onOpenExams: () => void;
  onAddMistake: () => void;
  onStartReview: (subject: SubjectId) => void;
};

export function ExamPrepMapScreen({ officialExamPrep, onSelectExamTarget, onReloadExamPrep, onAddMistake }: Props) {
  const [repository] = useState(() => new PracticeQuestionRepository(supabase));
  const [practice, setPractice] = useState<{ skill: AssessedSkill; mistakeId: string } | null>(null);
  const startPractice = (skill: AssessedSkill) => {
    const mistakeById = new Map(officialExamPrep.mistakes.map((mistake) => [mistake.id, mistake]));
    const sourceMistake = officialExamPrep.links
      .filter((link) => link.skillCode === skill.code && linkAffectsOfficialMetrics(link))
      .map((link) => mistakeById.get(link.mistakeId))
      .filter((mistake): mistake is { id: string; createdAt: string } => Boolean(mistake))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (sourceMistake) setPractice({ skill, mistakeId: sourceMistake.id });
  };
  if (practice) return <PracticeQuestionsScreen skillCode={practice.skill.code} skillName={practice.skill.name} mistakeId={practice.mistakeId} repository={repository} onBack={() => setPractice(null)} onCompleted={async () => { await onReloadExamPrep(); }} />;
  return <OfficialExamPrepExperience data={officialExamPrep} onSelectCatalog={onSelectExamTarget} onRetry={onReloadExamPrep} onTrain={onAddMistake} onStartPractice={startPractice} />;
}
