import { buildHomeExamPrepSummary, type AssessedSkill, type ExamReadiness, type OfficialExamPrepData } from '../examPrep';

export type HomeDashboard = {
  target: ReturnType<typeof buildHomeExamPrepSummary>;
  focus: AssessedSkill | null;
  counts: { mastered: number; learning: number; atRisk: number; notAssessed: number };
};

export function buildHomeDashboard(data: OfficialExamPrepData, readiness: ExamReadiness): HomeDashboard {
  const focus = [...readiness.skills]
    .filter((skill) => skill.state === 'critical' || skill.state === 'at_risk')
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0) || b.mistakeCount - a.mistakeCount)[0] ?? null;
  return {
    target: buildHomeExamPrepSummary(data, readiness),
    focus,
    counts: {
      mastered: readiness.counts.mastered,
      learning: readiness.counts.learning,
      atRisk: readiness.counts.at_risk + readiness.counts.critical,
      notAssessed: readiness.counts.not_assessed,
    },
  };
}

export function daysUntil(targetDate?: string, now = new Date()) {
  if (!targetDate) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(`${targetDate}T00:00:00.000Z`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - start) / 86_400_000));
}
