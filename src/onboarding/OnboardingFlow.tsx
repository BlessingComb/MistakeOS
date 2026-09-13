import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { trackEvent } from '../analytics';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTranslation } from '../i18n';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';
import { CauseId, deriveInitialProfile, EMPTY_ANSWERS, GoalId, OnboardingAnswers, SubjectId } from './core';
import { CAUSE_OPTIONS, GOAL_OPTIONS, riskLabelKey, SUBJECT_OPTIONS } from './options';

type Stage = 'hook' | 'subjects' | 'causes' | 'goal' | 'profile' | 'action';
type CompletionAction = 'add' | 'later';

type Props = {
  source: 'first_launch' | 'settings_reset';
  onComplete: (answers: OnboardingAnswers, action: CompletionAction) => Promise<void>;
  onSkip: (stage: Stage) => Promise<void>;
};

const stageOrder: Stage[] = ['hook', 'subjects', 'causes', 'goal', 'profile', 'action'];

export function OnboardingFlow({ source, onComplete, onSkip }: Props) {
  const { t, formatNumber } = useTranslation();
  const [stage, setStage] = useState<Stage>('hook');
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [analyzing, setAnalyzing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const profile = useMemo(() => deriveInitialProfile(answers), [answers]);

  useEffect(() => {
    trackEvent('onboarding_started', { source });
  }, [source]);

  useEffect(() => {
    if (stage !== 'profile' || !analyzing) return;
    const timeout = setTimeout(() => setAnalyzing(false), 1050);
    return () => clearTimeout(timeout);
  }, [analyzing, stage]);

  const move = (next: Stage) => {
    Haptics.selectionAsync().catch(() => undefined);
    setStage(next);
  };

  const toggleSubject = (subject: SubjectId) => {
    Haptics.selectionAsync().catch(() => undefined);
    setAnswers((current) => ({
      ...current,
      subjects: current.subjects.includes(subject)
        ? current.subjects.filter((item) => item !== subject)
        : [...current.subjects, subject],
    }));
  };

  const toggleCause = (cause: CauseId) => {
    Haptics.selectionAsync().catch(() => undefined);
    setAnswers((current) => ({
      ...current,
      causes: current.causes.includes(cause)
        ? current.causes.filter((item) => item !== cause)
        : [...current.causes, cause],
    }));
  };

  const chooseGoal = (goal: GoalId) => {
    Haptics.selectionAsync().catch(() => undefined);
    setAnswers((current) => ({ ...current, goal }));
  };

  const showProfile = () => {
    if (!profile) return;
    trackEvent('initial_profile_created', {
      primaryRisk: profile.primaryRisk,
      secondaryRisk: profile.secondaryRisk,
    });
    setAnalyzing(true);
    move('profile');
  };

  const finish = async (action: CompletionAction) => {
    if (completing) return;
    if (action === 'add') trackEvent('first_mistake_cta_clicked', { source: 'onboarding' });
    setCompletionError(false);
    setCompleting(true);
    try {
      await onComplete(answers, action);
    } catch {
      setCompletionError(true);
    } finally {
      setCompleting(false);
    }
  };

  const skip = async (currentStage: Stage) => {
    if (completing) return;
    setCompletionError(false);
    setCompleting(true);
    try {
      await onSkip(currentStage);
    } catch {
      setCompletionError(true);
    } finally {
      setCompleting(false);
    }
  };

  if (stage === 'hook') {
    return (
      <ScrollView style={styles.dark} contentContainerStyle={styles.hookScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hookScreen}>
          <View style={styles.hookTop}><BrandMark /></View>
          <View style={styles.signalGraphic}>
            <View style={styles.signalRingOuter} />
            <View style={styles.signalRingInner} />
            <View style={styles.signalCore} />
            {Array.from({ length: 12 }).map((_, index) => (
              <View key={index} style={[styles.signalTick, { transform: [{ rotate: `${index * 30}deg` }, { translateY: -82 }] }]} />
            ))}
          </View>
          <View style={styles.hookCopy}>
            <Text style={styles.hookEyebrow}>{t('onboarding.hookEyebrow')}</Text>
            <Text style={styles.hookTitle}>{t('onboarding.hookTitle')}</Text>
            <Text style={styles.hookBody}>{t('onboarding.hookBody')}</Text>
          </View>
          <PrimaryButton label={t('onboarding.hookCta')} meta={t('onboarding.hookMeta')} tone="mastered" onPress={() => move('subjects')} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: completing }} disabled={completing} onPress={() => { void skip(stage); }} style={[styles.skipButton, completing && styles.disabled]}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Pressable>
          {completionError && <Text accessibilityRole="alert" style={styles.completionError}>{t('onboarding.saveError')}</Text>}
        </View>
      </ScrollView>
    );
  }

  const questionStage = stage === 'subjects' || stage === 'causes' || stage === 'goal';
  const questionNumber = stage === 'subjects' ? 1 : stage === 'causes' ? 2 : 3;
  const canContinue = stage === 'subjects'
    ? answers.subjects.length > 0
    : stage === 'causes'
      ? answers.causes.length > 0
      : stage === 'goal'
        ? answers.goal !== null
        : true;

  return (
    <ScrollView style={styles.dark} contentContainerStyle={styles.flowScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.flowScreen}>
        <View style={styles.flowTop}>
          <Pressable accessibilityRole="button" onPress={() => move(stageOrder[Math.max(0, stageOrder.indexOf(stage) - 1)])} style={styles.backButton}>
            <Feather name="arrow-left" size={18} color={colors.ink} />
            <Text style={styles.backText}>{t('onboarding.back')}</Text>
          </Pressable>
          {questionStage && <Text style={styles.stepText}>{t('onboarding.step', { current: formatNumber(questionNumber), total: formatNumber(3) })}</Text>}
        </View>

        {questionStage && (
          <View style={styles.progressRail}>
            {[1, 2, 3].map((step) => <View key={step} style={[styles.progressSegment, step <= questionNumber && styles.progressActive]} />)}
          </View>
        )}

        {stage === 'subjects' && (
          <QuestionShell title={t('onboarding.subjectsTitle')} body={t('onboarding.subjectsBody')} meta={t('onboarding.multiple')}>
            <View style={styles.optionGrid}>
              {SUBJECT_OPTIONS.map((option) => (
                <SelectOption key={option.id} selected={answers.subjects.includes(option.id)} label={t(option.labelKey)} onPress={() => toggleSubject(option.id)} compact />
              ))}
            </View>
          </QuestionShell>
        )}

        {stage === 'causes' && (
          <QuestionShell title={t('onboarding.causesTitle')} body={t('onboarding.causesBody')} meta={t('onboarding.multiple')}>
            <View style={styles.optionList}>
              {CAUSE_OPTIONS.map((option) => (
                <SelectOption key={option.id} selected={answers.causes.includes(option.id)} label={t(option.labelKey)} onPress={() => toggleCause(option.id)} />
              ))}
            </View>
          </QuestionShell>
        )}

        {stage === 'goal' && (
          <QuestionShell title={t('onboarding.goalTitle')} body={t('onboarding.goalBody')} meta={t('onboarding.single')}>
            <View style={styles.optionList}>
              {GOAL_OPTIONS.map((option) => (
                <SelectOption key={option.id} selected={answers.goal === option.id} label={t(option.labelKey)} onPress={() => chooseGoal(option.id)} single />
              ))}
            </View>
          </QuestionShell>
        )}

        {stage === 'profile' && profile && (
          analyzing ? (
            <View style={styles.analysisStage}>
              <View style={styles.analysisOrbit}><View style={styles.analysisCore} /></View>
              <Text style={styles.analysisTitle}>{t('onboarding.analysisTitle')}</Text>
              <Text style={styles.analysisBody}>{t('onboarding.analysisBody')}</Text>
            </View>
          ) : (
            <View style={styles.profileStage}>
              <Text style={styles.profileEyebrow}>{t('onboarding.profileEyebrow')}</Text>
              <Text style={styles.profileTitle}>{t('onboarding.profileTitle')}</Text>
              <View style={styles.profileSignals}>
                <ProfileSignal index="01" label={t('onboarding.primaryRisk')} value={t(riskLabelKey(profile.primaryRisk))} tone={colors.risk} />
                {profile.secondaryRisk && <ProfileSignal index="02" label={t('onboarding.secondaryRisk')} value={t(riskLabelKey(profile.secondaryRisk))} tone={colors.recovering} />}
              </View>
              <Text style={styles.profileEvidence}>{t('onboarding.profileEvidence', { count: formatNumber(profile.evidence.length) })}</Text>
              <Text style={styles.profileBody}>{t('onboarding.profileBody')}</Text>
            </View>
          )
        )}

        {stage === 'action' && (
          <View style={styles.actionStage}>
            <View style={styles.actionIcon}><Feather name="plus" size={30} color={colors.onAccent} /></View>
            <Text style={styles.actionEyebrow}>{t('onboarding.firstActionEyebrow')}</Text>
            <Text style={styles.actionTitle}>{t('onboarding.firstActionTitle')}</Text>
            <Text style={styles.actionBody}>{t('onboarding.firstActionBody')}</Text>
          </View>
        )}

        <View style={styles.flowActions}>
          {questionStage && (
            <Pressable
              accessibilityRole="button"
              disabled={!canContinue}
              onPress={() => stage === 'subjects' ? move('causes') : stage === 'causes' ? move('goal') : showProfile()}
              style={[styles.continueButton, !canContinue && styles.continueDisabled]}
            >
              <Text style={styles.continueText}>{t('onboarding.continue')}</Text>
              <Feather name="arrow-right" size={18} color={colors.onAccent} />
            </Pressable>
          )}
          {stage === 'profile' && !analyzing && (
            <PrimaryButton label={t('onboarding.continue')} meta={t('onboarding.profileMeta')} tone="mastered" onPress={() => move('action')} />
          )}
          {stage === 'action' && (
            <>
              <PrimaryButton disabled={completing} label={t('onboarding.addFirstMistake')} meta={t('mistake.saveMeta')} tone="risk" onPress={() => { void finish('add'); }} />
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: completing }} disabled={completing} onPress={() => { void finish('later'); }} style={[styles.laterButton, completing && styles.disabled]}>
                <Text style={styles.laterText}>{t('onboarding.later')}</Text>
              </Pressable>
            </>
          )}
          {completionError && <Text accessibilityRole="alert" style={styles.completionError}>{t('onboarding.saveError')}</Text>}
        </View>
      </View>
    </ScrollView>
  );
}

