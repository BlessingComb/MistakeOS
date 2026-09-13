export type ClassroomRole = 'teacher' | 'student';

export type Classroom = {
  id: string;
  name: string;
  objective: string | null;
  inviteCode: string | null;
  catalogVersionId: string;
  catalogLabel: string;
  teacherName: string;
  role: ClassroomRole;
  memberCount: number;
};

export type ClassroomAssignment = {
  id: string;
  skillCode: string;
  skillName: string;
  title: string;
  createdAt: string;
};

export type ClassroomSkillSummary = {
  skillCode: string;
  skillName: string;
  subjectName: string;
  atRiskCount: number;
  learningCount: number;
  masteredCount: number;
  notAssessedCount: number;
};

export type ClassroomProgress = {
  atRiskCount: number;
  learningCount: number;
  masteredCount: number;
  notAssessedCount: number;
  coveragePercent: number;
};

export type ClassroomRosterEntry = {
  userId: string;
  displayName: string;
  joinedAt: string;
};

export function normalizeClassroomInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function sortClassroomAttention(items: readonly ClassroomSkillSummary[]) {
  return [...items].sort((a, b) =>
    b.atRiskCount - a.atRiskCount
    || b.learningCount - a.learningCount
    || a.skillName.localeCompare(b.skillName),
  );
}
