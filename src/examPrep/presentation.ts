import type { AssessedSkill, ExamReadiness, SkillState } from './core';
import type { OfficialExamPrepData, PublishedExamCatalog } from './repository';

export type ExamProgramItem = {
  id: string;
  group: 'psc' | 'uea' | 'national';
  label: string;
  institution: string;
  stage?: number;
  catalog: PublishedExamCatalog | null;
};

const PROGRAMS: Omit<ExamProgramItem, 'catalog'>[] = [
  { id: 'psc-1', group: 'psc', label: 'PSC 1', institution: 'UFAM', stage: 1 },
  { id: 'psc-2', group: 'psc', label: 'PSC 2', institution: 'UFAM', stage: 2 },
  { id: 'psc-3', group: 'psc', label: 'PSC 3', institution: 'UFAM', stage: 3 },
  { id: 'sis-1', group: 'uea', label: 'SIS 1', institution: 'UEA', stage: 1 },
  { id: 'sis-2', group: 'uea', label: 'SIS 2', institution: 'UEA', stage: 2 },
  { id: 'sis-3', group: 'uea', label: 'SIS 3', institution: 'UEA', stage: 3 },
  { id: 'uea-vestibular', group: 'uea', label: 'Vestibular UEA', institution: 'UEA' },
  { id: 'enem', group: 'national', label: 'ENEM', institution: 'INEP' },
];

export function buildExamProgramItems(catalogs: readonly PublishedExamCatalog[]): ExamProgramItem[] {
  return PROGRAMS.map((item) => ({ ...item, catalog: catalogs.find((catalog) => matchesProgram(item, catalog)) ?? null }));
}

export function officialPrepView(data: OfficialExamPrepData): 'loading' | 'error' | 'catalog-home' | 'target' {
  if (data.status === 'loading') return 'loading';
  if (data.status === 'error') return 'error';
  return data.target && data.catalogs.some((catalog) => catalog.id === data.target?.catalogVersionId) ? 'target' : 'catalog-home';
}

export type SubjectSummary = {
  code: string;
  name: string;
  skills: AssessedSkill[];
  counts: Record<SkillState, number>;
};

export function summarizeSubjects(readiness: ExamReadiness): SubjectSummary[] {
  const summaries = new Map<string, SubjectSummary>();
  for (const skill of readiness.skills) {
    const current = summaries.get(skill.subjectCode) ?? {
      code: skill.subjectCode,
      name: skill.subjectName ?? skill.subjectCode.replaceAll('_', ' '),
      skills: [],
      counts: { not_assessed: 0, at_risk: 0, critical: 0, learning: 0, mastered: 0 },
    };
    current.skills.push(skill);
    current.counts[skill.state] += 1;
    summaries.set(skill.subjectCode, current);
  }
  return [...summaries.values()];
}

export function buildHomeExamPrepSummary(data: OfficialExamPrepData, readiness: ExamReadiness) {
  const catalog = data.target ? data.catalogs.find((item) => item.id === data.target?.catalogVersionId) ?? null : null;
  if (!catalog) return { kind: 'empty' as const };
  return {
    kind: 'target' as const,
    catalog,
    assessedSkills: readiness.assessedSkills,
    totalSkills: readiness.totalSkills,
    coverage: readiness.coverage,
    attentionCount: readiness.counts.at_risk + readiness.counts.critical,
    readiness: readiness.readinessVisible ? readiness.readiness : null,
  };
}

function matchesProgram(item: Omit<ExamProgramItem, 'catalog'>, catalog: PublishedExamCatalog): boolean {
  const program = catalog.programCode.toLowerCase();
  if (item.id === 'enem') return program === 'enem';
  if (item.id.startsWith('psc-')) return program === 'psc' && stageNumber(catalog.stage) === item.stage;
  if (item.id.startsWith('sis-')) return program === 'sis' && stageNumber(catalog.stage) === item.stage;
  return item.id === 'uea-vestibular' && ['macro', 'vestibular-uea', 'uea'].includes(program);
}

function stageNumber(value: string): number | undefined {
  const match = value.match(/[1-3]/);
  return match ? Number(match[0]) : undefined;
}
