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
import { Animated, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from './src/components/BrandMark';
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
import { AppDataProvider, useAppData } from './src/state';
import { RevenueCatProvider } from './src/revenuecat';
import { animationDriver, colors, createThemedStyles, motion, type } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <ThemeProvider>
          <RevenueCatProvider>
            <AppDataProvider><MistakeApp /></AppDataProvider>
          </RevenueCatProvider>
        </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

function MistakeApp() {
  const { mode } = useTheme();
  const { onboarding, mistakes, exams, reviewEvidence, completeOnboarding, skipOnboarding, resetOnboarding, addMistake, addExam, removeExam, recordNeverAgainReview } = useAppData();
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
  const [reviewSubject, setReviewSubject] = useState<SubjectId | null>(null);
  const [onboardingSource, setOnboardingSource] = useState<'first_launch' | 'settings_reset'>('first_launch');

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

  if (!fontsLoaded) return <LoadingScreen />;

  if (!onboarding) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OnboardingFlow
          source={onboardingSource}
          onComplete={async (answers, action) => {
            await completeOnboarding(answers);
            if (action === 'add') {
              setMistakeSource('onboarding');
              setShowMistakeForm(true);
            }
          }}
          onSkip={skipOnboarding}
        />
      </SafeAreaView>
    );
  }

  if (showMistakeForm) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <MistakeFormScreen
          defaultSubjects={onboarding.answers.subjects}
          onCancel={() => { setShowMistakeForm(false); setActiveTab('home'); }}
          onOpenPro={() => { setShowMistakeForm(false); setShowPro(true); }}
          onSave={async (draft) => {
            await addMistake(draft, mistakeSource);
            setShowMistakeForm(false);
            setActiveTab('home');
          }}
        />
      </SafeAreaView>
    );
  }

  if (showPro) {
    return <SafeAreaView style={styles.safe}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><ProScreen onBack={() => setShowPro(false)} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AmbientField />
      <Animated.View style={[styles.content, { opacity }]}>
        {activeTab === 'home' && (
          <HomeScreen
            mistakes={mistakes}
            initialProfile={onboarding.profile}
            exams={exams}
            reviewEvidence={reviewEvidence}
            onLogMistake={() => { setMistakeSource('home'); setShowMistakeForm(true); }}
            onDna={() => switchTab('dna')}
            onStartReview={openTopicReview}
            onOpenPrepMap={() => switchTab('prepMap')}
          />
        )}
        {activeTab === 'review' && <ReviewScreen mistakes={mistakes} initialSubject={reviewSubject} onCompleteReview={recordNeverAgainReview} onDone={() => { setReviewSubject(null); switchTab('home'); }} onExit={() => { setReviewSubject(null); switchTab('home'); }} />}
        {activeTab === 'dna' && <DnaScreen mistakes={mistakes} initialProfile={onboarding.profile} />}
        {activeTab === 'prepMap' && <ExamPrepMapScreen exams={exams} mistakes={mistakes} reviewEvidence={reviewEvidence} onOpenExams={() => switchTab('exams')} onAddMistake={() => { setMistakeSource('home'); setShowMistakeForm(true); }} onStartReview={openTopicReview} />}
        {activeTab === 'exams' && <ExamsScreen exams={exams} onSave={addExam} onRemove={removeExam} onOpenPrepMap={() => switchTab('prepMap')} />}
        {activeTab === 'settings' && (
          <SettingsScreen
            onOpenPro={() => setShowPro(true)}
            onResetOnboarding={async () => {
              setOnboardingSource('settings_reset');
              await resetOnboarding();
            }}
          />
        )}
      </Animated.View>
      {activeTab !== 'review' && <TabBar active={activeTab} onChange={switchTab} />}
    </SafeAreaView>
  );
}

function LoadingScreen() {
  const { t } = useTranslation();
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: animationDriver }),
      Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: animationDriver }),
    ])).start();
  }, [pulse]);

  return (
    <View style={styles.loading}>
      <Animated.View style={{ opacity: pulse }}><BrandMark inverse /></Animated.View>
      <Text style={styles.loadingText}>{t('loading.calibrating')}</Text>
    </View>
  );
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
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1 },
  ambientField: { pointerEvents: 'none' },
  loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 18 },
  loadingText: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.6 },
  ambientOne: { position: 'absolute', width: 460, height: 460, borderRadius: 260, borderWidth: 1, borderColor: colors.violet, opacity: 0.13, top: -260, right: -230 },
  ambientTwo: { position: 'absolute', width: 330, height: 330, borderRadius: 200, borderWidth: 1, borderColor: colors.signal, opacity: 0.1, bottom: 72, left: -230 },
  gridLineOne: { position: 'absolute', width: 1, top: 0, bottom: 0, left: '8%', backgroundColor: colors.line, opacity: 0.28 },
  gridLineTwo: { position: 'absolute', width: 1, top: 0, bottom: 0, right: '8%', backgroundColor: colors.line, opacity: 0.28 },
}));
