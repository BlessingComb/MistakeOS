import type { ExamRecord } from '../exams';
import type { OfficialExamPrepData } from '../examPrep';
import type { MistakeRecord } from '../mistakes';
import type { SubjectId } from '../onboarding';
import type { ReviewEvidence } from '../prepMap';
import { OfficialExamPrepExperience } from './OfficialExamPrepExperience';

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
  return <OfficialExamPrepExperience data={officialExamPrep} onSelectCatalog={onSelectExamTarget} onRetry={onReloadExamPrep} onTrain={onAddMistake} />;
}