function QuestionShell({ title, body, meta, children }: { title: string; body: string; meta: string; children: ReactNode }) {
  return (
    <View style={styles.questionShell}>
      <Text style={styles.questionMeta}>{meta}</Text>
      <Text style={styles.questionTitle}>{title}</Text>
      <Text style={styles.questionBody}>{body}</Text>
      {children}
    </View>
  );
}

function SelectOption({ label, selected, onPress, compact = false, single = false }: { label: string; selected: boolean; onPress: () => void; compact?: boolean; single?: boolean }) {
  return (
    <Pressable
      accessibilityRole={single ? 'radio' : 'checkbox'}
      accessibilityState={single ? { checked: selected } : { checked: selected }}
      onPress={onPress}
      style={[styles.selectOption, compact && styles.selectCompact, selected && styles.selectActive]}
    >
      <Text style={[styles.selectLabel, selected && styles.selectLabelActive]}>{label}</Text>
      <View style={[styles.selectMark, selected && styles.selectMarkActive]}>
        {selected && <Feather name="check" size={13} color={colors.onAccent} />}
      </View>
    </Pressable>
  );
}

function ProfileSignal({ index, label, value, tone }: { index: string; label: string; value: string; tone: string }) {
  return (
    <View style={styles.profileSignal}>
      <Text style={styles.profileIndex}>{index}</Text>
      <View style={[styles.profileMarker, { backgroundColor: tone }]} />
      <View style={styles.profileSignalCopy}>
        <Text style={styles.profileSignalLabel}>{label}</Text>
        <Text style={styles.profileSignalValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  dark: { flex: 1, backgroundColor: colors.canvas },
  hookScroll: { flexGrow: 1, padding: spacing.lg },
  hookScreen: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  hookTop: { minHeight: 36 },
  signalGraphic: { width: 190, height: 190, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md },
  signalRingOuter: { position: 'absolute', width: 164, height: 164, borderRadius: 90, borderWidth: 1, borderColor: colors.violet },
  signalRingInner: { position: 'absolute', width: 108, height: 108, borderRadius: 60, borderWidth: 1, borderColor: colors.signal },
  signalCore: { width: 24, height: 24, borderRadius: 14, backgroundColor: colors.violet },
  signalTick: { position: 'absolute', width: 2, height: 9, borderRadius: 2, backgroundColor: colors.signal },
  hookCopy: { marginBottom: spacing.xl },
  hookEyebrow: { color: colors.risk, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.4, marginBottom: spacing.sm },
  hookTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 38, lineHeight: 42, letterSpacing: -1.8 },
  hookBody: { color: colors.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 23, marginTop: spacing.md },
  skipButton: { alignSelf: 'center', padding: spacing.md },
  skipText: { color: colors.faint, fontFamily: type.semibold, fontSize: 12 },
  flowScroll: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl },
  flowScreen: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  flowTop: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  backText: { color: colors.ink, fontFamily: type.semibold, fontSize: 12 },
  stepText: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 },
  progressRail: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  progressSegment: { height: 3, flex: 1, borderRadius: 2, backgroundColor: colors.line },
  progressActive: { backgroundColor: colors.signal },
  questionShell: { marginTop: spacing.xl },
  questionMeta: { color: colors.risk, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.2 },
  questionTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 34, lineHeight: 39, letterSpacing: -1.5, marginTop: spacing.sm },
  questionBody: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  optionList: { gap: spacing.xs, marginTop: spacing.xl },
  selectOption: { minHeight: 56, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  selectCompact: { width: '48%', minHeight: 68 },
  selectActive: { backgroundColor: colors.signal, borderColor: colors.signal },
  selectLabel: { color: colors.ink, fontFamily: type.semibold, fontSize: 13, flex: 1 },
  selectLabelActive: { color: colors.onAccent },
  selectMark: { width: 22, height: 22, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  selectMarkActive: { borderColor: colors.onAccent },
  flowActions: { marginTop: 'auto', paddingTop: spacing.xl },
  continueButton: { minHeight: 62, borderRadius: radius.lg, backgroundColor: colors.signal, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  continueDisabled: { opacity: 0.3 },
  continueText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 15 },
  analysisStage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 500 },
  analysisOrbit: { width: 150, height: 150, borderRadius: 80, borderWidth: 1, borderColor: colors.mastered, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  analysisCore: { width: 30, height: 30, borderRadius: 16, backgroundColor: colors.mastered },
  analysisTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 25, textAlign: 'center', letterSpacing: -1 },
  analysisBody: { color: colors.faint, fontFamily: type.regular, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  profileStage: { marginTop: spacing.xl },
  profileEyebrow: { color: colors.mastered, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.2 },
  profileTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 38, lineHeight: 42, letterSpacing: -1.8, marginTop: spacing.sm },
  profileSignals: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.xl },
  profileSignal: { minHeight: 96, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  profileIndex: { color: colors.faint, fontFamily: type.mono, fontSize: 9, width: 28 },
  profileMarker: { width: 10, height: 44, borderRadius: 6, marginRight: spacing.md },
  profileSignalCopy: { flex: 1 },
  profileSignalLabel: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 },
  profileSignalValue: { color: colors.ink, fontFamily: type.extraBold, fontSize: 23, letterSpacing: -0.7, marginTop: 4 },
  profileEvidence: { color: colors.mastered, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.9, marginTop: spacing.lg },
  profileBody: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  actionStage: { flex: 1, minHeight: 440, justifyContent: 'center' },
  actionIcon: { width: 72, height: 72, borderRadius: 40, backgroundColor: colors.risk, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  actionEyebrow: { color: colors.risk, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.2 },
  actionTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 38, lineHeight: 43, letterSpacing: -1.8, marginTop: spacing.sm },
  actionBody: { color: colors.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 23, marginTop: spacing.md },
  laterButton: { alignSelf: 'center', padding: spacing.md, marginTop: spacing.xs },
  laterText: { color: colors.faint, fontFamily: type.semibold, fontSize: 12 },
  completionError: { color: colors.risk, fontFamily: type.semibold, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm },
  disabled: { opacity: 0.55 },
}));
