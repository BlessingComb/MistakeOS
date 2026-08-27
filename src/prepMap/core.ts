import type { ExamRecord } from '../exams/core';
import type { MistakeRecord } from '../mistakes/core';
import type { SubjectId } from '../onboarding/core';

export type PrepMapState = 'HIGH RISK' | 'RECOVERING' | 'MASTERED';

export type PrepMapItem = {
  id: string;
  subject: SubjectId;
  topic?: string;
  cause: MistakeRecord['cause'];
  mistakes: MistakeRecord[];
  riskScore: number;
  state: PrepMapState;
  estimatedMinutes: number;
  reviewedCount: number;
};

export type ExamPrepMap = {
  exam: ExamRecord;
  items: PrepMapItem[];
  readiness: number;
  pointsAtRisk: number;
  estimatedMinutes: number;
  personalRules: string[];
};

export type ReviewEvidence = Record<string, number>;

export function upcomingExam(exams: readonly ExamRecord[], now = new Date()): ExamRecord | null {
  const today = dateOnly(now);
  return exams.find((exam) => exam.date >= today) ?? null;
}

export function buildExamPrepMap(exam: ExamRecord, mistakes: readonly MistakeRecord[], evidence: ReviewEvidence = {}, now = new Date()): ExamPrepMap {
  const relevant = mistakes.filter((mistake) => mistake.subject === exam.subject);
  const groups = new Map<string, MistakeRecord[]>();
  relevant.forEach((mistake) => {
    const key = `${mistake.topic ?? 'unidentified'}::${mistake.cause ?? 'uncertain'}`;
    groups.set(key, [...(groups.get(key) ?? []), mistake]);
  });

  const items = [...groups.entries()].map(([key, group]) => {
    const [topicKey, causeKey] = key.split('::');
    return buildItem(exam.subject, topicKey === 'unidentified' ? undefined : topicKey, causeKey === 'uncertain' ? undefined : causeKey as NonNullable<MistakeRecord['cause']>, group, evidence, now);
  })
    .sort((a, b) => b.riskScore - a.riskScore || b.mistakes.length - a.mistakes.length || a.id.localeCompare(b.id));
  const averageRisk = items.length ? Math.round(items.reduce((total, item) => total + item.riskScore, 0) / items.length) : 100;
  const readiness = items.length ? Math.max(0, Math.min(100, 100 - averageRisk)) : 0;
  const pointsAtRisk = items.reduce((total, item) => total + Math.max(1, Math.ceil(item.riskScore / 25)), 0);
  const estimatedMinutes = items.reduce((total, item) => total + item.estimatedMinutes, 0);
  const personalRules = [...relevant]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((mistake) => mistake.photoAnalysis?.status === 'identified' ? mistake.photoAnalysis.correctionSteps[0] ?? mistake.photoAnalysis.errorSummary : mistake.note)
    .filter((rule, index, rules) => Boolean(rule) && rules.indexOf(rule) === index)
    .slice(0, 3);

  return { exam, items, readiness, pointsAtRisk, estimatedMinutes, personalRules };
}

function buildItem(subject: SubjectId, topic: string | undefined, cause: NonNullable<MistakeRecord['cause']> | undefined, mistakes: MistakeRecord[], evidence: ReviewEvidence, now: Date): PrepMapItem {
  const reviewedCount = mistakes.reduce((total, mistake) => total + (evidence[mistake.id] ?? 0), 0);
  const recentCount = mistakes.filter((mistake) => daysSince(mistake.createdAt, now) <= 14).length;
  const baseRisk = 38 + mistakes.length * 17 + recentCount * 5;
  const riskScore = Math.max(8, Math.min(100, baseRisk - reviewedCount * 18));
  const state: PrepMapState = riskScore >= 70 ? 'HIGH RISK' : riskScore >= 30 ? 'RECOVERING' : 'MASTERED';
  return {
    id: `${subject}-${topic ?? 'unidentified'}-${cause ?? 'uncertain'}`,
    subject,
    ...(topic ? { topic } : {}),
    cause,
    mistakes,
    riskScore,
    state,
    estimatedMinutes: Math.max(3, Math.min(12, 2 + mistakes.length * 2)),
    reviewedCount,
  };
}

function daysSince(value: string, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
}

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
