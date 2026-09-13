export const RISK_CRITICAL_THRESHOLD = 85;
export const RISK_HIGH_THRESHOLD = 70;
export const RISK_MASTERED_THRESHOLD = 30;

export function calculateEvidenceRisk(mistakeDates: readonly string[], recoveryCount: number, now = new Date()): number {
  const recentMistakes = mistakeDates.filter((createdAt) => daysSince(createdAt, now) <= 14).length;
  return clamp(8, 100, 38 + mistakeDates.length * 17 + recentMistakes * 5 - recoveryCount * 18);
}

function daysSince(value: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
}
function clamp(minimum: number, maximum: number, value: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
