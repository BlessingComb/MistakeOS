import { calculateEvidenceRisk, RISK_CRITICAL_THRESHOLD, RISK_HIGH_THRESHOLD } from '../prepMap/risk';

export const EXAM_READINESS_MIN_ASSESSED_SKILLS = 5;
export const EXAM_READINESS_MIN_COVERAGE = 0.2;
export const MASTERY_REQUIRED_VERIFIED_RECOVERIES = 2;
export const MASTERY_REQUIRED_DISTINCT_DAYS = 2;
export const AI_SKILL_LINK_MIN_CONFIDENCE = 0.85;

export type SkillState = 'not_assessed' | 'at_risk' | 'critical' | 'learning' | 'mastered';
export type SkillLinkSource = 'deterministic' | 'ai' | 'user' | 'reviewed';
export type CatalogSkill = { code: string; subjectCode: string; subjectName?: string; name: string };
export type MistakeEvidence = { id: string; createdAt: string };
export type MistakeSkillLink = { mistakeId: string; skillCode: string; source: SkillLinkSource; confidence?: number; confirmedAt?: string };
export type VerifiedRecoveryEvidence = { id: string; mistakeId: string; verifiedAt: string; successful: boolean };
export type AssessedSkill = CatalogSkill & { state: SkillState; riskScore: number | null; mistakeCount: number; verifiedRecoveryCount: number; verifiedRecoveryDays: number };
export type ExamReadiness = {
  skills: AssessedSkill[];
  totalSkills: number;
  assessedSkills: number;
  coverage: number;
  assessedMastery: number | null;
  readiness: number | null;
  readinessVisible: boolean;
  counts: Record<SkillState, number>;
};

export function linkAffectsOfficialMetrics(link: MistakeSkillLink): boolean {
  if (link.confirmedAt) return true;
  if (link.source !== 'ai') return true;
  return typeof link.confidence === 'number' && link.confidence >= AI_SKILL_LINK_MIN_CONFIDENCE;
}

export function buildOfficialExamReadiness(
  catalogSkills: readonly CatalogSkill[], mistakes: readonly MistakeEvidence[], links: readonly MistakeSkillLink[],
  recoveries: readonly VerifiedRecoveryEvidence[], now = new Date(),
): ExamReadiness {
  const mistakeById = new Map(mistakes.map((mistake) => [mistake.id, mistake]));
  const eligibleLinks = links.filter(linkAffectsOfficialMetrics);
  const skills = uniqueBy(catalogSkills, (skill) => skill.code).map((skill) => {
    const mistakeIds = new Set(eligibleLinks.filter((link) => link.skillCode === skill.code && mistakeById.has(link.mistakeId)).map((link) => link.mistakeId));
    const skillMistakes = [...mistakeIds].map((id) => mistakeById.get(id)!).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return assessSkill(skill, skillMistakes, recoveries, now);
  });
  const assessed = skills.filter((skill) => skill.state !== 'not_assessed');
  const masteryPoints = assessed.reduce((total, skill) => total + statePoints(skill.state), 0);
  const coverage = skills.length ? assessed.length / skills.length : 0;
  const assessedMastery = assessed.length ? masteryPoints / assessed.length : null;
  const readinessVisible = assessed.length >= EXAM_READINESS_MIN_ASSESSED_SKILLS && coverage >= EXAM_READINESS_MIN_COVERAGE;
  const counts: Record<SkillState, number> = { not_assessed: 0, at_risk: 0, critical: 0, learning: 0, mastered: 0 };
  skills.forEach((skill) => { counts[skill.state] += 1; });
  return { skills, totalSkills: skills.length, assessedSkills: assessed.length, coverage, assessedMastery, readiness: readinessVisible && assessedMastery !== null ? Math.round(assessedMastery * 100) : null, readinessVisible, counts };
}

function assessSkill(skill: CatalogSkill, mistakes: readonly MistakeEvidence[], recoveries: readonly VerifiedRecoveryEvidence[], now: Date): AssessedSkill {
  if (mistakes.length === 0) return { ...skill, state: 'not_assessed', riskScore: null, mistakeCount: 0, verifiedRecoveryCount: 0, verifiedRecoveryDays: 0 };
  const mistakeIds = new Set(mistakes.map((mistake) => mistake.id));
  const latestMistakeAt = mistakes.reduce((latest, mistake) => mistake.createdAt > latest ? mistake.createdAt : latest, mistakes[0]!.createdAt);
  const validRecoveries = uniqueBy(recoveries.filter((recovery) => recovery.successful && mistakeIds.has(recovery.mistakeId) && recovery.verifiedAt > latestMistakeAt), (recovery) => recovery.id);
  const recoveryDays = new Set(validRecoveries.map((recovery) => utcDay(recovery.verifiedAt)));
  const mastered = validRecoveries.length >= MASTERY_REQUIRED_VERIFIED_RECOVERIES && recoveryDays.size >= MASTERY_REQUIRED_DISTINCT_DAYS;
  const riskScore = calculateEvidenceRisk(mistakes.map((mistake) => mistake.createdAt), validRecoveries.length, now);
  const state: SkillState = mastered ? 'mastered' : riskScore >= RISK_CRITICAL_THRESHOLD ? 'critical' : riskScore >= RISK_HIGH_THRESHOLD ? 'at_risk' : 'learning';
  return { ...skill, state, riskScore, mistakeCount: mistakes.length, verifiedRecoveryCount: validRecoveries.length, verifiedRecoveryDays: recoveryDays.size };
}

function statePoints(state: SkillState): number { return state === 'mastered' ? 1 : state === 'learning' ? 0.5 : 0; }
function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] { const seen = new Set<string>(); return values.filter((value) => { const id = key(value); if (seen.has(id)) return false; seen.add(id); return true; }); }
function utcDay(value: string): string { return new Date(value).toISOString().slice(0, 10); }
