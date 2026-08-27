import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeInDown, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { PrimaryButton } from '../components/PrimaryButton';
import { trackEvent } from '../analytics';
import { useTranslation } from '../i18n';
import { groupMistakesBySubject, mistakesForSubject, type MistakeRecord } from '../mistakes';
import { subjectLabelKey, type SubjectId } from '../onboarding';
import { generateRecoverySet, isRecoveryAnswerCorrect } from '../recovery';
import { motion as premiumMotion, useReducedMotionPreference } from '../motion';
import { animationDriver, colors, createThemedStyles, motion, radius, spacing, type } from '../theme';
import type { RecoveryEvidence } from '../repositories';

type Props = { mistakes: readonly MistakeRecord[]; initialSubject?: SubjectId | null; onCompleteReview: (mistakeIds: readonly string[], subject: string, recovery?: RecoveryEvidence, resisted?: boolean) => Promise<void>; onDone: () => void; onExit: () => void };
const safeHaptic = (action: Promise<void>) => action.catch(() => undefined);

export function ReviewScreen({ mistakes, initialSubject = null, onCompleteReview, onDone, onExit }: Props) {
  const { t, formatNumber } = useTranslation();
  const [subject, setSubject] = useState<SubjectId | null>(initialSubject);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [resistedCount, setResistedCount] = useState(0);
  const [answers, setAnswers] = useState<RecoveryEvidence['answers']>([]);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const reducedMotion = useReducedMotionPreference();
  const [complete, setComplete] = useState(false);
  const [enter] = useState(() => new Animated.Value(0));
  const groups = useMemo(() => groupMistakesBySubject(mistakes), [mistakes]);
  const questions = useMemo(() => subject ? mistakesForSubject(mistakes, subject) : [], [mistakes, subject]);
  const sourceMistake = questions[0];
  const recoverySet = useMemo(() => sourceMistake ? generateRecoverySet(sourceMistake) : null, [sourceMistake]);
  const question = recoverySet?.questions[questionIndex];

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: motion.standard, useNativeDriver: animationDriver }).start();
  }, [enter, questionIndex, subject]);

  const chooseSubject = (nextSubject: SubjectId) => {
    safeHaptic(Haptics.selectionAsync());
    setSubject(nextSubject);
    setQuestionIndex(0);
    setStarted(false);
    setSelectedOption(null);
    setChecked(false);
    setResistedCount(0);
    setAnswers([]);
    setStartedAt(new Date().toISOString());
  };

  const advance = () => {
    const resisted = question ? isRecoveryAnswerCorrect(question, selectedOption) : false;
    const nextResistedCount = resistedCount + Number(resisted);
    safeHaptic(Haptics.impactAsync(resisted ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light));
    trackEvent(resisted ? 'mistake_pattern_resisted' : 'mistake_pattern_repeated', { subject: subject ?? 'unknown', errorType: question?.targetErrorType ?? 'uncertain' });
    if (questionIndex === 2) {
      if (subject && sourceMistake) onCompleteReview([sourceMistake.id], subject, { clientId: recoverySet?.id ?? `recovery-${sourceMistake.id}`, topic: sourceMistake.topic ?? subject, targetedErrorType: question?.targetErrorType ?? sourceMistake.cause ?? 'uncertain', answers, startedAt, completedAt: new Date().toISOString() }, nextResistedCount >= 2).catch(() => undefined);
      trackEvent('never_again_completed', { subject: subject ?? 'unknown', questionsCorrect: nextResistedCount, generator: 'local' });
      setResistedCount(nextResistedCount);
      setComplete(true);
      return;
    }
    setResistedCount(nextResistedCount);
    setQuestionIndex((value) => value + 1);
    setSelectedOption(null);
    setChecked(false);
  };

  if (!subject || !sourceMistake || !recoverySet) return <TopicPicker groups={groups} onChoose={chooseSubject} onExit={onExit} />;
  if (complete) return <RecoveryComplete resistedCount={resistedCount} subject={subject} customSubject={sourceMistake.customSubject} onDone={onDone} />;
  if (!started) return <RecoveryBriefing mistake={sourceMistake} recoverySet={recoverySet} subject={subject} onExit={onExit} onStart={() => { setStarted(true); trackEvent('never_again_started', { subject, errorType: sourceMistake.cause ?? 'uncertain', source: 'topic' }); }} />;
  const activeQuestion = question!;

  return (
    <ScrollView style={styles.screenBase} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.screen}>
        <MissionTop onExit={onExit} />
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.overline}>{t('review.realEvidence')}</Text>
            <Text style={styles.missionTitle}>{sourceMistake.customSubject ?? t(subjectLabelKey(subject))}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setSubject(null)} style={styles.changeTopic}>
            <Text style={styles.changeTopicText}>{t('review.changeTopic')}</Text>
          </Pressable>
        </View>

        <View style={styles.progressLine}>
          {questions.map((item, index) => <View key={item.id} style={[styles.progressTrack, index < questionIndex && styles.progressDone, index === questionIndex && styles.progressCurrent]} />)}
        </View>

        <Reanimated.View key={questionIndex} entering={reducedMotion ? undefined : FadeInDown.duration(premiumMotion.duration.normal).reduceMotion(ReduceMotion.System)} exiting={reducedMotion ? undefined : FadeOutUp.duration(premiumMotion.duration.fast).reduceMotion(ReduceMotion.System)} style={[styles.questionStage, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [premiumMotion.questionOffset, 0] }) }] }]}>
          <Text style={styles.questionCount}>{t('review.questionCount', { current: formatNumber(questionIndex + 1), total: '3' })}</Text>
          <Text style={styles.prompt}>{activeQuestion.prompt}</Text>
          <View style={styles.answerList}>{activeQuestion.options.map((option, index) => <Pressable key={option} disabled={checked} onPress={() => setSelectedOption(index)} style={[styles.answerOption, selectedOption === index && styles.answerSelected, checked && index === activeQuestion.correctOption && styles.answerCorrect, checked && selectedOption === index && index !== activeQuestion.correctOption && styles.answerIncorrect]}><Text style={styles.answerText}>{option}</Text></Pressable>)}</View>
          {checked && <View style={styles.revealPanel}><Text style={styles.revealLabel}>{isRecoveryAnswerCorrect(activeQuestion, selectedOption) ? t('review.patternResisted') : t('review.patternRepeatedNew')}</Text><Text style={styles.revealNote}>{isRecoveryAnswerCorrect(activeQuestion, selectedOption) ? t('review.patternResistedBody') : t('review.patternRepeatedBody')}</Text><Text style={styles.cause}>{t('review.repairRule')}: {recoverySet.repairRule}</Text><View style={styles.decisionBlock}><PrimaryButton label={questionIndex === 2 ? t('review.finishRecovery') : t('review.nextRecovery')} meta={t('review.recoveryMeta')} tone="mastered" onPress={advance} /></View></View>}
          {!checked && <View style={styles.revealAction}><PrimaryButton label={t('review.checkRecovery')} meta={t('review.recoveryMeta')} onPress={() => { if (selectedOption !== null) { const correct=isRecoveryAnswerCorrect(activeQuestion, selectedOption); setAnswers((current)=>[...current,{questionId:activeQuestion.id,correct,patternResisted:correct,answeredAt:new Date().toISOString()}]); setChecked(true); trackEvent('recovery_question_answered', { subject, correct, errorType: activeQuestion.targetErrorType }); } }} /></View>}
        </Reanimated.View>
        <Text style={styles.focusNote}>{t('review.focusNoteRecovery')}</Text>
      </View>
    </ScrollView>
  );
}

