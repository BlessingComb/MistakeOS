import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, SafeAreaView, Share, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BrandMark } from './src/components/BrandMark';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { AuthProvider, useAuth, type AuthMode } from './src/auth';
import { trackEvent } from './src/analytics';
import { TabBar, TabId } from './src/components/TabBar';
import { I18nProvider, useTranslation } from './src/i18n';
import { MistakeFormScreen } from './src/mistakes';
import { OnboardingFlow } from './src/onboarding';
import type { SubjectId } from './src/onboarding';
import { DnaScreen } from './src/screens/DnaScreen';
import { ExamsScreen } from './src/screens/ExamsScreen';
import { ExamPrepMapScreen } from './src/screens/ExamPrepMapScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProScreen } from './src/screens/ProScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { ClassroomsScreen } from './src/screens/ClassroomsScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { AppDataProvider, useAppData } from './src/state';
import { RevenueCatProvider } from './src/revenuecat';
import { animationDriver, colors, createThemedStyles, motion, radius, spacing, type } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { resolveAuthGate, shouldShowTabBar } from './src/appFlow';

const INTRO_KEY = '@mistakeos/intro:v1';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <ThemeProvider>
          <AppErrorBoundary fallback={(retry) => <FatalErrorScreen onRetry={retry} />}>
            <AuthProvider>
              <RevenueCatProvider>
                <AppDataProvider><MistakeApp /></AppDataProvider>
              </RevenueCatProvider>
            </AuthProvider>
          </AppErrorBoundary>
        </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

