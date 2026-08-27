import type { AccessLevel } from '../entitlements';

export type XpEventType = 'mistake_added' | 'never_again_completed' | 'pattern_resisted' | 'risk_score_reduced' | 'topic_recovering' | 'topic_mastered' | 'exam_prep_map_completed' | 'league_challenge_completed';
export type XpTransaction = { id: string; userId: string; type: XpEventType; amount: number; sourceId: string; createdAt: string };
export type LeagueMembership = { leagueId: string; userId: string; status: 'active' | 'paused' | 'left'; joinedAt: string };

export const XP_RULES: Readonly<Record<XpEventType, number>> = {
  mistake_added: 5, never_again_completed: 15, pattern_resisted: 20, risk_score_reduced: 10, topic_recovering: 20, topic_mastered: 50, exam_prep_map_completed: 30, league_challenge_completed: 20,
};

export function socialCapabilities(level: AccessLevel) {
  const pro = level === 'pro';
  return { canCreateLeague: pro, canJoinMultipleLeagues: pro, canCreateLeagueChallenge: pro, canViewAdvancedLeagueStats: pro } as const;
}

export function canJoinLeague(level: AccessLevel, memberships: readonly LeagueMembership[]) {
  return level === 'pro' || memberships.filter((membership) => membership.status === 'active').length < 1;
}

export function normalizeMembershipsForAccess(level: AccessLevel, memberships: readonly LeagueMembership[]): LeagueMembership[] {
  if (level === 'pro') return memberships.map((membership) => membership.status === 'paused' ? { ...membership, status: 'active' } : membership);
  const active = memberships.find((membership) => membership.status === 'active') ?? memberships.find((membership) => membership.status === 'paused');
  return memberships.map((membership) => membership.status === 'left' ? membership : { ...membership, status: membership.leagueId === active?.leagueId ? 'active' : 'paused' });
}

export function awardXp(transactions: readonly XpTransaction[], input: Omit<XpTransaction, 'id' | 'amount'>): XpTransaction[] {
  if (transactions.some((transaction) => transaction.userId === input.userId && transaction.type === input.type && transaction.sourceId === input.sourceId)) return [...transactions];
  return [...transactions, { ...input, id: `${input.type}:${input.sourceId}`, amount: XP_RULES[input.type] }];
}

export function weekStart(value: Date): Date {
  const result = new Date(value);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function weeklyXp(transactions: readonly XpTransaction[], userId: string, now = new Date()): number {
  const start = weekStart(now).getTime();
  return transactions.filter((transaction) => transaction.userId === userId && new Date(transaction.createdAt).getTime() >= start).reduce((total, transaction) => total + transaction.amount, 0);
}
