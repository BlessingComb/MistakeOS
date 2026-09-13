import type { Classroom, ClassroomAssignment, ClassroomSkillSummary } from './core';

export const demoClassroom: Classroom = {
  id: 'demo_classroom_2a',
  name: 'DEMO — 2º Ano A',
  objective: 'Preparação orientada para o PSC 2 — UFAM.',
  inviteCode: null,
  catalogVersionId: 'demo_psc_2',
  catalogLabel: 'PSC 2 — UFAM',
  teacherName: 'Prof. Marina',
  role: 'teacher',
  memberCount: 28,
};

export const demoClassroomAssignments: ClassroomAssignment[] = [
  { id: 'demo_assignment_pg', skillCode: 'demo.progressao-geometrica', skillName: 'Progressões geométricas', title: 'Treino de recuperação — Progressões geométricas', createdAt: '2026-09-12T12:00:00.000Z' },
];

export const demoClassroomSkillSummary: ClassroomSkillSummary[] = [
  { skillCode: 'demo.estequiometria', skillName: 'Estequiometria', subjectName: 'Química', atRiskCount: 12, learningCount: 7, masteredCount: 5, notAssessedCount: 2 },
  { skillCode: 'demo.progressao-geometrica', skillName: 'Progressões geométricas', subjectName: 'Matemática', atRiskCount: 8, learningCount: 9, masteredCount: 6, notAssessedCount: 5 },
];