function MissionTop({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.missionTop}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('review.exitMission')} onPress={() => { safeHaptic(Haptics.selectionAsync()); onExit(); }} style={styles.exitButton}>
        <Feather name="x" size={17} color={colors.ink} /><Text style={styles.exitText}>{t('review.exit')}</Text>
      </Pressable>
      <View style={styles.missionBadge}><View style={styles.liveDot} /><Text style={styles.missionBadgeText}>NEVER AGAIN</Text></View>
    </View>
  );
}

function RecoveryBriefing({ mistake, recoverySet, subject, onExit, onStart }: { mistake: MistakeRecord; recoverySet: ReturnType<typeof generateRecoverySet>; subject: SubjectId; onExit: () => void; onStart: () => void }) {
  const { t } = useTranslation();
  return <ScrollView style={styles.screenBase} contentContainerStyle={styles.scroll}><View style={styles.screen}><MissionTop onExit={onExit} /><Text style={styles.overline}>{t('review.briefingEyebrow')}</Text><Text style={styles.pickerTitle}>{t('review.briefingTitle')}</Text><Text style={styles.instruction}>{mistake.customSubject ?? t(subjectLabelKey(subject))}</Text><View style={styles.briefCard}><Text style={styles.briefLabel}>{t('review.recurringPattern')}</Text><Text style={styles.briefValue}>{mistake.cause ? t(`onboarding.risk.${mistake.cause}` as never) : t('onboarding.risk.uncertain')}</Text><Text style={styles.briefLabel}>{t('review.repairRule')}</Text><Text style={styles.briefRule}>{recoverySet.repairRule}</Text></View><View style={styles.revealAction}><PrimaryButton label={t('review.startRecovery')} meta={t('review.recoveryDuration')} onPress={onStart} /></View></View></ScrollView>;
}

