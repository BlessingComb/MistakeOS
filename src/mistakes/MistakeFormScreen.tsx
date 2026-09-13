import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { analyzeQuestionPhoto, createQuestionPhotoAnalysisRequest, isMistakeAnalysisConfigured, type AnalysisClientResult, type AnalysisUsage, type QuestionPhotoAnalysis, type QuestionPhotoAnalysisRequest } from '../analysis';
import { trackEvent } from '../analytics';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTranslation } from '../i18n';
import { CAUSE_OPTIONS, CauseId, SUBJECT_OPTIONS, SubjectId } from '../onboarding';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';
import { hasMistakeEvidence, type MistakeDraft } from './core';
import { QuestionPhotoSource, selectQuestionPhoto } from './photo';
import { QuestionPhotoImage } from './QuestionPhotoImage';
import { photoLimitFor, type DailyPhotoUsage } from '../photoUsage';
import { useEntitlements } from '../entitlements';

type Props = {
  defaultSubjects?: readonly SubjectId[];
  onSave: (draft: MistakeDraft) => Promise<void>;
  onCancel: () => void;
  onOpenPro?: () => void;
  photoUsage: DailyPhotoUsage;
  onConsumePhotoSlot: () => Promise<boolean>;
};

export function MistakeFormScreen({ defaultSubjects = [], onSave, onCancel, onOpenPro, photoUsage, onConsumePhotoSlot }: Props) {
  const { t, language } = useTranslation();
  const { level } = useEntitlements();
  const [subject, setSubject] = useState<SubjectId | null>(defaultSubjects[0] ?? null);
  const [customSubject, setCustomSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [cause, setCause] = useState<CauseId | undefined>();
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<'permission' | 'generic' | 'limit' | null>(null);
  const [selectingPhoto, setSelectingPhoto] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState<QuestionPhotoAnalysis | undefined>();
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'unavailable' | 'error'>('idle');
  const [analysisError, setAnalysisError] = useState<Extract<AnalysisClientResult, { status: 'error' }>['reason'] | null>(null);
  const [analysisUsage, setAnalysisUsage] = useState<AnalysisUsage | undefined>();
  const [error, setError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const analysisRequestRef = useRef<QuestionPhotoAnalysisRequest | null>(null);

  const submit = async () => {
    if (saving) return;
    if (!subject || (subject === 'other' && !customSubject.trim()) || !hasMistakeEvidence({ note, photoUri })) {
      setError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    setSaving(true);
    setSaveError(false);
    try {
      await onSave({ subject, customSubject: subject === 'other' ? customSubject.trim() : undefined, topic: topic.trim() || photoAnalysis?.topic, cause, note: note.trim() || t('mistake.photoEvidenceNote'), photoUri, photoAnalysis });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setSaveError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  const addPhoto = async (source: QuestionPhotoSource) => {
    if (selectingPhoto) return;
    const replacingPhoto = Boolean(photoUri);
    if (!replacingPhoto && photoUsage.used >= photoLimitFor(level)) {
      setPhotoError('limit');
      return;
    }
    setSelectingPhoto(true);
    setPhotoError(null);
    const result = await selectQuestionPhoto(source);
    setSelectingPhoto(false);
    if (result.status === 'selected') {
      if (!replacingPhoto && !(await onConsumePhotoSlot())) {
        setPhotoError('limit');
        return;
      }
      setPhotoUri(result.uri);
      setError(false);
      setSaveError(false);
      setPhotoAnalysis(undefined);
      setAnalysisState('idle');
      setAnalysisError(null);
      setAnalysisUsage(undefined);
      analysisRequestRef.current = null;
      Haptics.selectionAsync().catch(() => undefined);
    } else if (result.status === 'permission-denied') {
      setPhotoError('permission');
    } else if (result.status === 'error') {
      setPhotoError('generic');
    }
  };

  const analyzePhoto = async () => {
    if (!photoUri || analysisState === 'loading') return;
    setAnalysisState('loading');
    setAnalysisError(null);
    trackEvent('photo_analysis_started', { source: 'mistake_form' });
    trackEvent('ai_analysis_started', { feature: 'mistake_photo_analysis' });
    const request = analysisRequestRef.current ?? createQuestionPhotoAnalysisRequest();
    analysisRequestRef.current = request;
    const result = await analyzeQuestionPhoto(photoUri, language, request);
    if (result.status === 'success') {
      setPhotoAnalysis(result.analysis);
      setAnalysisUsage(result.usage);
      setAnalysisState('idle');
      analysisRequestRef.current = null;
      if (result.analysis.status === 'identified') {
        if (!note.trim()) setNote(result.analysis.errorSummary);
        if (!cause && result.analysis.suggestedCause) setCause(result.analysis.suggestedCause);
        if (!subject) setSubject(result.analysis.suggestedSubject);
        if (!topic.trim() && result.analysis.topic) setTopic(result.analysis.topic);
      }
      trackEvent('photo_analysis_succeeded', { status: result.analysis.status, confidence: result.analysis.confidence });
      trackEvent('ai_analysis_completed', { feature: 'mistake_photo_analysis', model: result.analysis.model });
      safeSuccessHaptic();
      return;
    }
    if (result.status === 'unavailable') {
      setAnalysisState('unavailable');
      trackEvent('photo_analysis_failed', { reason: 'unavailable' });
      return;
    }
    setAnalysisState('error');
    setAnalysisError(result.reason);
    setAnalysisUsage(result.usage);
    trackEvent('photo_analysis_failed', { reason: result.reason });
    trackEvent('ai_analysis_failed', { feature: 'mistake_photo_analysis', errorCode: result.reason });
    if (result.reason === 'limit-reached') trackEvent('ai_limit_reached', { feature: 'mistake_photo_analysis', tier: 'unknown' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  };

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.screen}>
          <View style={styles.topLine}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.closeButton}>
              <Feather name="x" size={19} color={colors.ink} />
              <Text style={styles.closeText}>{t('mistake.cancel')}</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>{t('mistake.title')}</Text>
          <Text style={styles.body}>{t('mistake.body')}</Text>

          <FieldLabel label={t('mistake.subject')} />
          <View style={styles.subjectGrid}>
            {SUBJECT_OPTIONS.map((option) => {
              const selected = subject === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => { setSubject(option.id); setError(false); }}
                  style={[styles.subjectOption, selected && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{t(option.labelKey)}</Text>
                </Pressable>
              );
            })}
          </View>
          {subject === 'other' && (
            <TextInput
              accessibilityLabel={t('mistake.customSubject')}
              onChangeText={(value) => { setCustomSubject(value); setError(false); setSaveError(false); }}
              placeholder={t('mistake.customSubjectPlaceholder')}
              placeholderTextColor={colors.faint}
              style={[styles.customSubjectInput, error && !customSubject.trim() && styles.inputError]}
              value={customSubject}
            />
          )}
          <FieldLabel label={t('mistake.topic')} meta={t('mistake.optional')} />
          <TextInput accessibilityLabel={t('mistake.topic')} onChangeText={setTopic} placeholder={t('mistake.topicPlaceholder')} placeholderTextColor={colors.faint} style={styles.customSubjectInput} value={topic} />

          <FieldLabel label={t('mistake.questionPhoto')} meta={t('mistake.optional')} />
          {photoUri ? (
            <View style={styles.photoPreview}>
              <QuestionPhotoImage accessibilityLabel={t('mistake.questionPhotoPreview')} uri={photoUri} resizeMode="cover" style={styles.photo} />
              <View style={styles.photoOverlay}>
                <Pressable accessibilityRole="button" onPress={() => addPhoto('library')} style={styles.photoActionDark}>
                  <Feather name="refresh-cw" size={14} color={colors.onDark} />
                  <Text style={styles.photoActionDarkText}>{t('mistake.replacePhoto')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setPhotoUri(undefined); setPhotoAnalysis(undefined); setAnalysisState('idle'); setAnalysisUsage(undefined); analysisRequestRef.current = null; }} style={styles.photoRemove}>
                  <Feather name="trash-2" size={15} color={colors.onDark} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.photoCapture, selectingPhoto && styles.photoSelecting]}>
              <View style={styles.photoIcon}><Feather name="camera" size={22} color={colors.signal} /></View>
              <Text style={styles.photoTitle}>{t('mistake.photoTitle')}</Text>
              <Text style={styles.photoBody}>{t('mistake.photoBody')}</Text>
              <View style={styles.photoActions}>
                <Pressable accessibilityRole="button" onPress={() => addPhoto('camera')} style={styles.photoActionPrimary}>
                  <Feather name="camera" size={15} color={colors.onAccent} />
                  <Text style={styles.photoActionPrimaryText}>{t('mistake.takePhoto')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => addPhoto('library')} style={styles.photoActionSecondary}>
                  <Feather name="image" size={15} color={colors.ink} />
                  <Text style={styles.photoActionSecondaryText}>{t('mistake.choosePhoto')}</Text>
                </Pressable>
              </View>
            </View>
          )}
          {photoError && <Text accessibilityRole="alert" style={styles.photoError}>{t(photoError === 'permission' ? 'mistake.photoPermission' : photoError === 'limit' ? 'mistake.photoDailyLimit' : 'mistake.photoError')}</Text>}

          {photoUri && (
            <View style={styles.analysisSection}>
              {!photoAnalysis && (
                <View style={styles.analysisIntro}>
                  <View style={styles.analysisIntroTop}>
                    <View style={styles.analysisGlyph}>{analysisState === 'loading' ? <ActivityIndicator color={colors.signal} /> : <Feather name="cpu" size={18} color={colors.signal} />}</View>
                    <View style={styles.analysisIntroCopy}><Text style={styles.analysisTitle}>{t('mistake.analyzeTitle')}</Text><Text style={styles.analysisBody}>{t('mistake.analyzeBody')}</Text></View>
                  </View>
                  <Text style={styles.privacyNote}>{t('mistake.analysisPrivacy')}</Text>
                  {analysisUsage && <Text style={styles.privacyNote}>{t('mistake.analysisUsage', { used: analysisUsage.usedToday, limit: analysisUsage.dailyLimit })}</Text>}
                  <Pressable accessibilityRole="button" disabled={analysisState === 'loading'} onPress={analyzePhoto} style={[styles.analyzeButton, analysisState === 'loading' && styles.photoSelecting]}>
                    <Text style={styles.analyzeButtonText}>{analysisState === 'loading' ? t('mistake.analyzing') : t('mistake.analyzePhoto')}</Text>
                    <Feather name="arrow-right" size={16} color={colors.onAccent} />
                  </Pressable>
                  {(analysisState === 'unavailable' || !isMistakeAnalysisConfigured) && <Text accessibilityRole="alert" style={styles.analysisError}>{t('mistake.analysisUnavailable')}</Text>}
                  {analysisState === 'error' && <><Text accessibilityRole="alert" style={styles.analysisError}>{t(analysisError === 'limit-reached' ? 'mistake.analysisLimitReached' : analysisError === 'rate-limit' ? 'mistake.analysisRateLimit' : analysisError === 'invalid-image' ? 'mistake.analysisInvalidImage' : analysisError === 'unauthorized' ? 'mistake.analysisSignIn' : 'mistake.analysisFailed')}</Text>{analysisError === 'limit-reached' && onOpenPro && <Pressable accessibilityRole="button" onPress={onOpenPro} style={styles.retryAnalysis}><Text style={styles.retryAnalysisText}>{t('mistake.viewPro')}</Text></Pressable>}</>}
                </View>
              )}
              {photoAnalysis && <AnalysisResult analysis={photoAnalysis} onRetry={() => { setPhotoAnalysis(undefined); setAnalysisState('idle'); setAnalysisUsage(undefined); analysisRequestRef.current = null; }} />}
            </View>
          )}

          <FieldLabel label={t('mistake.note')} />
          <TextInput
            accessibilityLabel={t('mistake.note')}
            multiline
            onChangeText={(value) => { setNote(value); setError(false); setSaveError(false); }}
            placeholder={t('mistake.notePlaceholder')}
            placeholderTextColor={colors.faint}
            style={[styles.input, error && !hasMistakeEvidence({ note, photoUri }) && styles.inputError]}
            textAlignVertical="top"
            value={note}
          />

          <FieldLabel label={t('mistake.cause')} meta={t('mistake.optional')} />
          <View style={styles.causeList}>
            {CAUSE_OPTIONS.map((option) => {
              const selected = cause === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setCause(selected ? undefined : option.id)}
                  style={[styles.causeOption, selected && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{t(option.labelKey)}</Text>
                  <View style={[styles.marker, selected && styles.markerSelected]}>{selected && <Feather name="check" size={12} color={colors.onAccent} />}</View>
                </Pressable>
              );
            })}
          </View>

          {error && <Text accessibilityRole="alert" style={styles.error}>{t('mistake.required')}</Text>}
          {saveError && <Text accessibilityRole="alert" style={styles.error}>{t('mistake.saveFailed')}</Text>}
          <View style={[styles.submit, saving && styles.saving]}>
            <PrimaryButton disabled={saving} label={t('mistake.save')} meta={t('mistake.saveMeta')} tone="risk" onPress={submit} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <View style={styles.fieldLabel}>
      <Text style={styles.fieldLabelText}>{label}</Text>
      {meta && <Text style={styles.fieldMeta}>{meta}</Text>}
    </View>
  );
}

function AnalysisResult({ analysis, onRetry }: { analysis: QuestionPhotoAnalysis; onRetry: () => void }) {
  const { t } = useTranslation();
  const identified = analysis.status === 'identified';
  return (
    <View style={[styles.analysisResult, identified ? styles.analysisIdentified : styles.analysisInsufficient]}>
      <View style={styles.analysisResultTop}>
        <View style={[styles.analysisStatusDot, { backgroundColor: identified ? colors.mastered : colors.recovering }]} />
        <Text style={styles.analysisStatus}>{t(identified ? 'mistake.analysisIdentified' : 'mistake.analysisInsufficient')}</Text>
        <Text style={styles.analysisConfidence}>{t(`mistake.confidence.${analysis.confidence}`)}</Text>
      </View>
      <Text style={styles.analysisSummary}>{analysis.errorSummary}</Text>
      <Text style={styles.analysisExplanation}>{analysis.explanation}</Text>
      {analysis.correctionSteps.length > 0 && (
        <View style={styles.analysisSteps}>{analysis.correctionSteps.map((step, index) => <View key={`${index}-${step}`} style={styles.analysisStep}><Text style={styles.analysisStepIndex}>{String(index + 1).padStart(2, '0')}</Text><Text style={styles.analysisStepText}>{step}</Text></View>)}</View>
      )}
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryAnalysis}><Feather name="refresh-cw" size={13} color={colors.signal} /><Text style={styles.retryAnalysisText}>{t('mistake.analyzeAgain')}</Text></Pressable>
      <Text style={styles.aiDisclaimer}>{t('mistake.aiDisclaimer')}</Text>
    </View>
  );
}

function safeSuccessHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  screen: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  topLine: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.sm },
  closeButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  closeText: { color: colors.ink, fontFamily: type.semibold, fontSize: 12 },
  overline: { color: colors.risk, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 38, lineHeight: 42, letterSpacing: -1.8, marginTop: spacing.xl },
  body: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm },
  fieldLabelText: { color: colors.ink, fontFamily: type.bold, fontSize: 13 },
  fieldMeta: { color: colors.faint, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 1 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subjectOption: { width: '48%', minHeight: 50, backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  causeList: { gap: 6 },
  causeOption: { minHeight: 50, backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  optionSelected: { backgroundColor: colors.signal, borderColor: colors.signal },
  optionText: { color: colors.ink, fontFamily: type.semibold, fontSize: 12, textAlign: 'center', flexShrink: 1 },
  optionTextSelected: { color: colors.onAccent },
  marker: { width: 20, height: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  markerSelected: { borderColor: colors.onAccent },
  input: { minHeight: 126, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper, fontFamily: type.regular, fontSize: 14, lineHeight: 21, padding: spacing.md },
  inputError: { borderColor: colors.risk },
  customSubjectInput: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper, fontFamily: type.regular, fontSize: 14, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  photoCapture: { minHeight: 184, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  photoSelecting: { opacity: 0.55 },
  photoIcon: { width: 48, height: 48, borderRadius: 25, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' },
  photoTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 15, marginTop: spacing.sm },
  photoBody: { color: colors.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  photoActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, width: '100%' },
  photoActionPrimary: { flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.signal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.sm },
  photoActionPrimaryText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 11 },
  photoActionSecondary: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.sm },
  photoActionSecondaryText: { color: colors.ink, fontFamily: type.bold, fontSize: 11 },
  photoPreview: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.elevated },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  photoActionDark: { minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.nav, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: spacing.md },
  photoActionDarkText: { color: colors.onDark, fontFamily: type.bold, fontSize: 10 },
  photoRemove: { width: 44, height: 44, borderRadius: 23, backgroundColor: colors.nav, alignItems: 'center', justifyContent: 'center' },
  photoError: { color: colors.risk, fontFamily: type.semibold, fontSize: 11, lineHeight: 17, marginTop: spacing.xs },
  analysisSection: { marginTop: spacing.sm },
  analysisIntro: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.darkLine, backgroundColor: colors.nav, padding: spacing.md },
  analysisIntroTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  analysisGlyph: { width: 42, height: 42, borderRadius: 22, backgroundColor: colors.navRaised, borderWidth: 1, borderColor: colors.darkLine, alignItems: 'center', justifyContent: 'center' },
  analysisIntroCopy: { flex: 1 },
  analysisTitle: { color: colors.onDark, fontFamily: type.bold, fontSize: 14 },
  analysisBody: { color: colors.darkMuted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 3 },
  privacyNote: { color: colors.darkMuted, fontFamily: type.mono, fontSize: 7, lineHeight: 12, letterSpacing: 0.3, marginTop: spacing.sm },
  analyzeButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.signal, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginTop: spacing.md },
  analyzeButtonText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 12 },
  analysisError: { color: colors.risk, fontFamily: type.semibold, fontSize: 10, lineHeight: 16, marginTop: spacing.sm },
  analysisResult: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  analysisIdentified: { backgroundColor: colors.masteredWash, borderColor: colors.mastered },
  analysisInsufficient: { backgroundColor: colors.recoveringWash, borderColor: colors.recovering },
  analysisResultTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  analysisStatusDot: { width: 7, height: 7, borderRadius: 4 },
  analysisStatus: { color: colors.ink, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.9, flex: 1 },
  analysisConfidence: { color: colors.muted, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.6 },
  analysisSummary: { color: colors.ink, fontFamily: type.extraBold, fontSize: 19, lineHeight: 25, marginTop: spacing.md },
  analysisExplanation: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 19, marginTop: spacing.xs },
  analysisSteps: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  analysisStep: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  analysisStepIndex: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, width: 22 },
  analysisStepText: { color: colors.inkSoft, fontFamily: type.semibold, fontSize: 11, lineHeight: 17, flex: 1 },
  retryAnalysis: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.sm },
  retryAnalysisText: { color: colors.signal, fontFamily: type.bold, fontSize: 10 },
  aiDisclaimer: { color: colors.faint, fontFamily: type.mono, fontSize: 7, lineHeight: 12, letterSpacing: 0.3 },
  error: { color: colors.risk, fontFamily: type.semibold, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  submit: { marginTop: spacing.xl },
  saving: { opacity: 0.55 },
}));
