import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { trackEvent } from '../analytics';
import { createExam, ExamDraft, ExamRecord, ExamStore } from '../exams';
import { PrepMapEvidenceStore, type ReviewEvidence } from '../prepMap';
import { createMistake, MistakeDraft, MistakeRecord, MistakeStore } from '../mistakes';
import { OnboardingAnswers, OnboardingRecord, OnboardingStore } from '../onboarding';
import { colors } from '../theme';
import { ExamRepository, MistakeRepository, RecoveryRepository, type RecoveryEvidence } from '../repositories';
import { supabase } from '../supabase';
import { clearPersonalLearningData, ensureFreshLocalCache } from './localReset';
import { useEntitlements } from '../entitlements';
import { DailyPhotoUsageStore, type DailyPhotoUsage } from '../photoUsage';
import { emptyOfficialExamPrepData, ExamPrepRepository, type OfficialExamPrepData } from '../examPrep';
import { useTranslation } from '../i18n';
import { useAuth } from '../auth';

type MistakeSource = 'onboarding' | 'home';

type AppDataValue = {
  onboarding: OnboardingRecord | null;
  mistakes: MistakeRecord[];
  exams: ExamRecord[];
  reviewEvidence: ReviewEvidence;
  officialExamPrep: OfficialExamPrepData;
  selectExamTarget: (catalogVersionId: string) => Promise<boolean>;
  reloadExamPrep: () => Promise<void>;
  completeOnboarding: (answers: OnboardingAnswers) => Promise<OnboardingRecord>;
  skipOnboarding: (stage: string) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  addMistake: (draft: MistakeDraft, source: MistakeSource) => Promise<MistakeRecord>;
  addExam: (draft: ExamDraft) => Promise<ExamRecord>;
  removeExam: (exam: ExamRecord) => Promise<void>;
  recordNeverAgainReview: (mistakeIds: readonly string[], subject: string, recovery?: RecoveryEvidence, resisted?: boolean) => Promise<void>;
  photoUsage: DailyPhotoUsage;
  consumePhotoSlot: () => Promise<boolean>;
  clearPersonalData: () => Promise<void>;
};

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { level } = useEntitlements();
  const { language } = useTranslation();
  const { account } = useAuth();
  const [onboardingStore] = useState(() => new OnboardingStore(AsyncStorage));
  const [mistakeStore] = useState(() => new MistakeStore(AsyncStorage));
  const [examStore] = useState(() => new ExamStore(AsyncStorage));
  const [prepMapEvidenceStore] = useState(() => new PrepMapEvidenceStore(AsyncStorage));
  const [mistakeRepository] = useState(() => new MistakeRepository(mistakeStore, supabase));
  const [examRepository] = useState(() => new ExamRepository(examStore, supabase));
  const [recoveryRepository] = useState(() => new RecoveryRepository(supabase));
  const [photoUsageStore] = useState(() => new DailyPhotoUsageStore(AsyncStorage));
  const [examPrepRepository] = useState(() => new ExamPrepRepository(supabase));
  const [onboarding, setOnboarding] = useState<OnboardingRecord | null>(null);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [reviewEvidence, setReviewEvidence] = useState<ReviewEvidence>({});
  const [officialExamPrep, setOfficialExamPrep] = useState<OfficialExamPrepData>(() => emptyOfficialExamPrepData('loading'));
  const [photoUsage, setPhotoUsage] = useState<DailyPhotoUsage>(() => ({ day: '', used: 0 }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const loadInitialData = async () => {
      try {
        await ensureFreshLocalCache(AsyncStorage);
        const [savedOnboarding, savedMistakes, savedExams, savedReviewEvidence, savedPhotoUsage, savedOfficialExamPrep] = await Promise.all([
          onboardingStore.load(),
          mistakeRepository.load(),
          examRepository.load(),
          prepMapEvidenceStore.load(),
          photoUsageStore.load(),
          examPrepRepository.load(language).catch(() => emptyOfficialExamPrepData('error')),
        ]);
        if (!active) return;
        setOnboarding(savedOnboarding);
        setMistakes(savedMistakes);
        setExams(savedExams);
        setReviewEvidence(savedReviewEvidence);
        setPhotoUsage(savedPhotoUsage);
        setOfficialExamPrep(savedOfficialExamPrep);
      } catch {
        // A damaged or unavailable local store must not strand the learner on
        // a blank launch screen. Stores already preserve any readable records.
        trackEvent('local_storage_unavailable', { source: 'app_boot' });
      } finally {
        if (active) setReady(true);
      }
    };
    void loadInitialData();
    return () => { active = false; };
  }, [account?.id, examPrepRepository, examRepository, language, mistakeRepository, onboardingStore, photoUsageStore, prepMapEvidenceStore]);

  useEffect(() => {
    let active = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      Promise.all([mistakeRepository.load(), examRepository.load()]).then(([nextMistakes, nextExams]) => {
        if (!active) return;
        setMistakes(nextMistakes);
        setExams(nextExams);
      }).catch(() => trackEvent('local_storage_unavailable', { source: 'resume' }));
    });
    return () => { active = false; subscription.remove(); };
  }, [examRepository, mistakeRepository]);

  const value: AppDataValue = {
    onboarding,
    mistakes,
    exams,
    reviewEvidence,
    officialExamPrep,
    reloadExamPrep: async () => {
      setOfficialExamPrep(emptyOfficialExamPrepData('loading'));
      setOfficialExamPrep(await examPrepRepository.load(language).catch(() => emptyOfficialExamPrepData('error')));
    },
    selectExamTarget: async (catalogVersionId) => {
      const selected = await examPrepRepository.selectTarget(catalogVersionId);
      if (selected) setOfficialExamPrep(await examPrepRepository.load(language));
      return selected;
    },
    completeOnboarding: async (answers) => {
      const record = await onboardingStore.complete(answers);
      setOnboarding(record);
      trackEvent('onboarding_completed', {
        subjectCount: answers.subjects.length,
        causeCount: answers.causes.length,
        goal: answers.goal ?? 'none',
      });
      return record;
    },
    skipOnboarding: async (stage) => {
      const record = await onboardingStore.skip();
      setOnboarding(record);
      trackEvent('onboarding_skipped', { stage });
    },
    resetOnboarding: async () => {
      await onboardingStore.reset();
      setOnboarding(null);
    },
    addMistake: async (draft, source) => {
      const mistake = createMistake(draft);
      const next = await mistakeRepository.add(mistake);
      setMistakes(next);
      trackEvent('mistake_created', { subject: draft.subject, cause: draft.cause, source });
      return mistake;
    },
    addExam: async (draft) => {
      const exam = createExam(draft);
      const next = await examRepository.add(exam);
      setExams(next);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduled = new Date(`${draft.date}T12:00:00`);
      trackEvent('exam_created', { subject: draft.subject, daysUntil: Math.max(0, Math.ceil((scheduled.getTime() - today.getTime()) / 86_400_000)) });
      return exam;
    },
    removeExam: async (exam) => {
      const next = await examRepository.remove(exam.id);
      setExams(next);
      trackEvent('exam_deleted', { subject: exam.subject });
    },
    recordNeverAgainReview: async (mistakeIds, subject, recovery, resisted = true) => {
      if (resisted) {
        const next = await prepMapEvidenceStore.recordReview(mistakeIds);
        setReviewEvidence(next);
      }
      if (recovery) await recoveryRepository.sync(recovery);
      trackEvent('exam_prep_map_item_completed', { subject, reviewedCount: mistakeIds.length });
    },
    photoUsage,
    consumePhotoSlot: async () => {
      try {
        const next = await photoUsageStore.consume(level);
        if (!next) return false;
        setPhotoUsage(next);
        return true;
      } catch {
        return false;
      }
    },
    clearPersonalData: async () => {
      await clearPersonalLearningData(AsyncStorage);
      setOnboarding(null);
      setMistakes([]);
      setExams([]);
      setReviewEvidence({});
      setPhotoUsage({ day: '', used: 0 });
      setOfficialExamPrep(emptyOfficialExamPrepData());
    },
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
