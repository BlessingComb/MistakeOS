import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { buildExamProgramItems, buildOfficialExamReadiness, officialPrepView, summarizeSubjects, type AssessedSkill, type OfficialExamPrepData, type PublishedExamCatalog, type SubjectSummary } from '../examPrep';
import { useTranslation } from '../i18n';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Props = {
  data: OfficialExamPrepData;
  onSelectCatalog: (id: string) => Promise<boolean>;
  onRetry: () => Promise<void>;
  onTrain: () => void;
};

type ViewState = { name: 'home' } | { name: 'target' } | { name: 'subject'; subjectCode: string };

export function OfficialExamPrepExperience({ data, onSelectCatalog, onRetry, onTrain }: Props) {
  const [view, setView] = useState<ViewState>(() => data.target ? { name: 'target' } : { name: 'home' });
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selectionFailed, setSelectionFailed] = useState(false);
  const readiness = useMemo(() => buildOfficialExamReadiness(data.catalogSkills, data.mistakes, data.links, data.recoveries), [data]);
  const subjects = useMemo(() => summarizeSubjects(readiness), [readiness]);
  const currentCatalog = data.target ? data.catalogs.find((catalog) => catalog.id === data.target?.catalogVersionId) ?? null : null;
  const state = officialPrepView(data);

  if (state === 'loading') return <PrepLoading />;
  if (state === 'error') return <PrepError onRetry={onRetry} />;
  if (view.name === 'subject' && currentCatalog) {
    const subject = subjects.find((item) => item.code === view.subjectCode);
    if (subject) return <SubjectDetail catalog={currentCatalog} subject={subject} onBack={() => setView({ name: 'target' })} onTrain={onTrain} />;
  }
  if (view.name === 'target' && currentCatalog) {
    return <TargetOverview catalog={currentCatalog} readiness={readiness} subjects={subjects} onChooseAnother={() => setView({ name: 'home' })} onOpenSubject={(subjectCode) => setView({ name: 'subject', subjectCode })} onTrain={onTrain} />;
  }

  const select = async (catalog: PublishedExamCatalog) => {
    setSelectionFailed(false);
    setSelecting(catalog.id);
    const selected = await onSelectCatalog(catalog.id);
    setSelecting(null);
    if (selected) setView({ name: 'target' }); else setSelectionFailed(true);
  };
  return <ExamPrepHome data={data} selecting={selecting} selectionFailed={selectionFailed} onSelect={select} onContinueTarget={currentCatalog ? () => setView({ name: 'target' }) : undefined} />;
}

function ScreenHeader() {
  const { t } = useTranslation();
  return <><View style={styles.brand}><BrandMark /></View><Text style={styles.eyebrow}>{t('officialPrep.homeEyebrow')}</Text><Text style={styles.title}>{t('officialPrep.title')}</Text><Text style={styles.lead}>{t('officialPrep.homeLead')}</Text></>;
}

function ExamPrepHome({ data, selecting, selectionFailed, onSelect, onContinueTarget }: { data: OfficialExamPrepData; selecting: string | null; selectionFailed: boolean; onSelect: (catalog: PublishedExamCatalog) => void; onContinueTarget?: () => void }) {
  const { t } = useTranslation();
  const programs = buildExamProgramItems(data.catalogs);
  return <ScrollView style={styles.base} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><View style={styles.screen}><ScreenHeader />
    {onContinueTarget && <Pressable accessibilityRole="button" onPress={onContinueTarget} style={({ pressed }) => [styles.resume, pressed && styles.pressed]}><View style={styles.resumeIcon}><Feather name="target" size={17} color={colors.onAccent} /></View><View style={styles.grow}><Text style={styles.resumeLabel}>{t('officialPrep.currentTarget')}</Text><Text style={styles.resumeTitle}>{t('officialPrep.continuePreparation')}</Text></View><Feather name="arrow-right" size={18} color={colors.signal} /></Pressable>}
    <View style={styles.notice}><Feather name="shield" size={15} color={colors.signal} /><Text style={styles.noticeText}>{t(data.catalogs.length ? 'officialPrep.onlyPublished' : 'officialPrep.contentPreparing')}</Text></View>
    {selectionFailed && <View style={styles.selectionError}><Feather name="alert-circle" size={15} color={colors.risk} /><Text style={styles.selectionErrorText}>{t('officialPrep.selectionError')}</Text></View>}
    <ProgramGroup title={t('officialPrep.group.psc')} subtitle="UFAM" items={programs.filter((item) => item.group === 'psc')} selecting={selecting} onSelect={onSelect} />
    <ProgramGroup title={t('officialPrep.group.uea')} subtitle="UEA" items={programs.filter((item) => item.group === 'uea')} selecting={selecting} onSelect={onSelect} />
    <ProgramGroup title={t('officialPrep.group.national')} subtitle="INEP" items={programs.filter((item) => item.group === 'national')} selecting={selecting} onSelect={onSelect} />
  </View></ScrollView>;
}

