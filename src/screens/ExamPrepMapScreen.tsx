import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { trackEvent } from '../analytics';
import { PrimaryButton } from '../components/PrimaryButton';
import type { ExamRecord } from '../exams';
import { useTranslation } from '../i18n';
import type { MistakeRecord } from '../mistakes';
import { riskLabelKey, subjectLabelKey, type SubjectId } from '../onboarding';
import { buildExamPrepMap, upcomingExam, type PrepMapItem, type ReviewEvidence } from '../prepMap';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';
import { motion, useReducedMotionPreference } from '../motion';

type Props = {
  exams: readonly ExamRecord[];
  mistakes: readonly MistakeRecord[];
  reviewEvidence: ReviewEvidence;
  onOpenExams: () => void;
  onAddMistake: () => void;
  onStartReview: (subject: SubjectId) => void;
};

export function ExamPrepMapScreen({ exams, mistakes, reviewEvidence, onOpenExams, onAddMistake, onStartReview }: Props) {
  const { t, formatDate, formatNumber } = useTranslation();
  const exam = useMemo(() => upcomingExam(exams), [exams]);
  const prepMap = useMemo(() => exam ? buildExamPrepMap(exam, mistakes, reviewEvidence) : null, [exam, mistakes, reviewEvidence]);

  useEffect(() => {
    if (prepMap) trackEvent('exam_prep_map_opened', { examSubject: prepMap.exam.subject, priorityCount: prepMap.items.length });
  }, [prepMap]);

  if (!exam || !prepMap) return <NoExamState onOpenExams={onOpenExams} />;

  const days = daysUntil(exam.date);
  const allMastered = prepMap.items.length > 0 && prepMap.items.every((item) => item.state === 'MASTERED');
  const startItem = (item: PrepMapItem) => {
    trackEvent('exam_prep_map_item_started', { subject: item.subject, cause: item.cause ?? 'uncertain', riskScore: item.riskScore });
    onStartReview(item.subject);
  };

  return (
    <ScrollView style={styles.base} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.screen}>
        <Text style={styles.overline}>{t('prepMap.overline')}</Text>
        <Text style={styles.title}>{t('prepMap.title')}</Text>
        <View style={styles.examIdentity}>
          <View style={styles.examIcon}><Feather name="calendar" size={18} color={colors.onAccent} /></View>
          <View style={styles.examCopy}><Text style={styles.examSubject}>{t(subjectLabelKey(exam.subject))}</Text><Text style={styles.examDate}>{formatDate(new Date(`${exam.date}T12:00:00`), { month: 'long', day: 'numeric' })} · {t(days === 0 ? 'prepMap.today' : days === 1 ? 'prepMap.oneDayLeft' : 'prepMap.daysLeft', { count: formatNumber(days) })}</Text></View>
        </View>
        <Text style={styles.lead}>{t('prepMap.lead')}</Text>

        {prepMap.items.length === 0 ? <LearningState onAddMistake={onAddMistake} /> : <>
          <ReadinessSummary readiness={prepMap.readiness} points={prepMap.pointsAtRisk} minutes={prepMap.estimatedMinutes} />
          {allMastered ? <ReadyState itemCount={prepMap.items.length} /> : <PreparationPath items={prepMap.items} onStart={startItem} />}
          {prepMap.personalRules.length > 0 && <PersonalRules rules={prepMap.personalRules} />}
        </>}
      </View>
    </ScrollView>
  );
}

function NoExamState({ onOpenExams }: { onOpenExams: () => void }) {
  const { t } = useTranslation();
  return <ScrollView style={styles.base} contentContainerStyle={styles.scroll}><View style={styles.screen}><Text style={styles.overline}>{t('prepMap.overline')}</Text><Text style={styles.title}>{t('prepMap.title')}</Text><View style={styles.empty}><View style={styles.emptyIcon}><Feather name="calendar" size={25} color={colors.signal} /></View><Text style={styles.emptyTitle}>{t('prepMap.noExamTitle')}</Text><Text style={styles.emptyBody}>{t('prepMap.noExamBody')}</Text><PrimaryButton label={t('prepMap.addExam')} meta={t('prepMap.addExamMeta')} onPress={onOpenExams} /></View></View></ScrollView>;
}

function LearningState({ onAddMistake }: { onAddMistake: () => void }) {
  const { t } = useTranslation();
  return <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="activity" size={25} color={colors.signal} /></View><Text style={styles.emptyTitle}>{t('prepMap.learningTitle')}</Text><Text style={styles.emptyBody}>{t('prepMap.learningBody')}</Text><PrimaryButton label={t('prepMap.addMistake')} meta={t('prepMap.addMistakeMeta')} onPress={onAddMistake} /></View>;
}