function MistakeApp() {
  const { mode } = useTheme();
  const auth = useAuth();
  const { onboarding, mistakes, exams, reviewEvidence, officialExamPrep, selectExamTarget, reloadExamPrep, photoUsage, consumePhotoSlot, completeOnboarding, skipOnboarding, resetOnboarding, addMistake, addExam, removeExam, recordNeverAgainReview, clearPersonalData } = useAppData();
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [opacity] = useState(() => new Animated.Value(1));
  const [showMistakeForm, setShowMistakeForm] = useState(false);
  const [mistakeSource, setMistakeSource] = useState<'onboarding' | 'home'>('home');
  const [showPro, setShowPro] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [legalDocument, setLegalDocument] = useState<'privacy' | 'terms' | 'support' | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reviewSubject, setReviewSubject] = useState<SubjectId | null>(null);
  const [onboardingSource, setOnboardingSource] = useState<'first_launch' | 'settings_reset'>('first_launch');
  const [introReady, setIntroReady] = useState(false);
  const [introFirst, setIntroFirst] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  useEffect(() => { let mounted = true; AsyncStorage.getItem(INTRO_KEY).then((value) => { if (!mounted) return; setIntroFirst(!value); setIntroReady(true); }).catch(() => mounted && setIntroReady(true)); return () => { mounted = false; }; }, []);

  const switchTab = (tab: TabId) => {
    if (tab === activeTab) return;
    Animated.timing(opacity, { toValue: 0, duration: motion.fast, useNativeDriver: animationDriver }).start(() => {
      setActiveTab(tab);
      Animated.timing(opacity, { toValue: 1, duration: motion.standard, useNativeDriver: animationDriver }).start();
    });
  };

  const openTopicReview = (subject: SubjectId) => {
    setReviewSubject(subject);
    switchTab('review');
  };

  if (!fontsLoaded || !introReady) return <LoadingScreen />;
  if (introFirst) return <IntroSplash onDone={() => { AsyncStorage.setItem(INTRO_KEY, 'seen').catch(() => undefined); setIntroFirst(false); }} />;

  const authGate = resolveAuthGate({ status: auth.status, hasAccount: Boolean(auth.account), passwordRecovery: auth.passwordRecovery });
  if (authGate === 'loading') return <LoadingScreen />;
  if (authGate === 'passwordRecovery') {
    return <SafeAreaView style={styles.safe}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><AccountScreen onAccountDeleted={clearPersonalData} /></SafeAreaView>;
  }
  if (authGate === 'visitor') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        {authMode
          ? <AccountScreen initialMode={authMode} onBack={() => setAuthMode(null)} />
          : <WelcomeScreen onChooseMode={setAuthMode} />}
      </SafeAreaView>
    );
  }

  if (showOnboarding) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OnboardingFlow
          source={onboardingSource}
          onComplete={async (answers, action) => {
            await completeOnboarding(answers);
            setShowOnboarding(false);
            if (action === 'add') {
              setMistakeSource('onboarding');
              setShowMistakeForm(true);
            }
          }}
          onSkip={async (stage) => {
            await skipOnboarding(stage);
            setShowOnboarding(false);
          }}
        />
      </SafeAreaView>
    );
  }

  if (showMistakeForm) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <MistakeFormScreen
          defaultSubjects={onboarding?.answers.subjects ?? []}
          photoUsage={photoUsage}
          onConsumePhotoSlot={consumePhotoSlot}
          onCancel={() => { setShowMistakeForm(false); setActiveTab('home'); }}
          onOpenPro={() => { setShowMistakeForm(false); setShowPro(true); }}
          onSave={async (draft) => {
            await addMistake(draft, mistakeSource);
            setShowMistakeForm(false);
            setActiveTab('home');
          }}
        />
        {shouldShowTabBar('mistakeForm') && <TabBar active={activeTab} onChange={(tab) => { setShowMistakeForm(false); switchTab(tab); }} />}
      </SafeAreaView>
    );
  }

  if (showPro) {
    return <SafeAreaView style={styles.safe}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><ProScreen onBack={() => setShowPro(false)} /></SafeAreaView>;
  }

  if (showAccount) {
    return <SafeAreaView style={styles.safe}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><AccountScreen onBack={() => setShowAccount(false)} onAccountDeleted={clearPersonalData} /></SafeAreaView>;
  }

  if (legalDocument) {
    return <SafeAreaView style={styles.safe}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><LegalScreen document={legalDocument} onBack={() => setLegalDocument(null)} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AmbientField />
      <Animated.View style={[styles.content, { opacity }]}>
        {activeTab === 'home' && (
          <HomeScreen
            officialExamPrep={officialExamPrep}
            onLogMistake={() => { setMistakeSource('home'); setShowMistakeForm(true); }}
            onDna={() => switchTab('dna')}
            onOpenPrepMap={() => switchTab('prepMap')}
            onOpenExams={() => switchTab('exams')}
            onOpenClassrooms={() => switchTab('classrooms')}
            onOpenReview={() => switchTab('review')}
          />
        )}
        {activeTab === 'review' && <ReviewScreen mistakes={mistakes} initialSubject={reviewSubject} onCompleteReview={recordNeverAgainReview} onDone={() => { setReviewSubject(null); switchTab('home'); }} onExit={() => { setReviewSubject(null); switchTab('home'); }} />}
        {activeTab === 'dna' && <DnaScreen mistakes={mistakes} initialProfile={onboarding?.profile ?? null} />}
        {activeTab === 'prepMap' && <ExamPrepMapScreen exams={exams} mistakes={mistakes} reviewEvidence={reviewEvidence} officialExamPrep={officialExamPrep} onSelectExamTarget={selectExamTarget} onReloadExamPrep={reloadExamPrep} onOpenExams={() => switchTab('exams')} onAddMistake={() => { setMistakeSource('home'); setShowMistakeForm(true); }} onStartReview={openTopicReview} />}
        {activeTab === 'exams' && <ExamsScreen exams={exams} onSave={addExam} onRemove={removeExam} onOpenPrepMap={() => switchTab('prepMap')} />}
        {activeTab === 'classrooms' && <ClassroomsScreen catalogs={officialExamPrep.catalogs} />}
        {activeTab === 'settings' && (
          <SettingsScreen
            onOpenPro={() => setShowPro(true)}
            onOpenAccount={() => { trackEvent('account_screen_viewed', { source: 'settings' }); setShowAccount(true); }}
            onOpenPrepMap={() => switchTab('prepMap')}
            onOpenExams={() => switchTab('exams')}
            onOpenLegal={setLegalDocument}
            onExportData={async () => {
              try {
                await Share.share({
                  title: 'MistakeOS data export',
                  message: JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), onboarding, mistakes, exams, reviewEvidence }, null, 2),
                });
                return true;
              } catch {
                return false;
              }
            }}
            onResetOnboarding={async () => {
              setOnboardingSource('settings_reset');
              await resetOnboarding();
              setShowOnboarding(true);
            }}
          />
        )}
      </Animated.View>
      {shouldShowTabBar('review') && <TabBar active={activeTab} onChange={switchTab} />}
    </SafeAreaView>
  );
}

