export type GroupRankingPeriod = 'week' | 'month' | 'total';

export type GroupRankingEntry = {
  userId: string;
  displayName: string;
  rank: number;
  previousRank: number | null;
  rankDelta: number;
  correctedCount: number;
  sharedCount: number;
  correctionRate: number;
  answerCount: number;
  activeDays: number;
  streakDays: number;
  allTimeCorrectedCount: number;
  distanceToNextRank: number;
};

export type GroupRankingHighlight = 'mostCorrected' | 'mostConsistent' | 'bestRate' | 'biggestClimb';

export const GROUP_MILESTONES = [1, 5, 10, 25, 50, 100] as const;

export function sortRanking(entries: readonly GroupRankingEntry[]) {
  return [...entries].sort((a, b) => b.correctedCount - a.correctedCount || b.correctionRate - a.correctionRate || b.activeDays - a.activeDays || a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId));
}

export function topRanked(entries: readonly GroupRankingEntry[]) {
  return sortRanking(entries).slice(0, 3);
}

export function rankingEntryForUser(entries: readonly GroupRankingEntry[], userId: string) {
  return entries.find((entry) => entry.userId === userId) ?? null;
}

export function nextMilestone(correctedCount: number) {
  return GROUP_MILESTONES.find((milestone) => correctedCount < milestone) ?? null;
}

export function unlockedMilestone(correctedCount: number, previousCount: number) {
  return [...GROUP_MILESTONES].reverse().find((milestone) => correctedCount >= milestone && previousCount < milestone) ?? null;
}

export function weeklyHighlights(entries: readonly GroupRankingEntry[]): { kind: GroupRankingHighlight; entry: GroupRankingEntry }[] {
  const ordered = sortRanking(entries);
  if (!ordered.some((entry) => entry.correctedCount > 0)) return [];
  const corrected = ordered.find((entry) => entry.correctedCount > 0);
  const consistent = [...ordered].sort((a, b) => b.activeDays - a.activeDays || b.streakDays - a.streakDays || a.rank - b.rank).find((entry) => entry.activeDays > 0);
  const rate = [...ordered].sort((a, b) => b.correctionRate - a.correctionRate || b.answerCount - a.answerCount || a.rank - b.rank).find((entry) => entry.answerCount >= 3);
  const climb = [...ordered].sort((a, b) => b.rankDelta - a.rankDelta || a.rank - b.rank).find((entry) => entry.rankDelta > 0);
  const candidates: { kind: GroupRankingHighlight; entry: GroupRankingEntry }[] = [];
  if (corrected) candidates.push({ kind: 'mostCorrected', entry: corrected });
  if (consistent && consistent.userId !== corrected?.userId) candidates.push({ kind: 'mostConsistent', entry: consistent });
  if (rate && !candidates.some((candidate) => candidate.entry.userId === rate.userId)) candidates.push({ kind: 'bestRate', entry: rate });
  if (climb && !candidates.some((candidate) => candidate.entry.userId === climb.userId)) candidates.push({ kind: 'biggestClimb', entry: climb });
  return candidates.slice(0, 3);
}
