import { supabase } from '../supabase';
import { normalizeInviteCode, type Circle, type CirclePost, type CirclePreview } from './core';
import type { GroupRankingEntry, GroupRankingPeriod } from './ranking';

const unavailable = new Error('Social features need a connection.');
const rowToCircle = (row: any): Circle => ({ id: row.id, ownerId: row.owner_id, name: row.name, subject: row.subject, goal: row.goal, inviteCode: row.invite_code, createdAt: row.created_at });
const rowToPost = (row: any): CirclePost => ({ id: row.id, circleId: row.circle_id, authorId: row.author_id, subject: row.subject, mistakeType: row.mistake_type, problemSummary: row.problem_summary, whatWentWrong: row.what_went_wrong, lesson: row.lesson, preventionRule: row.prevention_rule, createdAt: row.created_at });
const rowToRankingEntry = (row: any): GroupRankingEntry => ({ userId: row.user_id, displayName: row.display_name, rank: Number(row.rank), previousRank: row.previous_rank === null || row.previous_rank === undefined ? null : Number(row.previous_rank), rankDelta: Number(row.rank_delta), correctedCount: Number(row.corrected_count), sharedCount: Number(row.shared_count), correctionRate: Number(row.correction_rate), answerCount: Number(row.answer_count), activeDays: Number(row.active_days), streakDays: Number(row.streak_days), allTimeCorrectedCount: Number(row.all_time_corrected_count), distanceToNextRank: Number(row.distance_to_next_rank) });

export async function listMyCircles(userId: string): Promise<Circle[]> {
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.from('circle_members').select('study_circles(*)').eq('user_id', userId).order('joined_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((row: any) => row.study_circles ? [rowToCircle(row.study_circles)] : []);
}

export async function createCircle(input: { name: string; subject: string; goal?: string }) {
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('create_study_circle', { circle_name: input.name.trim(), circle_subject: input.subject, circle_goal: input.goal?.trim() || null });
  if (error || !data) throw error ?? new Error('Could not create circle.');
  return rowToCircle(data);
}

export async function previewCircle(code: string): Promise<CirclePreview | null> {
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('preview_circle_by_code', { code: normalizeInviteCode(code) });
  if (error) throw error;
  const row = data?.[0];
  return row ? { id: row.id, name: row.name, subject: row.subject, memberCount: Number(row.member_count) } : null;
}

export async function joinCircle(code: string) {
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('join_circle_by_code', { code: normalizeInviteCode(code) });
  if (error || !data?.[0]) throw error ?? new Error('Invalid invite code.');
  return data[0] as Pick<Circle, 'id' | 'name' | 'subject'>;
}

export async function leaveCircle(circleId: string, userId: string) {
  if (!supabase) throw unavailable;
  const { error } = await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', userId);
  if (error) throw error;
}

export async function listCirclePosts(circleId: string) {
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.from('circle_posts').select('*').eq('circle_id', circleId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPost);
}

export async function getCircleRanking(circleId: string, period: GroupRankingPeriod) {
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('get_study_group_ranking', { p_circle_id: circleId, p_period: period });
  if (error) throw error;
  return (data ?? []).map(rowToRankingEntry);
}

export async function shareCirclePost(input: Omit<CirclePost, 'id' | 'createdAt'>) {
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.from('circle_posts').insert({ circle_id: input.circleId, author_id: input.authorId, subject: input.subject, mistake_type: input.mistakeType, problem_summary: input.problemSummary, what_went_wrong: input.whatWentWrong, lesson: input.lesson, prevention_rule: input.preventionRule }).select().single();
  if (error || !data) throw error ?? new Error('Could not share mistake.');
  return rowToPost(data);
}
