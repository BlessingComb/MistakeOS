import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { classroomDemoEnabled } from '../features';
import { classifyClassroomLoadFailure, createClassroom, createClassroomAssignment, getClassroomSkillSummary, getMyClassroomProgress, getMyClassroomRole, isMissingClassroomSchema, joinClassroom, listClassroomAssignments, listClassroomRoster, listMyClassrooms, sortClassroomAttention, type Classroom, type ClassroomAssignment, type ClassroomProgress, type ClassroomRole, type ClassroomRosterEntry, type ClassroomSkillSummary } from '../classrooms';
import type { PublishedExamCatalog } from '../examPrep';
import { useTranslation } from '../i18n';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Mode = 'list' | 'create' | 'join' | 'detail' | 'assignment';
type LoadState = 'loading' | 'ready' | 'backend_unavailable' | 'network' | 'unexpected';

export function ClassroomsScreen({ catalogs }: { catalogs: readonly PublishedExamCatalog[] }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('list');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [role, setRole] = useState<ClassroomRole | null>(null);
  const [selected, setSelected] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [summary, setSummary] = useState<ClassroomSkillSummary[]>([]);
  const [progress, setProgress] = useState<ClassroomProgress | null>(null);
  const [roster, setRoster] = useState<ClassroomRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [catalogVersionId, setCatalogVersionId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [assignmentSkill, setAssignmentSkill] = useState<ClassroomSkillSummary | null>(null);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const mountedRef = useRef(true);
  const teacherOverview = useMemo(() => summarizeTeacherOverview(summary), [summary]);

  const selectedCatalogVersionId = catalogVersionId ?? catalogs[0]?.id ?? null;

  const loadClassrooms = () => {
    setLoading(true); setLoadState('loading'); setError(null);
    void Promise.all([listMyClassrooms(), getMyClassroomRole()])
      .then(([nextClassrooms, nextRole]) => {
        if (!mountedRef.current) return;
        setClassrooms(nextClassrooms); setRole(nextRole); setLoadState('ready');
      })
      .catch((cause: unknown) => {
        if (!mountedRef.current) return;
        const classification = classifyClassroomLoadFailure(cause);
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[CLASSROOMS_LOAD]', classification);
        setLoadState(classification);
      })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  };

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    void Promise.all([listMyClassrooms(), getMyClassroomRole()])
      .then(([nextClassrooms, nextRole]) => {
        if (!active) return;
        setClassrooms(nextClassrooms); setRole(nextRole); setLoadState('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const classification = classifyClassroomLoadFailure(cause);
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[CLASSROOMS_LOAD]', classification);
        setLoadState(classification);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mountedRef.current = false; };
  }, [t]);

  const openClassroom = async (classroom: Classroom) => {
    setSelected(classroom); setMode('detail'); setLoading(true); setError(null);
    try {
      const [nextAssignments, nextSummary, nextProgress, nextRoster] = await Promise.all([
        listClassroomAssignments(classroom.id),
        classroom.role === 'teacher' ? getClassroomSkillSummary(classroom.id) : Promise.resolve([]),
        classroom.role === 'student' ? getMyClassroomProgress(classroom.id) : Promise.resolve(null),
        classroom.role === 'teacher' ? listClassroomRoster(classroom.id) : Promise.resolve([]),
      ]);
      setAssignments(nextAssignments); setSummary(sortClassroomAttention(nextSummary)); setProgress(nextProgress); setRoster(nextRoster);
    } catch (cause) {
      if (isMissingClassroomSchema(cause)) setLoadState('backend_unavailable');
      else setError(t('common.unexpectedError'));
    } finally { setLoading(false); }
  };

  const create = async () => {
    if (!selectedCatalogVersionId || name.trim().length < 2) return;
    setLoading(true); setError(null);
    try { const classroom = await createClassroom({ name, objective, catalogVersionId: selectedCatalogVersionId }); setClassrooms((items) => [classroom, ...items]); await openClassroom(classroom); }
    catch { setError(t('classrooms.createError')); setLoading(false); }
  };

  const join = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null);
    try { const classroom = await joinClassroom(code); setClassrooms((items) => items.some((item) => item.id === classroom.id) ? items : [classroom, ...items]); await openClassroom(classroom); }
    catch { setError(t('classrooms.joinError')); setLoading(false); }
  };

  const createAssignment = async () => {
    if (!selected || !assignmentSkill || !assignmentTitle.trim()) return;
    setLoading(true); setError(null);
    try {
      await createClassroomAssignment({ classroomId: selected.id, skillCode: assignmentSkill.skillCode, title: assignmentTitle });
      setMode('detail'); setAssignmentSkill(null); setAssignmentTitle('');
      setAssignments(await listClassroomAssignments(selected.id));
    } catch { setError(t('classrooms.assignmentError')); } finally { setLoading(false); }
  };

  if (loading && mode === 'list') return <ScreenShell t={t}><View accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={colors.signal} /><Text style={styles.loadingText}>{t('classrooms.loading')}</Text></View></ScreenShell>;
  if (loadState === 'backend_unavailable' && !classroomDemoEnabled) return <ScreenShell t={t}><Text style={styles.title}>{t('classrooms.unavailableTitle')}</Text><Text style={styles.body}>{t('classrooms.unavailableBody')}</Text></ScreenShell>;
  if ((loadState === 'network' || loadState === 'unexpected') && mode === 'list') return <ScreenShell t={t}><View style={styles.empty}><Feather name={loadState === 'network' ? 'wifi-off' : 'alert-circle'} size={29} color={loadState === 'network' ? colors.signal : colors.risk} /><Text accessibilityRole="alert" style={styles.emptyTitle}>{t(loadState === 'network' ? 'classrooms.networkTitle' : 'classrooms.loadErrorTitle')}</Text><Text style={styles.body}>{t(loadState === 'network' ? 'classrooms.networkBody' : 'classrooms.loadErrorBody')}</Text><Pressable accessibilityRole="button" onPress={() => { loadClassrooms(); }} style={styles.retry}><Text style={styles.retryText}>{t('common.tryAgain')}</Text></Pressable></View></ScreenShell>;

  return <ScreenShell t={t} back={mode !== 'list'} onBack={() => { setMode('list'); setSelected(null); setError(null); }}>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {classroomDemoEnabled && <Text style={styles.demo}>{t('classrooms.demo')}</Text>}
    {mode === 'list' && <>
      <Text style={styles.title}>{t('classrooms.title')}</Text><Text style={styles.body}>{t('classrooms.body')}</Text>
      {classrooms.length === 0 ? <View style={styles.empty}><Feather name="users" size={29} color={colors.signal} /><Text style={styles.emptyTitle}>{t('classrooms.emptyTitle')}</Text><Text style={styles.body}>{t('classrooms.emptyBody')}</Text></View> : classrooms.map((classroom) => <Pressable key={classroom.id} accessibilityRole="button" onPress={() => void openClassroom(classroom)} style={styles.classroomCard}><View style={styles.grow}><Text style={styles.classroomName}>{classroom.name}</Text><Text style={styles.cardMeta}>{classroom.catalogLabel}</Text></View><Feather name="arrow-up-right" size={18} color={colors.signal} /></Pressable>)}
      <View style={styles.actions}><PrimaryButton label={t('classrooms.join')} onPress={() => setMode('join')} />{role === 'teacher' && <Pressable accessibilityRole="button" onPress={() => setMode('create')} style={styles.secondary}><Text style={styles.secondaryText}>{t('classrooms.create')}</Text></Pressable>}</View>
    </>}
    {mode === 'join' && <><Text style={styles.title}>{t('classrooms.joinTitle')}</Text><Text style={styles.body}>{t('classrooms.joinBody')}</Text><Field label={t('classrooms.code')}><TextInput autoCapitalize="characters" value={code} onChangeText={setCode} placeholder="ABC-1234" placeholderTextColor={colors.muted} style={styles.input} /></Field><PrimaryButton label={t('classrooms.join')} onPress={() => void join()} /></>}
    {mode === 'create' && <><Text style={styles.title}>{t('classrooms.createTitle')}</Text><Text style={styles.body}>{t('classrooms.createBody')}</Text><Field label={t('classrooms.name')}><TextInput value={name} onChangeText={setName} placeholder={t('classrooms.namePlaceholder')} placeholderTextColor={colors.muted} style={styles.input} /></Field><Field label={t('classrooms.objective')}><TextInput value={objective} onChangeText={setObjective} placeholder={t('classrooms.objectivePlaceholder')} placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline]} /></Field><Text style={styles.label}>{t('classrooms.catalog')}</Text>{catalogs.length === 0 ? <Text style={styles.body}>{t('classrooms.catalogEmpty')}</Text> : catalogs.map((catalog) => <Pressable key={catalog.id} onPress={() => setCatalogVersionId(catalog.id)} style={[styles.catalog, selectedCatalogVersionId === catalog.id && styles.catalogSelected]}><Text style={styles.catalogName}>{catalog.programName} {catalog.stage}</Text><Text style={styles.cardMeta}>{catalog.institution}</Text></Pressable>)}<PrimaryButton label={t('classrooms.create')} onPress={() => void create()} /></>}
    {mode === 'detail' && selected && <>
      <Text style={styles.title}>{selected.name}</Text><Text style={styles.body}>{selected.objective || selected.catalogLabel}</Text>
      <View style={styles.info}><Text style={styles.infoLabel}>{t('classrooms.teacher')}</Text><Text style={styles.infoValue}>{selected.teacherName}</Text><Text style={styles.infoLabel}>{t('classrooms.target')}</Text><Text style={styles.infoValue}>{selected.catalogLabel}</Text>{selected.inviteCode && <><Text style={styles.infoLabel}>{t('classrooms.code')}</Text><Text style={styles.code}>{selected.inviteCode}</Text></>}</View>
      <Text style={styles.section}>{t('classrooms.activities')}</Text>
      {assignments.length === 0 ? <Text style={styles.body}>{t('classrooms.noActivities')}</Text> : assignments.map((assignment) => <View key={assignment.id} style={styles.assignment}><Text style={styles.assignmentTitle}>{assignment.title}</Text><Text style={styles.cardMeta}>{assignment.skillName}</Text></View>)}
      {selected.role === 'student' && progress && <><Text style={styles.section}>{t('classrooms.myProgress')}</Text><Text style={styles.body}>{t('classrooms.progressSummary', { coverage: progress.coveragePercent, count: progress.masteredCount })}</Text></>}
      {selected.role === 'teacher' && <>
        <Text style={styles.section}>{t('classrooms.overview')}</Text><View style={styles.overviewGrid}><OverviewMetric value={String(roster.length)} label={t('classrooms.students')} tone={colors.signal} /><OverviewMetric value={`${teacherOverview.coverage}%`} label={t('classrooms.coverage')} tone={colors.violet} /><OverviewMetric value={String(teacherOverview.riskSkills)} label={t('classrooms.criticalSkills')} tone={colors.risk} /></View>
        <Text style={styles.section}>{t('classrooms.students')}</Text><Text style={styles.body}>{t('classrooms.studentCount', { count: roster.length })}</Text>{roster.slice(0, 8).map((student) => <Text key={student.userId} style={styles.rosterName}>{student.displayName}</Text>)}<Text style={styles.privacyNote}>{t('classrooms.studentPrivacy')}</Text>
        <Text style={styles.section}>{t('classrooms.attention')}</Text>
        {summary.length === 0 ? <Text style={styles.body}>{t('classrooms.noAttention')}</Text> : summary.slice(0, 5).map((skill) => <Pressable key={skill.skillCode} onPress={() => { setAssignmentSkill(skill); setAssignmentTitle(t('classrooms.assignmentDefaultTitle', { skill: skill.skillName })); setMode('assignment'); }} style={styles.skill}><View style={styles.grow}><Text style={styles.assignmentTitle}>{skill.skillName}</Text><Text style={styles.cardMeta}>{skill.subjectName}</Text></View><Text style={styles.risk}>{t('classrooms.atRisk', { count: skill.atRiskCount })}</Text></Pressable>)}
        {teacherOverview.subjects.length > 0 && <><Text style={styles.section}>{t('classrooms.bySubject')}</Text>{teacherOverview.subjects.map((subject) => <View key={subject.name} style={styles.subjectSummary}><Text style={styles.assignmentTitle}>{subject.name}</Text><Text style={styles.cardMeta}>{t('classrooms.subjectSummary', { risk: subject.risk, learning: subject.learning, mastered: subject.mastered })}</Text></View>)}</>}
        {summary.length > 0 && <Pressable onPress={() => { const skill = summary[0]!; setAssignmentSkill(skill); setAssignmentTitle(t('classrooms.assignmentDefaultTitle', { skill: skill.skillName })); setMode('assignment'); }} style={styles.secondary}><Text style={styles.secondaryText}>{t('classrooms.newAssignment')}</Text></Pressable>}
      </>}
    </>}
    {mode === 'assignment' && assignmentSkill && <><Text style={styles.title}>{t('classrooms.newAssignment')}</Text><Text style={styles.body}>{assignmentSkill.skillName}</Text><Field label={t('classrooms.assignmentTitle')}><TextInput value={assignmentTitle} onChangeText={setAssignmentTitle} placeholder={t('classrooms.assignmentTitlePlaceholder')} placeholderTextColor={colors.muted} style={styles.input} /></Field><PrimaryButton label={t('classrooms.newAssignment')} onPress={() => void createAssignment()} /></>}
  </ScreenShell>;
}