function ReadinessSummary({ readiness, points, minutes }: { readiness: number; points: number; minutes: number }) {
  const { t, formatNumber } = useTranslation();
  return <View style={styles.summary}><View style={styles.summaryCore}><Text style={styles.summaryLabel}>{t('prepMap.readiness')}</Text><Text style={styles.readiness}>{formatNumber(readiness)}<Text style={styles.percent}>%</Text></Text><Text style={styles.summaryHint}>{t('prepMap.preparationIndicator')}</Text></View><View style={styles.summaryStats}><Stat label={t('prepMap.pointsAtRisk')} value={formatNumber(points)} tone="risk" /><Stat label={t('prepMap.estimatedTime')} value={t('prepMap.minutes', { count: formatNumber(minutes) })} tone="signal" /></View></View>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'risk' | 'signal' }) { return <View style={styles.stat}><Text style={[styles.statLabel, { color: colors[tone] }]}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }

function PreparationPath({ items, onStart }: { items: PrepMapItem[]; onStart: (item: PrepMapItem) => void }) {
  const { t, formatNumber } = useTranslation();
  const reducedMotion = useReducedMotionPreference();
  const layout = LinearTransition.duration(motion.duration.normal).reduceMotion(ReduceMotion.System);
  return <View style={styles.pathSection}><View style={styles.sectionHead}><Text style={styles.sectionKicker}>{t('prepMap.areasToFix')}</Text><Text style={styles.sectionCount}>{t(items.length === 1 ? 'prepMap.onePriority' : 'prepMap.priorities', { count: formatNumber(items.length) })}</Text></View><Reanimated.View layout={reducedMotion ? undefined : layout} style={styles.path}>{items.map((item, index) => <PrepItem key={item.id} item={item} index={index} last={index === items.length - 1} onStart={onStart} />)}</Reanimated.View></View>;
}

function PrepItem({ item, index, last, onStart }: { item: PrepMapItem; index: number; last: boolean; onStart: (item: PrepMapItem) => void }) {
  const { t, formatNumber } = useTranslation();
  const tone = item.state === 'HIGH RISK' ? colors.risk : item.state === 'RECOVERING' ? colors.recovering : colors.mastered;
  const cta = item.state === 'HIGH RISK' ? t('prepMap.startNeverAgain') : item.state === 'RECOVERING' ? t('prepMap.continueRecovery') : t('prepMap.reviewAgain');
  return <View style={styles.pathItem}><View style={styles.pathMarker}><View style={[styles.pathNode, { borderColor: tone }]}><View style={[styles.pathNodeCore, { backgroundColor: tone }]} /></View>{!last && <View style={styles.pathLine} />}</View><View style={styles.itemBody}><View style={styles.itemTop}><Text style={styles.itemNumber}>{String(index + 1).padStart(2, '0')}</Text><Text style={[styles.itemState, { color: tone }]}>{t(item.state === 'HIGH RISK' ? 'status.highRisk' : item.state === 'RECOVERING' ? 'status.recovering' : 'status.mastered')}</Text></View><Text style={styles.itemTitle}>{item.topic ?? t(riskLabelKey(item.cause ?? 'uncertain'))}</Text>{item.topic && <Text style={styles.itemCause}>{t(riskLabelKey(item.cause ?? 'uncertain'))}</Text>}<Text style={styles.itemMeta}>{t('prepMap.riskScore', { score: formatNumber(item.riskScore) })} · {t(item.mistakes.length === 1 ? 'prepMap.oneMistake' : 'prepMap.mistakes', { count: formatNumber(item.mistakes.length) })} · {t('prepMap.recoveryTime', { count: formatNumber(item.estimatedMinutes) })}</Text><Pressable accessibilityRole="button" onPress={() => onStart(item)} style={({ pressed }) => [styles.itemCta, pressed && styles.pressed]}><Text style={styles.itemCtaText}>{cta}</Text><Feather name="arrow-up-right" size={16} color={colors.onAccent} /></Pressable></View></View>;
}

function PersonalRules({ rules }: { rules: string[] }) {
  const { t } = useTranslation();
  return <View style={styles.rules}><Text style={styles.rulesKicker}>{t('prepMap.personalRules')}</Text><Text style={styles.rulesTitle}>{t('prepMap.rulesTitle')}</Text><Text style={styles.rulesBody}>{t('prepMap.rulesBody')}</Text>{rules.map((rule, index) => <View key={`${index}-${rule}`} style={styles.rule}><Text style={styles.ruleIndex}>{String(index + 1).padStart(2, '0')}</Text><Text style={styles.ruleText}>{rule}</Text></View>)}</View>;
}

