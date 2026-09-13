import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { listClassroomAssignments, listMyClassrooms, type Classroom, type ClassroomAssignment } from '../classrooms';
import { PrimaryButton } from '../components/PrimaryButton';
import { buildOfficialExamReadiness, type OfficialExamPrepData } from '../examPrep';
import { useTranslation } from '../i18n';
import { colors, createThemedStyles, radius, shadow, spacing, type } from '../theme';
import { buildHomeDashboard, daysUntil } from './homeDashboard';

type Props = {
  officialExamPrep: OfficialExamPrepData;
  onLogMistake: () => void;
  onDna: () => void;
  onOpenPrepMap: () => void;
  onOpenExams: () => void;
  onOpenClassrooms: () => void;
  onOpenReview: () => void;
};

type ClassroomActivity = { classroom: Classroom; assignment: ClassroomAssignment };

export function HomeScreen({ officialExamPrep, onLogMistake, onDna, onOpenPrepMap, onOpenExams, onOpenClassrooms, onOpenReview }: Props) {
  const { t, formatNumber } = useTranslation();
  const { account } = useAuth();
  const [activity, setActivity] = useState<ClassroomActivity | null>(null);
  const readiness = useMemo(() => buildOfficialExamReadiness(officialExamPrep.catalogSkills, officialExamPrep.mistakes, officialExamPrep.links, officialExamPrep.recoveries), [officialExamPrep]);
  const dashboard = useMemo(() => buildHomeDashboard(officialExamPrep, readiness), [officialExamPrep, readiness]);
  const remainingDays = daysUntil(officialExamPrep.target?.targetDate);
  const greetingName = account?.email?.split('@')[0]?.split(/[._-]/)[0] ?? null;

  useEffect(() => {
    let active = true;
    void listMyClassrooms().then(async (classrooms) => {
      const classroom = classrooms[0];
      if (!classroom) return null;
      const assignments = await listClassroomAssignments(classroom.id);
      return assignments[0] ? { classroom, assignment: assignments[0] } : null;
    }).then((nextActivity) => { if (active) setActivity(nextActivity); }).catch(() => { if (active) setActivity(null); });
    return () => { active = false; };
  }, []);

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
    <View style={styles.screen}>
      <View style={styles.greeting}><View><Text style={styles.hello}>{greetingName ? t('home.greeting', { name: titleCase(greetingName) }) : t('home.greetingAnonymous')}</Text><Text style={styles.greetingBody}>{t('home.greetingBody')}</Text></View><View style={styles.avatar}><Feather name="sun" size={20} color={colors.signal} /></View></View>

      {dashboard.target.kind === 'target' ? <View style={[styles.hero, shadow]}>
        <View style={styles.heroTop}><View style={styles.grow}><Text style={styles.overline}>{t('home.nextTarget')}</Text><Text style={styles.heroTitle}>{dashboard.target.catalog.programName} {dashboard.target.catalog.stage}</Text><Text style={styles.heroMeta}>{dashboard.target.catalog.institution}</Text></View><View style={styles.examIcon}><Feather name="bookmark" size={19} color={colors.onAccent} /></View></View>
        <View style={styles.heroStats}><Stat label={remainingDays === null ? t('home.examTarget') : t('home.daysLeft')} value={remainingDays === null ? dashboard.target.catalog.cycle : formatNumber(remainingDays)} tone={colors.signal} /><Stat label={t('officialPrep.coverage')} value={`${formatNumber(Math.round(dashboard.target.coverage * 100))}%`} tone={colors.violet} /><Stat label={t('home.attentionShort')} value={formatNumber(dashboard.target.attentionCount)} tone={dashboard.target.attentionCount ? colors.risk : colors.mastered} /></View>
        {dashboard.target.readiness !== null && <Text style={styles.readiness}>{t('home.readinessValue', { value: formatNumber(dashboard.target.readiness) })}</Text>}
        <PrimaryButton label={t('home.continuePrep')} onPress={onOpenPrepMap} />
      </View> : <View style={[styles.noTarget, shadow]}><View style={styles.targetIcon}><Feather name="compass" size={23} color={colors.signal} /></View><View style={styles.grow}><Text style={styles.noTargetTitle}>{t('home.noTargetTitle')}</Text><Text style={styles.noTargetBody}>{t('home.noTargetBody')}</Text></View><Pressable accessibilityRole="button" onPress={onOpenPrepMap} style={styles.miniAction}><Feather name="arrow-right" size={18} color={colors.onAccent} /></Pressable></View>}

      <Section title={t('home.todayReview')} icon="zap">
        {dashboard.focus ? <View style={styles.focusCard}><View style={styles.focusIcon}><Feather name="alert-triangle" size={19} color={colors.risk} /></View><View style={styles.grow}><Text style={styles.focusTitle}>{dashboard.focus.name}</Text><Text style={styles.focusBody}>{t('home.focusBody')}</Text></View><Pressable accessibilityRole="button" onPress={onOpenPrepMap} style={styles.textAction}><Text style={styles.textActionLabel}>{t('home.trainNow')}</Text><Feather name="arrow-up-right" size={16} color={colors.signal} /></Pressable></View> : <EmptyLine icon="book-open" text={t('home.noFocus')} action={t('home.logMistake')} onPress={onLogMistake} />}
      </Section>

      {dashboard.target.kind === 'target' && <Section title={t('home.academicProgress')} icon="bar-chart-2"><View style={styles.progressGrid}><ProgressChip label={t('officialPrep.mastered')} value={dashboard.counts.mastered} tone={colors.mastered} /><ProgressChip label={t('officialPrep.learning')} value={dashboard.counts.learning} tone={colors.recovering} /><ProgressChip label={t('officialPrep.atRisk')} value={dashboard.counts.atRisk} tone={colors.risk} /><ProgressChip label={t('officialPrep.notAssessed')} value={dashboard.counts.notAssessed} tone={colors.faint} /></View></Section>}

      {activity && <Section title={t('home.classActivity')} icon="users"><Pressable accessibilityRole="button" onPress={onOpenClassrooms} style={styles.activityCard}><View style={styles.activityIcon}><Feather name="clipboard" size={18} color={colors.signal} /></View><View style={styles.grow}><Text style={styles.activityClass}>{activity.classroom.name}</Text><Text style={styles.activityTitle}>{activity.assignment.title}</Text><Text style={styles.activityMeta}>{activity.assignment.skillName}</Text></View><Feather name="chevron-right" size={20} color={colors.signal} /></Pressable></Section>}

      <Section title={t('home.quickAccess')} icon="grid"><View style={styles.quickGrid}><QuickAction icon="plus-circle" label={t('home.logMistake')} onPress={onLogMistake} tone={colors.signal} /><QuickAction icon="file-text" label={t('home.myMistakes')} onPress={onOpenReview} tone={colors.risk} /><QuickAction icon="map" label={t('home.preparation')} onPress={onOpenPrepMap} tone={colors.violet} /><QuickAction icon="calendar" label={t('home.exams')} onPress={onOpenExams} tone={colors.recovering} /><QuickAction icon="users" label={t('home.classrooms')} onPress={onOpenClassrooms} tone={colors.mastered} /><QuickAction icon="aperture" label={t('home.openDna')} onPress={onDna} tone={colors.recovering} /></View></Section>
    </View>
  </ScrollView>;
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Feather.glyphMap; children: ReactNode }) { return <View style={styles.section}><View style={styles.sectionHead}><View style={styles.sectionIcon}><Feather name={icon} size={15} color={colors.signal} /></View><Text style={styles.sectionTitle}>{title}</Text></View>{children}</View>; }
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) { return <View style={styles.stat}><Text style={[styles.statValue, { color: tone }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function ProgressChip({ label, value, tone }: { label: string; value: number; tone: string }) { return <View style={styles.progressChip}><View style={[styles.dot, { backgroundColor: tone }]} /><Text style={styles.progressValue}>{value}</Text><Text numberOfLines={1} style={styles.progressLabel}>{label}</Text></View>; }
function QuickAction({ icon, label, onPress, tone }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; tone: string }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><View style={[styles.quickIcon, { backgroundColor: tone }]}><Feather name={icon} size={17} color={colors.onAccent} /></View><Text style={styles.quickLabel}>{label}</Text></Pressable>; }
function EmptyLine({ icon, text, action, onPress }: { icon: keyof typeof Feather.glyphMap; text: string; action: string; onPress: () => void }) { return <View style={styles.emptyLine}><Feather name={icon} size={19} color={colors.faint} /><Text style={styles.emptyLineText}>{text}</Text><Pressable accessibilityRole="button" onPress={onPress}><Text style={styles.emptyAction}>{action}</Text></Pressable></View>; }
function titleCase(value: string) { return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : ''; }

const styles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { paddingBottom: 116 }, screen: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.xl }, grow: { flex: 1 }, pressed: { opacity: 0.72 }, greeting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm }, hello: { color: colors.ink, fontFamily: type.extraBold, fontSize: 31, letterSpacing: -1.2 }, greetingBody: { color: colors.muted, fontFamily: type.regular, fontSize: 14, marginTop: 4 }, avatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, gap: spacing.lg }, heroTop: { flexDirection: 'row', gap: spacing.md }, overline: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.05 }, heroTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.8, marginTop: 5 }, heroMeta: { color: colors.muted, fontFamily: type.regular, fontSize: 13, marginTop: 3 }, examIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' }, heroStats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.md }, stat: { flex: 1, minWidth: 0 }, statValue: { fontFamily: type.extraBold, fontSize: 20, letterSpacing: -0.5 }, statLabel: { color: colors.muted, fontFamily: type.regular, fontSize: 10, marginTop: 2 }, readiness: { color: colors.masteredDeep, fontFamily: type.semibold, fontSize: 12, marginTop: -spacing.sm },
  noTarget: { minHeight: 126, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }, targetIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' }, noTargetTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 18 }, noTargetBody: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: 4 }, miniAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing.md }, sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, sectionIcon: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 19, letterSpacing: -0.4 }, focusCard: { minHeight: 100, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, focusIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.riskWash, alignItems: 'center', justifyContent: 'center' }, focusTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 15 }, focusBody: { color: colors.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16, marginTop: 3 }, textAction: { alignItems: 'center', gap: 3 }, textActionLabel: { color: colors.signal, fontFamily: type.bold, fontSize: 10 }, emptyLine: { minHeight: 84, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.elevated, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, emptyLineText: { flex: 1, color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 17 }, emptyAction: { color: colors.signal, fontFamily: type.bold, fontSize: 11 },
  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, progressChip: { width: '47%', minHeight: 75, padding: spacing.md, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }, dot: { width: 7, height: 7, borderRadius: 4 }, progressValue: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, marginTop: 5 }, progressLabel: { color: colors.muted, fontFamily: type.regular, fontSize: 10, marginTop: 1 },
  activityCard: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, activityIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' }, activityClass: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.7 }, activityTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 14, marginTop: 3 }, activityMeta: { color: colors.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, quick: { width: '30%', minHeight: 90, padding: spacing.sm, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, justifyContent: 'space-between' }, quickIcon: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, quickLabel: { color: colors.ink, fontFamily: type.semibold, fontSize: 10, lineHeight: 13, marginTop: spacing.sm },
}));