function ProgramGroup({ title, subtitle, items, selecting, onSelect }: { title: string; subtitle: string; items: ReturnType<typeof buildExamProgramItems>; selecting: string | null; onSelect: (catalog: PublishedExamCatalog) => void }) {
  const { t } = useTranslation();
  return <View style={styles.programGroup}><View style={styles.groupHead}><Text style={styles.groupTitle}>{title}</Text><Text style={styles.groupInstitution}>{subtitle}</Text></View><View style={styles.programList}>{items.map((item, index) => {
    const available = Boolean(item.catalog);
    return <Pressable key={item.id} disabled={!available || Boolean(selecting)} accessibilityRole="button" accessibilityState={{ disabled: !available }} onPress={() => item.catalog && onSelect(item.catalog)} style={({ pressed }) => [styles.programRow, index === items.length - 1 && styles.programRowLast, pressed && styles.pressed]}><View style={[styles.programSignal, available && styles.programSignalAvailable]} /><View style={styles.grow}><Text style={styles.programName}>{item.label}</Text><Text style={styles.programMeta}>{available ? t('officialPrep.available') : t('officialPrep.inPreparation')}</Text></View>{selecting === item.catalog?.id ? <ActivityIndicator size="small" color={colors.signal} /> : available ? <Feather name="arrow-up-right" size={17} color={colors.signal} /> : <Feather name="clock" size={15} color={colors.faint} />}</Pressable>;
  })}</View></View>;
}

function TargetOverview({ catalog, readiness, subjects, onChooseAnother, onOpenSubject, onTrain }: { catalog: PublishedExamCatalog; readiness: ReturnType<typeof buildOfficialExamReadiness>; subjects: SubjectSummary[]; onChooseAnother: () => void; onOpenSubject: (code: string) => void; onTrain: () => void }) {
  const { t, formatNumber } = useTranslation();
  const attention = readiness.counts.at_risk + readiness.counts.critical;
  return <ScrollView style={styles.base} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><View style={styles.screen}>
    <Pressable accessibilityRole="button" onPress={onChooseAnother} style={styles.back}><Feather name="arrow-left" size={16} color={colors.signal} /><Text style={styles.backText}>{t('officialPrep.chooseAnother')}</Text></Pressable>
    <Text style={styles.eyebrow}>{catalog.institution}</Text><Text style={styles.title}>{catalog.programName} {catalog.stage}</Text><Text style={styles.lead}>{catalog.cycle} · {formatNumber(catalog.examYear)}</Text>
    <View style={styles.metrics}><View style={styles.metricPrimary}><Text style={styles.metricLabel}>{t('officialPrep.coverage')}</Text><Text style={styles.metricValue}>{formatNumber(Math.round(readiness.coverage * 100))}<Text style={styles.metricUnit}>%</Text></Text><Text style={styles.metricHelp}>{t('officialPrep.assessedCount', { assessed: formatNumber(readiness.assessedSkills), total: formatNumber(readiness.totalSkills) })}</Text></View><View style={styles.metricSecondary}><Text style={styles.metricLabel}>{t('prepMap.readiness')}</Text>{readiness.readinessVisible ? <Text style={styles.readinessValue}>{formatNumber(readiness.readiness!)}%</Text> : <Text style={styles.insufficient}>{t('officialPrep.insufficientEvidence')}</Text>}<Text style={styles.metricHelp}>{t('officialPrep.assessedMasteryHint')}</Text></View></View>
    <View style={styles.attentionLine}><View><Text style={styles.attentionNumber}>{formatNumber(attention)}</Text><Text style={styles.attentionLabel}>{t(attention === 1 ? 'officialPrep.oneAttentionPoint' : 'officialPrep.attentionPoints')}</Text></View><Feather name="activity" size={20} color={attention ? colors.risk : colors.mastered} /></View>
    {attention > 0 ? <PrimaryButton label={t('officialPrep.trainWeakPoints')} meta={t('officialPrep.trainMeta')} onPress={onTrain} /> : readiness.assessedSkills === 0 ? <PrimaryButton label={t('officialPrep.addEvidence')} meta={t('officialPrep.addEvidenceMeta')} onPress={onTrain} /> : null}
    <View style={styles.subjectSection}><Text style={styles.sectionTitle}>{t('officialPrep.bySubject')}</Text><Text style={styles.sectionLead}>{t('officialPrep.subjectLead')}</Text>{subjects.map((subject) => <SubjectCard key={subject.code} subject={subject} onPress={() => onOpenSubject(subject.code)} />)}</View>
  </View></ScrollView>;
}