function IntroSplash({ onDone }: { onDone: () => void }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [text, setText] = useState('M•••••••');
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined); }, []);
  useEffect(() => {
    if (reduceMotion) { setText('MistakeOS'); opacity.value = withTiming(1, { duration: 180 }); const timer = setTimeout(onDone, 420); return () => clearTimeout(timer); }
    const target = 'MistakeOS'; const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let step = 0;
    opacity.value = withTiming(1, { duration: 220 }); scale.value = withTiming(1, { duration: 520 });
    const timer = setInterval(() => { step += 1; setText(target.split('').map((char, index) => index < step ? char : chars[(step * 7 + index * 3) % chars.length]).join('')); if (step >= target.length) { clearInterval(timer); Haptics.selectionAsync().catch(() => undefined); setTimeout(onDone, 520); } }, 72);
    return () => clearInterval(timer);
  }, [reduceMotion]);
  const markStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <LinearGradient colors={[colors.canvas, colors.nav, colors.black]} style={introStyles.root}><View style={introStyles.glowOne} /><View style={introStyles.glowTwo} /><Reanimated.View entering={FadeIn.duration(300)} style={introStyles.center}><Reanimated.Text style={[introStyles.wordmark, markStyle]}>{text}</Reanimated.Text></Reanimated.View></LinearGradient>;
}

const introStyles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, center: { alignItems: 'center' }, wordmark: { color: '#F6F8FC', fontFamily: type.extraBold, fontSize: 42, letterSpacing: -2 }, glowOne: { position: 'absolute', width: 300, height: 300, borderRadius: 180, backgroundColor: '#B35CFF', opacity: 0.12, top: -120, right: -120 }, glowTwo: { position: 'absolute', width: 260, height: 260, borderRadius: 180, backgroundColor: '#00D8F4', opacity: 0.08, bottom: -120, left: -110 } });

function LoadingScreen() {
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: animationDriver }),
      Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: animationDriver }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.loading}>
      <Animated.View style={{ opacity: pulse }}><BrandMark inverse /></Animated.View>
    </View>
  );
}

function FatalErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.fatal}>
      <StatusBar style="light" />
      <BrandMark inverse />
      <Text accessibilityRole="alert" style={styles.fatalTitle}>{t('common.unexpectedError')}</Text>
      <Text style={styles.fatalBody}>{t('common.unexpectedErrorBody')}</Text>
      <AnimatedSubmitButton label={t('common.tryAgain')} onPress={onRetry} />
    </SafeAreaView>
  );
}

function AnimatedSubmitButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.fatalButton}><Text style={styles.fatalButtonText}>{label}</Text></Pressable>;
}

function AmbientField() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.ambientField]}>
      <View style={styles.ambientOne} />
      <View style={styles.ambientTwo} />
      <View style={styles.gridLineOne} />
      <View style={styles.gridLineTwo} />
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  safe: { flex: 1, width: '100%', minWidth: 0, backgroundColor: colors.canvas, userSelect: 'none' },
  content: { flex: 1, minWidth: 0, width: '100%' },
  // Decorative circles deliberately extend beyond their frame, not the page.
  ambientField: { pointerEvents: 'none', overflow: 'hidden' },
  loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 18 },
  loadingText: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.6 },
  ambientOne: { position: 'absolute', width: 460, height: 460, borderRadius: 260, borderWidth: 1, borderColor: colors.violet, opacity: 0.13, top: -260, right: -230 },
  ambientTwo: { position: 'absolute', width: 330, height: 330, borderRadius: 200, borderWidth: 1, borderColor: colors.signal, opacity: 0.1, bottom: 72, left: -230 },
  gridLineOne: { position: 'absolute', width: 1, top: 0, bottom: 0, left: '8%', backgroundColor: colors.line, opacity: 0.28 },
  gridLineTwo: { position: 'absolute', width: 1, top: 0, bottom: 0, right: '8%', backgroundColor: colors.line, opacity: 0.28 },
  fatal: { flex: 1, padding: spacing.xl, backgroundColor: colors.canvas, justifyContent: 'center', alignItems: 'center' },
  fatalTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 28, letterSpacing: -1, textAlign: 'center', marginTop: spacing.xl },
  fatalBody: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.sm, maxWidth: 360 },
  fatalButton: { minHeight: 48, minWidth: 160, borderRadius: radius.md, backgroundColor: colors.signal, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  fatalButtonText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 14, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
}));
