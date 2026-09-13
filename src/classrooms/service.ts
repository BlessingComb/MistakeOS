import { supabase } from '../supabase';
import { classroomDemoEnabled } from '../features';
import { demoClassroom, demoClassroomAssignments, demoClassroomSkillSummary } from './demo';
import { normalizeClassroomInviteCode, type Classroom, type ClassroomAssignment, type ClassroomProgress, type ClassroomRole, type ClassroomRosterEntry, type ClassroomSkillSummary } from './core';

const unavailable = new Error('CLASSROOMS_UNAVAILABLE');

const rowToClassroom = (row: Record<string, unknown>): Classroom => ({
  id: String(row.id),
  name: String(row.name),
  objective: row.objective ? String(row.objective) : null,
  inviteCode: row.invite_code ? String(row.invite_code) : null,
  catalogVersionId: String(row.catalog_version_id),
  catalogLabel: String(row.catalog_label),
  teacherName: String(row.teacher_name),
  role: row.role === 'teacher' ? 'teacher' : 'student',
  memberCount: Number(row.member_count ?? 0),
});

const rowToAssignment = (row: Record<string, unknown>): ClassroomAssignment => ({
  id: String(row.id), skillCode: String(row.skill_code), skillName: String(row.skill_name), title: String(row.title), createdAt: String(row.created_at),
});

const rowToSkillSummary = (row: Record<string, unknown>): ClassroomSkillSummary => ({
  skillCode: String(row.skill_code), skillName: String(row.skill_name), subjectName: String(row.subject_name),
  atRiskCount: Number(row.at_risk_count), learningCount: Number(row.learning_count), masteredCount: Number(row.mastered_count), notAssessedCount: Number(row.not_assessed_count),
});

const rowToProgress = (row: Record<string, unknown>): ClassroomProgress => ({
  atRiskCount: Number(row.at_risk_count ?? 0), learningCount: Number(row.learning_count ?? 0),
  masteredCount: Number(row.mastered_count ?? 0), notAssessedCount: Number(row.not_assessed_count ?? 0),
  coveragePercent: Number(row.coverage_percent ?? 0),
});

const rowToRosterEntry = (row: Record<string, unknown>): ClassroomRosterEntry => ({
  userId: String(row.user_id), displayName: String(row.display_name), joinedAt: String(row.joined_at),
});

export async function listMyClassrooms(): Promise<Classroom[]> {
  if (classroomDemoEnabled) return [demoClassroom];
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('list_my_classrooms');
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => rowToClassroom(row));
}

export async function getMyClassroomRole(): Promise<ClassroomRole | null> {
  if (classroomDemoEnabled) return 'teacher';
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('get_my_app_role');
  if (error) throw error;
  return data === 'teacher' || data === 'student' ? data : null;
}

export async function createClassroom(input: { name: string; objective: string; catalogVersionId: string }): Promise<Classroom> {
  if (classroomDemoEnabled) throw new Error('CLASSROOMS_DEMO_READ_ONLY');
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('create_classroom', {
    p_name: input.name.trim(), p_objective: input.objective.trim() || null, p_catalog_version_id: input.catalogVersionId,
  });
  if (error || !data?.[0]) throw error ?? unavailable;
  return rowToClassroom(data[0]);
}

export async function joinClassroom(code: string): Promise<Classroom> {
  if (classroomDemoEnabled) throw new Error('CLASSROOMS_DEMO_READ_ONLY');
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('join_classroom_by_code', { p_code: normalizeClassroomInviteCode(code) });
  if (error || !data?.[0]) throw error ?? unavailable;
  return rowToClassroom(data[0]);
}

export async function listClassroomAssignments(classroomId: string): Promise<ClassroomAssignment[]> {
  if (classroomDemoEnabled && classroomId === demoClassroom.id) return demoClassroomAssignments;
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('list_classroom_assignments', { p_classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => rowToAssignment(row));
}

export async function getClassroomSkillSummary(classroomId: string): Promise<ClassroomSkillSummary[]> {
  if (classroomDemoEnabled && classroomId === demoClassroom.id) return demoClassroomSkillSummary;
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('get_classroom_skill_summary', { p_classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => rowToSkillSummary(row));
}

export async function getMyClassroomProgress(classroomId: string): Promise<ClassroomProgress | null> {
  if (classroomDemoEnabled && classroomId === demoClassroom.id) return { atRiskCount: 2, learningCount: 3, masteredCount: 1, notAssessedCount: 4, coveragePercent: 60 };
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('get_my_classroom_progress', { p_classroom_id: classroomId });
  if (error) throw error;
  return data?.[0] ? rowToProgress(data[0]) : null;
}

export async function listClassroomRoster(classroomId: string): Promise<ClassroomRosterEntry[]> {
  if (classroomDemoEnabled && classroomId === demoClassroom.id) return [
    { userId: 'demo-1', displayName: 'Ana', joinedAt: '2026-09-12T00:00:00.000Z' },
    { userId: 'demo-2', displayName: 'Lucas', joinedAt: '2026-09-12T00:00:00.000Z' },
  ];
  if (!supabase) throw unavailable;
  const { data, error } = await supabase.rpc('list_classroom_roster', { p_classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => rowToRosterEntry(row));
}

export async function createClassroomAssignment(input: { classroomId: string; skillCode: string; title: string }) {
  if (classroomDemoEnabled) throw new Error('CLASSROOMS_DEMO_READ_ONLY');
  if (!supabase) throw unavailable;
  const { error } = await supabase.rpc('create_classroom_assignment', {
    p_classroom_id: input.classroomId, p_skill_code: input.skillCode, p_title: input.title.trim(),
  });
  if (error) throw error;
}

export function isMissingClassroomSchema(error: unknown) {
  const value = error as { code?: string; message?: string };
  const message = value?.message?.toLowerCase() ?? '';
  return value?.code === '42P01' || value?.code === 'PGRST202' || message.includes('classroom') && (message.includes('does not exist') || message.includes('could not find'));
}