function RecoveryComplete({ resistedCount, subject, customSubject, onDone }: { resistedCount: number; subject: SubjectId; customSubject?: string; onDone: () => void }) {
  const { t, formatNumber } = useTranslation();
  const resisted = resistedCount >= 2;
  return <View style={styles.completeScreen}><View style={styles.completeInner}><View style={[styles.completeOrb, !resisted && styles.completeOrbRisk]}><Feather name={resisted ? 'check' : 'refresh-cw'} size={38} color={colors.onAccent} /></View><Text style={styles.completeOverline}>{t(resisted ? 'review.patternResisted' : 'review.stillShowing')}</Text><Text style={styles.completeTitle}>{t(resisted ? 'review.recoveryCompleteTitle' : 'review.recoveryRetryTitle')}</Text><Text style={styles.completeBody}>{t(resisted ? 'review.recoveryCompleteBody' : 'review.recoveryRetryBody', { count: formatNumber(resistedCount), topic: customSubject ?? t(subjectLabelKey(subject)) })}</Text><PrimaryButton label={t('review.backHome')} meta={t('review.noFakeMastery')} tone={resisted ? 'mastered' : 'risk'} onPress={onDone} /></View></View>;
}

function TopicPicker({ groups, onChoose, onExit }: { groups: ReturnType<typeof groupMistakesBySubject>; onChoose: (subject: SubjectId) => void; onExit: () => void }) {
  const { t, formatNumber } = useTranslation();
  return (
    <ScrollView style={styles.screenBase} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.screen}>
        <MissionTop onExit={onExit} />
        <View style={styles.pickerHeading}><Text style={styles.overline}>{t('review.chooseTopicEyebrow')}</Text><Text style={styles.pickerTitle}>{t('review.chooseTopicTitle')}</Text><Text style={styles.instruction}>{t('review.chooseTopicBody')}</Text></View>
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Feather name="camera" size={25} color={colors.signal} /></View>
            <Text style={styles.emptyTitle}>{t('review.noQuestionsTitle')}</Text><Text style={styles.emptyBody}>{t('review.noQuestionsBody')}</Text>
            <PrimaryButton label={t('home.logMistake')} meta={t('home.logMistakeMeta')} onPress={onExit} />
          </View>
        ) : (
          <View style={styles.topicList}>
            {groups.map((group, index) => (
              <Pressable key={group.subject} accessibilityRole="button" onPress={() => onChoose(group.subject)} style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}>
                <Text style={styles.topicIndex}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.topicCopy}><Text style={styles.topicTitle}>{group.customSubject ?? t(subjectLabelKey(group.subject))}</Text><Text style={styles.topicMeta}>{t(group.mistakes.length === 1 ? 'home.topicQuestion' : 'home.topicQuestions', { count: formatNumber(group.mistakes.length) })}</Text></View>
                <View style={styles.topicArrow}><Feather name="arrow-right" size={18} color={colors.onAccent} /></View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  screenBase: { flex: 1, backgroundColor: colors.canvas }, scroll: { minHeight: '100%', paddingBottom: spacing.xxl }, screen: { width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  missionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, exitButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.md }, exitText: { color: colors.ink, fontFamily: type.semibold, fontSize: 11 },
  missionBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, backgroundColor: colors.nav, paddingHorizontal: spacing.sm }, liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.mastered }, missionBadgeText: { color: colors.onDark, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 1 },
  headingRow: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }, headingCopy: { flex: 1 }, overline: { color: colors.risk, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.2 }, missionTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 27, letterSpacing: -1.1, marginTop: 5 }, changeTopic: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm }, changeTopicText: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.7 },
  progressLine: { flexDirection: 'row', gap: 6, marginTop: spacing.lg }, progressTrack: { height: 4, flex: 1, borderRadius: 3, backgroundColor: colors.line }, progressDone: { backgroundColor: colors.mastered }, progressCurrent: { backgroundColor: colors.risk },
  questionStage: { paddingTop: spacing.xl }, questionCount: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 }, prompt: { color: colors.ink, fontFamily: type.extraBold, fontSize: 29, lineHeight: 35, letterSpacing: -1.2, marginTop: spacing.sm }, instruction: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  questionImageFrame: { height: 286, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', marginTop: spacing.lg }, questionImage: { width: '100%', height: '100%' }, imageBadge: { position: 'absolute', left: spacing.sm, bottom: spacing.sm, minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.nav, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm }, imageBadgeText: { color: colors.onDark, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.8 },
  textEvidence: { borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, borderLeftColor: colors.risk, padding: spacing.lg, marginTop: spacing.lg }, textEvidenceLabel: { color: colors.risk, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 }, textEvidenceValue: { color: colors.ink, fontFamily: type.bold, fontSize: 18, lineHeight: 26, marginTop: spacing.sm },
  revealAction: { marginTop: spacing.lg }, revealPanel: { marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.nav, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.lg }, revealLabel: { color: colors.risk, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1 }, revealNote: { color: colors.onDark, fontFamily: type.bold, fontSize: 17, lineHeight: 24, marginTop: spacing.sm }, cause: { color: colors.darkMuted, fontFamily: type.mono, fontSize: 8, lineHeight: 14, letterSpacing: 0.5, marginTop: spacing.sm }, decisionBlock: { marginTop: spacing.lg, gap: spacing.sm }, revisitButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, revisitText: { color: colors.onDark, fontFamily: type.semibold, fontSize: 12 }, focusNote: { color: colors.faint, fontFamily: type.mono, fontSize: 8, textAlign: 'center', letterSpacing: 0.7, marginTop: spacing.lg },
  aiExplanation: { color: colors.darkMuted, fontFamily: type.regular, fontSize: 12, lineHeight: 19, marginTop: spacing.sm }, aiSteps: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.darkLine }, aiStep: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.darkLine }, aiStepIndex: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, width: 22 }, aiStepText: { color: colors.onDark, fontFamily: type.semibold, fontSize: 11, lineHeight: 17, flex: 1 },
  pickerHeading: { marginTop: spacing.xl }, pickerTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 35, lineHeight: 40, letterSpacing: -1.6, marginTop: spacing.sm }, topicList: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.line }, topicRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line }, pressed: { opacity: 0.7 }, topicIndex: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, width: 24 }, topicCopy: { flex: 1 }, topicTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 17 }, topicMeta: { color: colors.muted, fontFamily: type.mono, fontSize: 8, letterSpacing: 0.6, marginTop: 5 }, topicArrow: { width: 38, height: 38, borderRadius: 20, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' },
  emptyState: { marginTop: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, padding: spacing.lg }, emptyIcon: { width: 54, height: 54, borderRadius: 28, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, marginTop: spacing.lg }, emptyBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: spacing.xs, marginBottom: spacing.lg },
  completeScreen: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, completeInner: { width: '100%', maxWidth: 520 }, completeOrb: { width: 108, height: 108, borderRadius: 56, backgroundColor: colors.mastered, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.xl }, completeOverline: { color: colors.mastered, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.3, textAlign: 'center' }, completeTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 32, lineHeight: 38, letterSpacing: -1.4, textAlign: 'center', marginTop: spacing.sm }, completeBody: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginVertical: spacing.xl },
  answerList: { marginTop: spacing.lg, gap: spacing.sm }, answerOption: { minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, justifyContent: 'center' }, answerSelected: { borderColor: colors.signal, backgroundColor: colors.violetWash }, answerCorrect: { borderColor: colors.mastered, backgroundColor: colors.masteredWash }, answerIncorrect: { borderColor: colors.risk, backgroundColor: colors.riskWash }, answerText: { color: colors.ink, fontFamily: type.semibold, fontSize: 13, lineHeight: 19 }, briefCard: { marginTop: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.nav, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.lg, gap: spacing.xs }, briefLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 }, briefValue: { color: colors.onDark, fontFamily: type.bold, fontSize: 17, marginBottom: spacing.md }, briefRule: { color: colors.onDark, fontFamily: type.semibold, fontSize: 14, lineHeight: 21 }, completeOrbRisk: { backgroundColor: colors.risk },
}));