function ReadyState({ itemCount }: { itemCount: number }) {
  const { t, formatNumber } = useTranslation();
  return <View style={styles.ready}><View style={styles.readyIcon}><Feather name="check" size={23} color={colors.onAccent} /></View><Text style={styles.readyTitle}>{t('prepMap.readyTitle')}</Text><Text style={styles.readyBody}>{t('prepMap.readyBody', { count: formatNumber(itemCount) })}</Text></View>;
}

function daysUntil(date: string) { const today = new Date(); today.setHours(0, 0, 0, 0); return Math.max(0, Math.ceil((new Date(`${date}T12:00:00`).getTime() - today.getTime()) / 86_400_000)); }

const styles = createThemedStyles((colors) => StyleSheet.create({
  base: { flex: 1, backgroundColor: colors.canvas }, scroll: { paddingBottom: 116 }, screen: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  overline: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.2 }, title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 39, lineHeight: 42, letterSpacing: -1.7, marginTop: spacing.sm }, lead: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.lg, maxWidth: 490 },
  examIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }, examIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }, examCopy: { flex: 1 }, examSubject: { color: colors.ink, fontFamily: type.bold, fontSize: 16 }, examDate: { color: colors.faint, fontFamily: type.mono, fontSize: 8, letterSpacing: 0.5, marginTop: 3, textTransform: 'capitalize' },
  summary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xl }, summaryCore: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.md }, summaryLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1 }, readiness: { color: colors.ink, fontFamily: type.extraBold, fontSize: 64, lineHeight: 68, letterSpacing: -4, marginTop: 3 }, percent: { color: colors.signal, fontSize: 28, letterSpacing: -1 }, summaryHint: { color: colors.muted, fontFamily: type.regular, fontSize: 11 }, summaryStats: { flexDirection: 'row', paddingTop: spacing.md, gap: spacing.md }, stat: { flex: 1 }, statLabel: { fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.7 }, statValue: { color: colors.ink, fontFamily: type.extraBold, fontSize: 19, marginTop: 4 },
  pathSection: { marginTop: spacing.xxl }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }, sectionKicker: { color: colors.ink, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1 }, sectionCount: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.7 }, path: { paddingTop: spacing.md }, pathItem: { flexDirection: 'row', minHeight: 166 }, pathMarker: { width: 30, alignItems: 'center' }, pathNode: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }, pathNodeCore: { width: 6, height: 6, borderRadius: 3 }, pathLine: { width: 1, flex: 1, backgroundColor: colors.lineStrong }, itemBody: { flex: 1, paddingBottom: spacing.lg, paddingLeft: spacing.sm }, itemTop: { flexDirection: 'row', justifyContent: 'space-between' }, itemNumber: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.8 }, itemState: { fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.8 }, itemTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 18, marginTop: spacing.xs }, itemMeta: { color: colors.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17, marginTop: 4 }, itemCta: { minHeight: 38, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.nav, borderRadius: radius.pill, paddingHorizontal: spacing.md, marginTop: spacing.md }, itemCtaText: { color: colors.onDark, fontFamily: type.bold, fontSize: 11 },
  itemCause: { color: colors.signal, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.7, marginTop: 4 },
  rules: { marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.violetWash, borderWidth: 1, borderColor: colors.line, padding: spacing.lg }, rulesKicker: { color: colors.violet, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 }, rulesTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, letterSpacing: -0.8, marginTop: spacing.sm }, rulesBody: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: spacing.sm }, rule: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line }, ruleIndex: { color: colors.violet, fontFamily: type.monoBold, fontSize: 8, width: 22 }, ruleText: { color: colors.ink, fontFamily: type.semibold, fontSize: 12, lineHeight: 18, flex: 1 },
  empty: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.lg, marginTop: spacing.xl }, emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, marginTop: spacing.lg }, emptyBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: spacing.xs, marginBottom: spacing.lg }, ready: { alignItems: 'center', padding: spacing.xxl, borderRadius: radius.xl, backgroundColor: colors.masteredWash, marginTop: spacing.xl }, readyIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.mastered, alignItems: 'center', justifyContent: 'center' }, readyTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 26, marginTop: spacing.md }, readyBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs }, pressed: { opacity: 0.72 },
}));