function SubjectCard({ subject, onPress }: { subject: SubjectSummary; onPress: () => void }) {
  const { t, formatNumber } = useTranslation();
  const risk = subject.counts.at_risk + subject.counts.critical;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.subjectCard, pressed && styles.pressed]}><View style={styles.subjectHead}><View style={styles.grow}><Text style={styles.subjectName}>{subject.name}</Text><Text style={styles.subjectTotal}>{t('officialPrep.skillCount', { count: formatNumber(subject.skills.length) })}</Text></View><Feather name="chevron-right" size={19} color={colors.signal} /></View><View style={styles.subjectStats}><MiniStat label={t('officialPrep.atRisk')} value={risk} tone={colors.risk} /><MiniStat label={t('officialPrep.learning')} value={subject.counts.learning} tone={colors.recovering} /><MiniStat label={t('officialPrep.mastered')} value={subject.counts.mastered} tone={colors.mastered} /><MiniStat label={t('officialPrep.notAssessed')} value={subject.counts.not_assessed} tone={colors.faint} /></View></Pressable>;
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { formatNumber } = useTranslation();
  return <View style={styles.miniStat}><View style={[styles.miniDot, { backgroundColor: tone }]} /><Text style={styles.miniValue}>{formatNumber(value)}</Text><Text numberOfLines={1} style={styles.miniLabel}>{label}</Text></View>;
}

function SubjectDetail({ catalog, subject, onBack, onTrain }: { catalog: PublishedExamCatalog; subject: SubjectSummary; onBack: () => void; onTrain: () => void }) {
  const { t, formatNumber } = useTranslation();
  const risky = subject.counts.at_risk + subject.counts.critical;
  return <FlatList style={styles.base} contentContainerStyle={styles.scroll} data={subject.skills} keyExtractor={(skill) => skill.code} initialNumToRender={14} maxToRenderPerBatch={12} windowSize={7} removeClippedSubviews renderItem={({ item, index }) => <SkillItem skill={item} index={index} />} ListHeaderComponent={<View style={styles.screenHeader}><Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Feather name="arrow-left" size={16} color={colors.signal} /><Text style={styles.backText}>{catalog.programName} {catalog.stage}</Text></Pressable><Text style={styles.eyebrow}>{t('officialPrep.subject')}</Text><Text style={styles.title}>{subject.name}</Text><Text style={styles.lead}>{t('officialPrep.subjectCountSummary', { total: formatNumber(subject.skills.length), risk: formatNumber(risky) })}</Text>{risky > 0 && <PrimaryButton label={t('officialPrep.trainWeakPoints')} meta={t('officialPrep.trainMeta')} onPress={onTrain} />}</View>} />;
}

function SkillItem({ skill, index }: { skill: AssessedSkill; index: number }) {
  const { t, formatNumber } = useTranslation();
  const tone = skill.state === 'mastered' ? colors.mastered : skill.state === 'learning' ? colors.recovering : skill.state === 'not_assessed' ? colors.faint : colors.risk;
  return <View style={styles.skillItem}><Text style={styles.skillIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.grow}><Text style={styles.skillName}>{skill.name}</Text><Text style={[styles.skillState, { color: tone }]}>{t(`officialPrep.state.${skill.state}` as Parameters<typeof t>[0])}</Text></View>{skill.mistakeCount > 0 && <Text style={styles.skillEvidence}>{formatNumber(skill.mistakeCount)}</Text>}</View>;
}

function PrepLoading() {
  const { t } = useTranslation();
  return <View style={styles.centerState}><View style={styles.loadingMark}><ActivityIndicator color={colors.signal} /></View><Text style={styles.stateTitle}>{t('officialPrep.loading')}</Text><Text style={styles.stateBody}>{t('officialPrep.loadingBody')}</Text></View>;
}

