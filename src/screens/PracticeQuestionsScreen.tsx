import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTranslation } from '../i18n';
import { createPracticeAttemptId, type PracticeQuestion, type PracticeQuestionRepository, type PracticeResult } from '../practice';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Props = {
  skillCode: string;
  skillName: string;
  mistakeId: string;
  repository: PracticeQuestionRepository;
  onBack: () => void;
  onCompleted: () => Promise<void>;
};

type LoadState = 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';

export function PracticeQuestionsScreen({ skillCode, skillName, mistakeId, repository, onBack, onCompleted }: Props) {
  const { t, formatNumber } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const [questions, setQuestions] = useState<readonly PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [attemptId, setAttemptId] = useState(() => createPracticeAttemptId());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<readonly PracticeResult[] | null>(null);

  const load = async () => {
    setState('loading');
    const response = await repository.load(skillCode);
    if (response.kind === 'ready') { setQuestions(response.questions); setAnswers({}); setIndex(0); setAttemptId(createPracticeAttemptId()); setState('ready'); return; }
    setState(response.kind);
  };

  useEffect(() => {
    let active = true;
    repository.load(skillCode).then((response) => {
      if (!active) return;
      if (response.kind === 'ready') { setQuestions(response.questions); setAnswers({}); setIndex(0); setAttemptId(createPracticeAttemptId()); setState('ready'); return; }
      setState(response.kind);
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [repository, skillCode]);

  const question = questions[index];
  const selected = question ? answers[question.id] : undefined;
  const last = index === questions.length - 1;
  const submit = async () => {
    if (submitting || questions.length !== 3 || questions.some((item) => !answers[item.id])) return;
    setSubmitting(true);
    const response = await repository.submit({ mistakeId, skillCode, clientId: attemptId, questionIds: questions.map((item) => item.id), selectedAnswers: questions.map((item) => answers[item.id]!) });
    setSubmitting(false);
    if (!response) { setState('error'); return; }
    setResults(response.results);
    await onCompleted();
  };

  if (state === 'loading') return <PracticeState icon="loader" title={t('practice.loading')} body={t('practice.loadingBody')} onBack={onBack} />;
  if (state === 'empty') return <PracticeState icon="clock" title={t('practice.emptyTitle')} body={t('practice.emptyBody')} onBack={onBack} />;
  if (state === 'unavailable') return <PracticeState icon="shield" title={t('practice.unavailableTitle')} body={t('practice.unavailableBody')} onBack={onBack} />;
  if (state === 'error' || !question) return <PracticeState icon="wifi-off" title={t('practice.errorTitle')} body={t('practice.errorBody')} onBack={onBack} onRetry={load} />;
  if (results) return <PracticeResults skillName={skillName} questions={questions} results={results} onBack={onBack} />;

  return <ScrollView style={styles.base} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><View style={styles.screen}>
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Feather name="arrow-left" size={16} color={colors.signal} /><Text style={styles.backText}>{t('practice.back')}</Text></Pressable>
    <Text style={styles.eyebrow}>{t('practice.eyebrow')}</Text><Text style={styles.title}>{skillName}</Text>
    <View style={styles.progressRow}><Text style={styles.progressLabel}>{t('practice.questionNumber', { current: formatNumber(index + 1), total: formatNumber(questions.length) })}</Text><Text style={styles.source}>{question.sourceLabel}</Text></View>
    <View style={styles.progressTrack}>{questions.map((item, itemIndex) => <View key={item.id} style={[styles.progressPart, itemIndex <= index && styles.progressPartActive]} />)}</View>
    <View style={styles.questionCard}><Text style={styles.statement}>{question.statement}</Text>{question.alternatives.map((alternative, alternativeIndex) => {
      const answer = String.fromCharCode(65 + alternativeIndex);
      const active = selected === answer;
      return <Pressable key={answer} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => setAnswers((previous) => ({ ...previous, [question.id]: answer }))} style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}><Text style={[styles.optionLetter, active && styles.optionLetterActive]}>{answer}</Text><Text style={[styles.optionText, active && styles.optionTextActive]}>{alternative}</Text></Pressable>;
    })}</View>
    <PrimaryButton label={last ? t('practice.confirm') : t('practice.next')} meta={last ? t('practice.confirmMeta') : t('practice.nextMeta')} disabled={!selected || submitting} onPress={() => last ? void submit() : setIndex((value) => value + 1)} />
  </View></ScrollView>;
}

function PracticeResults({ skillName, questions, results, onBack }: { skillName: string; questions: readonly PracticeQuestion[]; results: readonly PracticeResult[]; onBack: () => void }) {
  const { t, formatNumber } = useTranslation();
  const correct = results.filter((result) => result.correct).length;
  return <ScrollView style={styles.base} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><View style={styles.screen}>
    <Text style={styles.eyebrow}>{t('practice.completedEyebrow')}</Text><Text style={styles.title}>{t('practice.completedTitle')}</Text><Text style={styles.lead}>{skillName}</Text>
    <View style={styles.score}><Text style={styles.scoreNumber}>{formatNumber(correct)}/{formatNumber(questions.length)}</Text><Text style={styles.scoreLabel}>{t('practice.correctAnswers')}</Text></View>
    {questions.map((question, index) => { const result = results.find((item) => item.questionId === question.id); return <View key={question.id} style={styles.resultItem}><View style={[styles.resultIcon, result?.correct ? styles.resultCorrect : styles.resultIncorrect]}><Feather name={result?.correct ? 'check' : 'rotate-ccw'} size={15} color={result?.correct ? colors.mastered : colors.risk} /></View><View style={styles.grow}><Text style={styles.resultTitle}>{t('practice.resultQuestion', { number: formatNumber(index + 1) })}</Text><Text style={styles.resultState}>{result?.correct ? t('practice.correct') : t('practice.review')}</Text><Text style={styles.explanation}>{result?.explanation ?? t('practice.explanationUnavailable')}</Text></View></View>; })}
    <PrimaryButton label={t('practice.backToPreparation')} onPress={onBack} />
  </View></ScrollView>;
}

function PracticeState({ icon, title, body, onBack, onRetry }: { icon: keyof typeof Feather.glyphMap; title: string; body: string; onBack: () => void; onRetry?: () => Promise<void> }) {
  const { t } = useTranslation();
  return <View style={styles.state}><View style={styles.stateIcon}>{icon === 'loader' ? <ActivityIndicator color={colors.signal} /> : <Feather name={icon} size={22} color={colors.signal} />}</View><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateBody}>{body}</Text>{onRetry && <Pressable accessibilityRole="button" onPress={() => void onRetry()} style={styles.retry}><Text style={styles.retryText}>{t('common.tryAgain')}</Text></Pressable>}<Pressable accessibilityRole="button" onPress={onBack} style={styles.backAction}><Text style={styles.backActionText}>{t('practice.back')}</Text></Pressable></View>;
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  base: { flex: 1, backgroundColor: colors.canvas }, scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 116 }, screen: { width: '100%', maxWidth: 720, alignSelf: 'center' }, grow: { flex: 1 }, pressed: { opacity: 0.7 },
  back: { alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }, backText: { color: colors.signal, fontFamily: type.bold, fontSize: 11 }, eyebrow: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.2 }, title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 30, lineHeight: 35, letterSpacing: -1.2, marginTop: spacing.xs }, lead: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.xl }, progressLabel: { color: colors.ink, fontFamily: type.bold, fontSize: 13 }, source: { flex: 1, color: colors.faint, fontFamily: type.mono, fontSize: 8, textAlign: 'right' }, progressTrack: { flexDirection: 'row', gap: 5, marginTop: spacing.sm }, progressPart: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.line }, progressPartActive: { backgroundColor: colors.signal },
  questionCard: { marginTop: spacing.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, backgroundColor: colors.paper, marginBottom: spacing.lg }, statement: { color: colors.ink, fontFamily: type.semibold, fontSize: 17, lineHeight: 26, marginBottom: spacing.lg }, option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, marginTop: spacing.sm }, optionActive: { borderColor: colors.signal, backgroundColor: colors.violetWash }, optionLetter: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, color: colors.muted, fontFamily: type.monoBold, fontSize: 10, textAlign: 'center', textAlignVertical: 'center' }, optionLetterActive: { borderColor: colors.signal, color: colors.signal }, optionText: { flex: 1, color: colors.ink, fontFamily: type.regular, fontSize: 13, lineHeight: 19 }, optionTextActive: { fontFamily: type.semibold },
  state: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, stateIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.violetWash, justifyContent: 'center', alignItems: 'center' }, stateTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, textAlign: 'center', marginTop: spacing.lg }, stateBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 360, marginTop: spacing.xs }, retry: { marginTop: spacing.lg, minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.nav, paddingHorizontal: spacing.lg, justifyContent: 'center' }, retryText: { color: colors.onDark, fontFamily: type.bold, fontSize: 12 }, backAction: { minHeight: 42, paddingHorizontal: spacing.lg, justifyContent: 'center', marginTop: spacing.sm }, backActionText: { color: colors.signal, fontFamily: type.bold, fontSize: 12 },
  score: { marginTop: spacing.xl, marginBottom: spacing.xl, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.violetWash, borderWidth: 1, borderColor: colors.line }, scoreNumber: { color: colors.ink, fontFamily: type.extraBold, fontSize: 46, letterSpacing: -2 }, scoreLabel: { color: colors.muted, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.7 }, resultItem: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line }, resultIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, resultCorrect: { backgroundColor: colors.masteredWash }, resultIncorrect: { backgroundColor: colors.riskWash }, resultTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 13 }, resultState: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.7, marginTop: 3 }, explanation: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
}));