function ScreenShell({ t, back = false, onBack, children }: { t: ReturnType<typeof useTranslation>['t']; back?: boolean; onBack?: () => void; children: ReactNode }) {
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.screen}><View style={styles.header}><Text style={styles.overline}>{t('classrooms.overline')}</Text>{back && <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Feather name="arrow-left" size={17} color={colors.ink} /><Text style={styles.backText}>{t('common.back')}</Text></Pressable>}</View>{children}</View></ScrollView>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }

function OverviewMetric({ value, label, tone }: { value: string; label: string; tone: string }) { return <View style={styles.overviewMetric}><Text style={[styles.overviewValue, { color: tone }]}>{value}</Text><Text style={styles.overviewLabel}>{label}</Text></View>; }

function summarizeTeacherOverview(summary: readonly ClassroomSkillSummary[]) {
  const totals = summary.reduce((result, skill) => ({ atRisk: result.atRisk + skill.atRiskCount, learning: result.learning + skill.learningCount, mastered: result.mastered + skill.masteredCount, notAssessed: result.notAssessed + skill.notAssessedCount }), { atRisk: 0, learning: 0, mastered: 0, notAssessed: 0 });
  const total = totals.atRisk + totals.learning + totals.mastered + totals.notAssessed;
  const subjects = new Map<string, { name: string; risk: number; learning: number; mastered: number }>();
  summary.forEach((skill) => { const subject = subjects.get(skill.subjectName) ?? { name: skill.subjectName, risk: 0, learning: 0, mastered: 0 }; subject.risk += skill.atRiskCount; subject.learning += skill.learningCount; subject.mastered += skill.masteredCount; subjects.set(skill.subjectName, subject); });
  return { coverage: total ? Math.round(((totals.atRisk + totals.learning + totals.mastered) / total) * 100) : 0, riskSkills: summary.filter((skill) => skill.atRiskCount > 0).length, subjects: [...subjects.values()].sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name)) };
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { paddingBottom: 112 }, loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: spacing.md }, loadingText: { color: colors.muted, fontFamily: type.regular, fontSize: 13 }, screen: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: spacing.lg, gap: spacing.md }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, overline: { color: colors.signal, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1 }, back: { flexDirection: 'row', gap: 6, alignItems: 'center' }, backText: { color: colors.ink, fontFamily: type.bold, fontSize: 13 }, title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 36, lineHeight: 40, letterSpacing: -1.4 }, body: { color: colors.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 22 }, error: { color: colors.risk, fontFamily: type.regular, fontSize: 13 }, demo: { color: colors.signal, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.violetWash }, empty: { minHeight: 220, padding: spacing.xl, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', gap: spacing.md }, emptyTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 20 }, retry: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.signal, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' }, retryText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 13 }, classroomCard: { minHeight: 74, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, classroomName: { color: colors.ink, fontFamily: type.bold, fontSize: 16 }, cardMeta: { color: colors.muted, fontFamily: type.regular, fontSize: 12, marginTop: 3 }, actions: { gap: spacing.sm }, secondary: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md }, secondaryText: { color: colors.signal, fontFamily: type.bold, fontSize: 13 }, field: { gap: 7 }, label: { color: colors.ink, fontFamily: type.bold, fontSize: 13 }, input: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontFamily: type.regular, fontSize: 15 }, multiline: { minHeight: 88, paddingTop: spacing.sm, textAlignVertical: 'top' }, catalog: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, catalogSelected: { borderColor: colors.signal, backgroundColor: colors.violetWash }, catalogName: { color: colors.ink, fontFamily: type.bold, fontSize: 14 }, info: { gap: 4, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, infoLabel: { color: colors.muted, fontFamily: type.monoBold, fontSize: 8, letterSpacing: .8, marginTop: spacing.xs }, infoValue: { color: colors.ink, fontFamily: type.semibold, fontSize: 14 }, code: { color: colors.signal, fontFamily: type.extraBold, fontSize: 23, letterSpacing: 2 }, section: { color: colors.ink, fontFamily: type.bold, fontSize: 20, marginTop: spacing.sm }, overviewGrid: { flexDirection: 'row', gap: spacing.sm }, overviewMetric: { flex: 1, minHeight: 78, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, overviewValue: { fontFamily: type.extraBold, fontSize: 21 }, overviewLabel: { color: colors.muted, fontFamily: type.regular, fontSize: 9, marginTop: 3 }, assignment: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, assignmentTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 14 }, rosterName: { color: colors.ink, fontFamily: type.regular, fontSize: 14 }, privacyNote: { color: colors.faint, fontFamily: type.regular, fontSize: 10, lineHeight: 15 }, subjectSummary: { paddingVertical: spacing.sm, borderTopWidth: 1, borderColor: colors.line }, skill: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, risk: { color: colors.risk, fontFamily: type.bold, fontSize: 12 }, grow: { flex: 1 },
}));