function PrepError({ onRetry }: { onRetry: () => Promise<void> }) {
  const { t } = useTranslation();
  return <View style={styles.centerState}><View style={styles.errorMark}><Feather name="wifi-off" size={22} color={colors.risk} /></View><Text style={styles.stateTitle}>{t('officialPrep.errorTitle')}</Text><Text style={styles.stateBody}>{t('officialPrep.errorBody')}</Text><Pressable accessibilityRole="button" onPress={() => void onRetry()} style={styles.retry}><Text style={styles.retryText}>{t('common.tryAgain')}</Text></Pressable></View>;
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  base: { flex: 1, backgroundColor: colors.canvas }, scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 116 }, screen: { width: '100%', maxWidth: 720, alignSelf: 'center' }, screenHeader: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: spacing.xl }, brand: { marginBottom: spacing.xxl }, grow: { flex: 1 }, pressed: { opacity: 0.7 },
  eyebrow: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase' }, title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 38, lineHeight: 41, letterSpacing: -1.7, marginTop: spacing.xs }, lead: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, maxWidth: 540 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.xl, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }, noticeText: { flex: 1, color: colors.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16 },
  selectionError: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.riskWash }, selectionErrorText: { flex: 1, color: colors.risk, fontFamily: type.semibold, fontSize: 11 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.darkLine, backgroundColor: colors.nav }, resumeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }, resumeLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.8 }, resumeTitle: { color: colors.onDark, fontFamily: type.bold, fontSize: 14, marginTop: 3 },
  programGroup: { marginTop: spacing.xxl }, groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm }, groupTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 20 }, groupInstitution: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.8 }, programList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }, programRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }, programRowLast: { borderBottomWidth: 0 }, programSignal: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lineStrong }, programSignalAvailable: { backgroundColor: colors.signal }, programName: { color: colors.ink, fontFamily: type.bold, fontSize: 15 }, programMeta: { color: colors.faint, fontFamily: type.mono, fontSize: 7, letterSpacing: 0.6, marginTop: 3, textTransform: 'uppercase' },
  back: { alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }, backText: { color: colors.signal, fontFamily: type.bold, fontSize: 11 },
  metrics: { marginTop: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, overflow: 'hidden' }, metricPrimary: { padding: spacing.lg }, metricSecondary: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line }, metricLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 }, metricValue: { color: colors.ink, fontFamily: type.extraBold, fontSize: 58, lineHeight: 62, letterSpacing: -3, marginTop: spacing.xs }, metricUnit: { color: colors.signal, fontSize: 26 }, readinessValue: { color: colors.ink, fontFamily: type.extraBold, fontSize: 34, marginTop: spacing.xs }, insufficient: { color: colors.ink, fontFamily: type.extraBold, fontSize: 20, lineHeight: 25, marginVertical: spacing.sm }, metricHelp: { color: colors.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16 },
  attentionLine: { minHeight: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, paddingHorizontal: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }, attentionNumber: { color: colors.ink, fontFamily: type.extraBold, fontSize: 25 }, attentionLabel: { color: colors.muted, fontFamily: type.regular, fontSize: 11 },
  subjectSection: { marginTop: spacing.xxl }, sectionTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 23 }, sectionLead: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: spacing.xs, marginBottom: spacing.md }, subjectCard: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }, subjectHead: { flexDirection: 'row', alignItems: 'center' }, subjectName: { color: colors.ink, fontFamily: type.bold, fontSize: 16 }, subjectTotal: { color: colors.faint, fontFamily: type.mono, fontSize: 7, marginTop: 3, letterSpacing: 0.6 }, subjectStats: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.xs }, miniStat: { flex: 1, minWidth: 0 }, miniDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 5 }, miniValue: { color: colors.ink, fontFamily: type.extraBold, fontSize: 15 }, miniLabel: { color: colors.faint, fontFamily: type.regular, fontSize: 8, marginTop: 1 },
  skillItem: { width: '100%', maxWidth: 720, alignSelf: 'center', minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }, skillIndex: { width: 24, color: colors.faint, fontFamily: type.mono, fontSize: 8 }, skillName: { color: colors.ink, fontFamily: type.semibold, fontSize: 13, lineHeight: 18 }, skillState: { fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.7, marginTop: 4 }, skillEvidence: { color: colors.faint, fontFamily: type.monoBold, fontSize: 9 },
  centerState: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, loadingMark: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' }, errorMark: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.riskWash, alignItems: 'center', justifyContent: 'center' }, stateTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, marginTop: spacing.lg, textAlign: 'center' }, stateBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs, maxWidth: 360 }, retry: { minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.nav, justifyContent: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.lg }, retryText: { color: colors.onDark, fontFamily: type.bold, fontSize: 12 },
}));
