import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogSkill, MistakeEvidence, MistakeSkillLink, VerifiedRecoveryEvidence } from './core';

export type PublishedExamCatalog = {
  id: string;
  programCode: string;
  programName: string;
  institution: string;
  stage: string;
  cycle: string;
  sourceUrl: string;
  sourceYear: number;
  examYear: number;
  projectYear: number;
  sourceDocument: string;
  documentVersion: string;
  catalogVersion: string;
};

export type ExamTarget = { id: string; catalogVersionId: string; targetDate?: string };
export type OfficialExamPrepStatus = 'loading' | 'ready' | 'unavailable' | 'error';
export type OfficialExamPrepData = {
  catalogs: PublishedExamCatalog[];
  target: ExamTarget | null;
  catalogSkills: CatalogSkill[];
  mistakes: MistakeEvidence[];
  links: MistakeSkillLink[];
  recoveries: VerifiedRecoveryEvidence[];
  available: boolean;
  status: OfficialExamPrepStatus;
};

export function emptyOfficialExamPrepData(status: OfficialExamPrepStatus = 'unavailable'): OfficialExamPrepData {
  return { catalogs: [], target: null, catalogSkills: [], mistakes: [], links: [], recoveries: [], available: status === 'ready', status };
}

export class ExamPrepRepository {
  constructor(private readonly cloud: SupabaseClient | null) {}

  async load(language: 'en' | 'pt-BR' = 'en'): Promise<OfficialExamPrepData> {
    if (!this.cloud) return emptyOfficialExamPrepData();
    const session = (await this.cloud.auth.getSession()).data.session;
    if (!session) return emptyOfficialExamPrepData();
    const { data: rawCatalogs, error: catalogError } = await this.cloud
      .from('exam_catalog_versions')
      .select('id,stage,cycle,exam_year,project_year,source_url,source_year,source_document,document_version,catalog_version,exam_programs!inner(code,name,institution)')
      .eq('status', 'published');
    if (catalogError) return emptyOfficialExamPrepData(isMissingCatalogSchema(catalogError) ? 'unavailable' : 'error');
    const catalogs = (rawCatalogs ?? []).map(parseCatalog);
    const { data: rawTarget, error: targetError } = await this.cloud.from('user_exam_targets').select('id,catalog_version_id,target_date').eq('is_primary', true).maybeSingle();
    if (targetError) return { ...emptyOfficialExamPrepData('error'), catalogs };
    const target = rawTarget ? { id: String(rawTarget.id), catalogVersionId: String(rawTarget.catalog_version_id), ...(rawTarget.target_date ? { targetDate: String(rawTarget.target_date) } : {}) } : null;
    if (!target) return { ...emptyOfficialExamPrepData('ready'), catalogs };

    const { data: rawMappings, error: mappingsError } = await this.cloud.from('exam_catalog_skills').select('skill_code,curriculum_skills!inner(code,subject_code,name_pt_br,name_en,academic_subjects!inner(name_pt_br,name_en))').eq('catalog_version_id', target.catalogVersionId).order('display_order', { ascending: true });
    if (mappingsError) return { ...emptyOfficialExamPrepData('error'), catalogs, target };
    const catalogSkills = (rawMappings ?? []).map((row) => {
      const skill = firstRelation(row.curriculum_skills) as Record<string, unknown>;
      const subject = firstRelation(skill.academic_subjects) as Record<string, unknown>;
      return { code: String(skill.code), subjectCode: String(skill.subject_code), subjectName: String(language === 'pt-BR' ? subject.name_pt_br : subject.name_en), name: String(language === 'pt-BR' ? skill.name_pt_br : skill.name_en) };
    });
    const skillCodes = catalogSkills.map((skill) => skill.code);
    if (skillCodes.length === 0) return { ...emptyOfficialExamPrepData('ready'), catalogs, target };

    const { data: rawLinks, error: linksError } = await this.cloud.from('mistake_skill_links').select('mistake_id,skill_code,link_source,confidence,confirmed_at,mistakes!inner(id,created_at)').in('skill_code', skillCodes);
    if (linksError) return { ...emptyOfficialExamPrepData('error'), catalogs, target, catalogSkills };
    const links: MistakeSkillLink[] = [];
    const mistakes = new Map<string, MistakeEvidence>();
    (rawLinks ?? []).forEach((row) => {
      const mistake = firstRelation(row.mistakes) as Record<string, unknown>;
      const mistakeId = String(row.mistake_id);
      mistakes.set(mistakeId, { id: mistakeId, createdAt: String(mistake.created_at) });
      links.push({ mistakeId, skillCode: String(row.skill_code), source: row.link_source as MistakeSkillLink['source'], ...(row.confidence === null ? {} : { confidence: Number(row.confidence) }), ...(row.confirmed_at ? { confirmedAt: String(row.confirmed_at) } : {}) });
    });
    const mistakeIds = [...mistakes.keys()];
    let recoveries: VerifiedRecoveryEvidence[] = [];
    if (mistakeIds.length > 0) {
      const { data: rawRecoveries, error: recoveriesError } = await this.cloud.from('recovery_sessions').select('id,mistake_id,verified_at,recovery_answers(correct,pattern_resisted)').in('mistake_id', mistakeIds).not('verified_at', 'is', null);
      if (recoveriesError) return { ...emptyOfficialExamPrepData('error'), catalogs, target, catalogSkills, mistakes: [...mistakes.values()], links };
      recoveries = (rawRecoveries ?? []).map((row) => {
        const answers = Array.isArray(row.recovery_answers) ? row.recovery_answers : [];
        const successful = answers.filter((answer) => answer.correct && answer.pattern_resisted).length >= 2;
        return { id: String(row.id), mistakeId: String(row.mistake_id), verifiedAt: String(row.verified_at), successful };
      });
    }
    return { catalogs, target, catalogSkills, mistakes: [...mistakes.values()], links, recoveries, available: true, status: 'ready' };
  }

  async selectTarget(catalogVersionId: string): Promise<boolean> {
    if (!this.cloud) return false;
    const { error } = await this.cloud.rpc('set_exam_target', { p_catalog_version_id: catalogVersionId, p_target_date: null });
    return !error;
  }
}

function isMissingCatalogSchema(error: { code?: string; message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('exam_catalog_versions') && (message.includes('not find') || message.includes('does not exist'));
}

function parseCatalog(row: Record<string, unknown>): PublishedExamCatalog {
  const program = firstRelation(row.exam_programs) as Record<string, unknown>;
  return { id: String(row.id), programCode: String(program.code), programName: String(program.name), institution: String(program.institution), stage: String(row.stage), cycle: String(row.cycle), examYear: Number(row.exam_year), projectYear: Number(row.project_year), sourceUrl: String(row.source_url), sourceYear: Number(row.source_year), sourceDocument: String(row.source_document), documentVersion: String(row.document_version), catalogVersion: String(row.catalog_version) };
}
function firstRelation(value: unknown): unknown { return Array.isArray(value) ? value[0] ?? {} : value ?? {}; }
