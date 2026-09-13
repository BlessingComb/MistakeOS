import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Dimensions, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuth, type AuthMode, type AuthValidationError } from '../auth';
import { BrandMark } from '../components/BrandMark';
import { useTranslation, type TranslationKey } from '../i18n';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Props = { onBack?: () => void; lockedToSignUp?: boolean; onAccountDeleted?: () => Promise<void> };

const validationKeys: Record<Exclude<AuthValidationError, null>, TranslationKey> = {
  name: 'account.invalidName',
  email: 'account.invalidEmail',
  password: 'account.invalidPassword',
  passwordConfirmation: 'account.passwordMismatch',
};

const AnimatedSubmit = Animated.createAnimatedComponent(Pressable);
type AuthFieldId = 'name' | 'email' | 'password' | 'confirmation';

export function AccountScreen({ onBack, lockedToSignUp = false, onAccountDeleted }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const { account, status, submit, signOut, deleteAccount, passwordRecovery, requestPasswordReset, completePasswordReset } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signUp');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const nameFieldRef = useRef<View>(null);
  const emailFieldRef = useRef<View>(null);
  const passwordFieldRef = useRef<View>(null);
  const confirmationFieldRef = useRef<View>(null);
  const focusedFieldRef = useRef<AuthFieldId | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardTopRef = useRef<number | null>(null);
  const compactLayout = windowHeight <= 780;
  // Closed auth is a fixed screen. Only the keyboard may unlock vertical
  // scrolling so the focused input can remain visible on compact devices.
  const scrollEnabled = keyboardVisible;
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => undefined); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion); return () => sub.remove(); }, []);
  const reveal = (delay: number) => reducedMotion ? undefined : FadeInDown.duration(280).delay(delay).springify().damping(18);

  const scrollFocusedFieldIntoView = useCallback((field: AuthFieldId | null) => {
    const container = field === 'name' ? nameFieldRef : field === 'email' ? emailFieldRef : field === 'password' ? passwordFieldRef : field === 'confirmation' ? confirmationFieldRef : null;
    if (!container?.current) return;
    container.current.measureInWindow((_x, y, _width, height) => {
      const visibleTop = 12;
      const visibleBottom = (keyboardTopRef.current ?? Dimensions.get('window').height) - 16;
      const bottom = y + height;
      const delta = bottom > visibleBottom ? bottom - visibleBottom : y < visibleTop ? y - visibleTop : 0;
      if (delta !== 0) scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffsetRef.current + delta), animated: true });
    });
  }, []);

  const handleFieldFocus = useCallback((field: AuthFieldId) => {
    focusedFieldRef.current = field;
    scrollFocusedFieldIntoView(field);
  }, [scrollFocusedFieldIntoView]);

  useEffect(() => {
    const shown = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      setKeyboardVisible(true);
      scrollFocusedFieldIntoView(focusedFieldRef.current);
    });
    const hidden = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTopRef.current = null;
      setKeyboardVisible(false);
    });
    return () => { shown.remove(); hidden.remove(); };
  }, [scrollFocusedFieldIntoView]);

  const chooseMode = (next: AuthMode) => {
    if (next === mode) return;
    Haptics.selectionAsync().catch(() => undefined);
    setMode(next);
    setNotice(null);
  };

  const submitForm = async () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.info('[AUTH_SUBMIT] BUTTON_PRESSED');
    setNotice(null);
    setBusy(true);
    const response = await submit(mode, { displayName, email, password, passwordConfirmation });
    setBusy(false);
    if (response.result === 'signed_in') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setPassword('');
      setPasswordConfirmation('');
      setNotice('account.signedIn');
      return;
    }
    if (response.result === 'confirmation_sent') {
      setPassword('');
      setPasswordConfirmation('');
      setNotice('account.confirmationSent');
      return;
    }
    if (response.result === 'validation_error' && response.field) {
      setNotice(validationKeys[response.field]);
      return;
    }
    setNotice(response.result === 'unavailable' ? 'account.unavailableBody' : mode === 'signUp' ? 'account.signupError' : 'account.signinError');
  };

  const handleSignOut = async () => {
    setBusy(true);
    const succeeded = await signOut();
    setBusy(false);
    setNotice(succeeded ? 'account.signedOut' : 'account.signoutError');
  };
  const handleDeleteAccount = () => {
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('account.deleteCancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const deleted = await deleteAccount();
          if (deleted) await onAccountDeleted?.();
          setBusy(false);
          setNotice(deleted ? 'account.deleted' : 'account.deleteError');
        },
      },
    ]);
  };

  const handlePasswordResetRequest = async () => {
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    setNotice(result === 'sent' ? 'account.resetSent' : result === 'invalid_email' ? 'account.invalidEmail' : result === 'unavailable' ? 'account.unavailableBody' : 'account.resetError');
  };

  if (passwordRecovery) {
    return <PasswordRecoveryScreen onBack={onBack} onComplete={completePasswordReset} />;
  }

  if (account && !account.isAnonymous) {
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.screen}>
          <TopBar onBack={onBack} label="" backLabel={t('account.back')} />
          <View style={styles.identityCard}>
            <View style={styles.identityOrbit}><Feather name="shield" size={23} color={colors.signal} /></View>
            <Text style={styles.identityKicker}>{t('account.activeEyebrow')}</Text>
            <Text style={styles.identityTitle}>{t('account.activeTitle')}</Text>
            <Text style={styles.email}>{account.email ?? t('account.emailUnavailable')}</Text>
            <View style={styles.verifiedRow}><View style={styles.verifiedDot} /><Text style={styles.verifiedText}>{t('account.accountProtected')}</Text></View>
          </View>
          <Text style={styles.explainer}>{t('account.activeBody')}</Text>
          {notice && <Notice label={t(notice)} tone={notice === 'account.signedOut' ? 'success' : 'neutral'} />}
          <Pressable accessibilityRole="button" disabled={busy} onPress={handleSignOut} style={[styles.signOut, busy && styles.disabled]}>
            <Feather name="log-out" size={17} color={colors.ink} />
            <Text style={styles.signOutText}>{busy ? t('account.signingOut') : t('account.signOut')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('account.deleteAccount')} disabled={busy} onPress={handleDeleteAccount} style={[styles.deleteAccount, busy && styles.disabled]}>
            <Feather name="trash-2" size={16} color={colors.riskDeep} />
            <Text style={styles.deleteAccountText}>{t('account.deleteAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const isUnavailable = status === 'unavailable';
  return (
    <LinearGradient colors={[colors.canvas, colors.nav, colors.black]} locations={[0, 0.55, 1]} style={styles.flex}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled} alwaysBounceVertical={false} overScrollMode="never" scrollEventThrottle={16} onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}>
        <View style={[styles.screen, compactLayout && styles.screenCompact]}>
          <View pointerEvents="none" style={styles.ambient}><View style={styles.glowA} /><View style={styles.glowB} /></View>
          {!compactLayout && <TopBar onBack={onBack} label="" backLabel={t('account.back')} />}
          {!compactLayout && <View style={styles.progress} accessibilityLabel="Account setup progress"><View style={[styles.progressDot, styles.progressActive]} /><View style={styles.progressLine} /><View style={styles.progressDot} /><View style={styles.progressLine} /><View style={styles.progressDot} /></View>}
          <Animated.View entering={reveal(60)} style={[styles.brandSpace, compactLayout && styles.brandSpaceCompact]}><BrandMark /><View style={styles.signalDot} /></Animated.View>
          <Animated.Text entering={reveal(120)} style={[styles.title, compactLayout && styles.titleCompact]}>{t(mode === 'signUp' ? 'account.createTitle' : 'account.signInTitle').toUpperCase()}</Animated.Text>
          <Animated.Text entering={reveal(170)} style={[styles.lead, compactLayout && styles.leadCompact]}>{t(mode === 'signUp' ? 'account.createBody' : 'account.signInBody')}</Animated.Text>

          {!lockedToSignUp && <View style={[styles.modeSwitch, compactLayout && styles.modeSwitchCompact]} accessibilityRole="tablist">
            {(['signUp', 'signIn'] as const).map((option) => {
              const selected = option === mode;
              return <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => chooseMode(option)} style={[styles.modeOption, selected && styles.modeOptionSelected]}><Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{t(option === 'signUp' ? 'account.createTab' : 'account.signInTab')}</Text></Pressable>;
            })}
          </View>}

          {mode === 'signUp' && <Animated.View key="auth-name" entering={reveal(220)}><Field compact={compactLayout} containerRef={nameFieldRef} onFieldFocus={() => handleFieldFocus('name')} inputRef={nameRef} label={t('account.name')} value={displayName} onChangeText={setDisplayName} placeholder={t('account.namePlaceholder')} autoCapitalize="words" autoComplete="off" importantForAutofill="no" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => emailRef.current?.focus()} /></Animated.View>}
          <Animated.View key="auth-email" entering={reveal(270)}><Field compact={compactLayout} containerRef={emailFieldRef} onFieldFocus={() => handleFieldFocus('email')} inputRef={emailRef} label={t('account.email')} value={email} onChangeText={setEmail} placeholder={t('account.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="off" importantForAutofill="no" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} /></Animated.View>
          <Animated.View key="auth-password" entering={reveal(320)}><PasswordField compact={compactLayout} containerRef={passwordFieldRef} onFieldFocus={() => handleFieldFocus('password')} inputRef={passwordRef} label={t('account.password')} value={password} onChangeText={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} showLabel={t('account.showPassword')} hideLabel={t('account.hidePassword')} hint={mode === 'signUp' ? t('account.passwordHint') : undefined} autoComplete="off" importantForAutofill="no" returnKeyType={mode === 'signUp' ? 'next' : 'done'} onSubmitEditing={mode === 'signUp' ? () => confirmationRef.current?.focus() : undefined} /></Animated.View>
          {mode === 'signUp' && <Animated.View key="auth-confirmation" entering={reveal(370)}><PasswordField compact={compactLayout} containerRef={confirmationFieldRef} onFieldFocus={() => handleFieldFocus('confirmation')} inputRef={confirmationRef} label={t('account.confirmPassword')} value={passwordConfirmation} onChangeText={setPasswordConfirmation} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} showLabel={t('account.showPassword')} hideLabel={t('account.hidePassword')} autoComplete="off" importantForAutofill="no" returnKeyType="done" /></Animated.View>}

          {notice && <Notice label={t(notice)} tone={notice === 'account.confirmationSent' || notice === 'account.signedIn' ? 'success' : 'error'} />}
          {isUnavailable && <Notice label={t('account.unavailableBody')} tone="error" />}

          <AnimatedSubmit accessibilityRole="button" disabled={busy || isUnavailable} onPress={submitForm} style={[styles.submit, compactLayout && styles.submitCompact, (busy || isUnavailable) && styles.disabled]} entering={reveal(420)}>
            <Text style={styles.submitText}>{busy ? t('account.working') : t(mode === 'signUp' ? 'account.createCta' : 'account.signInCta')}</Text>
            <Feather name="arrow-up-right" size={18} color={colors.onAccent} />
          </AnimatedSubmit>
          {mode === 'signIn' && <Pressable accessibilityRole="button" disabled={busy} style={[styles.secondaryAction, compactLayout && styles.secondaryActionCompact]} onPress={handlePasswordResetRequest}><Text style={styles.secondaryText}>{t('account.forgotPassword')}</Text></Pressable>}
          <Pressable style={[styles.secondaryAction, compactLayout && styles.secondaryActionCompact]} onPress={() => chooseMode(mode === 'signUp' ? 'signIn' : 'signUp')}><Text style={styles.secondaryText}>{t(mode === 'signUp' ? 'account.haveAccount' : 'account.needAccount')}</Text></Pressable>
          <Text style={[styles.privacy, compactLayout && styles.privacyCompact]}>{t('account.privacy')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function PasswordRecoveryScreen({ onBack, onComplete }: { onBack?: () => void; onComplete: (password: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const save = async () => {
    if (password.length < 8) return setNotice('account.invalidPassword');
    if (password !== confirmation) return setNotice('account.passwordMismatch');
    setBusy(true);
    const complete = await onComplete(password);
    setBusy(false);
    setPassword('');
    setConfirmation('');
    setNotice(complete ? 'account.passwordUpdated' : 'account.passwordUpdateError');
  };
  return <LinearGradient colors={[colors.canvas, colors.nav, colors.black]} locations={[0, 0.55, 1]} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.screen}><TopBar onBack={onBack} label="" backLabel={t('account.back')} /><View style={styles.brandSpace}><BrandMark /></View><Text style={styles.title}>{t('account.resetTitle').toUpperCase()}</Text><Text style={styles.lead}>{t('account.resetBody')}</Text><View style={styles.field}><Text style={styles.fieldLabel}>{t('account.password')}</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" placeholder="••••••••" placeholderTextColor={colors.faint} style={styles.input} /></View><View style={styles.field}><Text style={styles.fieldLabel}>{t('account.confirmPassword')}</Text><TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" placeholder="••••••••" placeholderTextColor={colors.faint} style={styles.input} onSubmitEditing={save} returnKeyType="done" /></View>{notice && <Notice label={t(notice)} tone={notice === 'account.passwordUpdated' ? 'success' : 'error'} />}<Pressable accessibilityRole="button" disabled={busy} onPress={save} style={[styles.submit, busy && styles.disabled]}><Text style={styles.submitText}>{busy ? t('account.working') : t('account.updatePassword')}</Text><Feather name="arrow-up-right" size={18} color={colors.onAccent} /></Pressable></View></ScrollView></LinearGradient>;
}

function TopBar({ onBack, label, backLabel }: { onBack?: () => void; label: string; backLabel: string }) {
  return <View style={styles.topBar}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} hitSlop={10} style={styles.back}><Feather name="arrow-left" size={20} color={colors.ink} /></Pressable> : <View style={styles.backSpacer} />}{label ? <Text style={styles.overline}>{label}</Text> : <View /> }<View style={styles.backSpacer} /></View>;
}

function Field({ compact, containerRef, onFieldFocus, inputRef, label, hint, ...input }: { compact: boolean; containerRef: React.RefObject<View | null>; onFieldFocus: () => void; inputRef: React.RefObject<TextInput | null>; label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const focusStyle = useAnimatedStyle(() => ({ transform: [{ scale: withTiming(focus.value ? 1.008 : 1, { duration: 180 }) }] }));
  return <View ref={containerRef} style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><Animated.View style={focusStyle}><TextInput ref={inputRef} {...input} onFocus={(e) => { setFocused(true); focus.value = 1; onFieldFocus(); input.onFocus?.(e); }} onBlur={(e) => { setFocused(false); focus.value = 0; input.onBlur?.(e); }} style={[styles.input, compact && styles.inputCompact, focused && styles.inputFocused, Platform.OS === 'web' && ({ outlineStyle: 'none' } as never)]} placeholderTextColor={colors.faint} selectionColor={colors.signal} /></Animated.View></View>;
}

function PasswordField({ compact, containerRef, onFieldFocus, inputRef, label, value, onChangeText, visible, onToggle, showLabel, hideLabel, hint, autoComplete, importantForAutofill, returnKeyType, onSubmitEditing }: { compact: boolean; containerRef: React.RefObject<View | null>; onFieldFocus: () => void; inputRef: React.RefObject<TextInput | null>; label: string; value: string; onChangeText: (value: string) => void; visible: boolean; onToggle: () => void; showLabel: string; hideLabel: string; hint?: string; autoComplete: 'new-password' | 'current-password' | 'off'; importantForAutofill?: 'auto' | 'no' | 'noExcludeDescendants' | 'yes' | 'yesExcludeDescendants'; returnKeyType: 'next' | 'done'; onSubmitEditing?: () => void }) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const focusStyle = useAnimatedStyle(() => ({ transform: [{ scale: withTiming(focus.value ? 1.008 : 1, { duration: 180 }) }] }));
  return <View ref={containerRef} style={[styles.field, compact && styles.fieldCompact]}><View style={styles.labelRow}><Text style={styles.fieldLabel}>{label}</Text>{hint && <Text style={styles.fieldHint}>{hint}</Text>}</View><Animated.View style={focusStyle}><View style={[styles.passwordWrap, compact && styles.passwordWrapCompact, focused && styles.inputFocused]}><TextInput ref={inputRef} value={value} onChangeText={onChangeText} onFocus={() => { setFocused(true); focus.value = 1; onFieldFocus(); }} onBlur={() => { setFocused(false); focus.value = 0; }} onSubmitEditing={onSubmitEditing} returnKeyType={returnKeyType} blurOnSubmit={returnKeyType === 'done'} style={[styles.passwordInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as never)]} placeholder="••••••••" placeholderTextColor={colors.faint} selectionColor={colors.signal} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={autoComplete} importantForAutofill={importantForAutofill} underlineColorAndroid="transparent" textContentType={Platform.OS === 'ios' && autoComplete !== 'off' ? (autoComplete === 'new-password' ? 'newPassword' : 'password') : undefined} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? hideLabel : showLabel} onPress={onToggle} hitSlop={8} style={styles.eye}><Feather name={visible ? 'eye-off' : 'eye'} size={18} color={colors.muted} /></Pressable></View></Animated.View></View>;
}

function Notice({ label, tone }: { label: string; tone: 'success' | 'error' | 'neutral' }) {
  return <View accessibilityRole="alert" style={[styles.notice, tone === 'success' && styles.noticeSuccess, tone === 'error' && styles.noticeError]}><Feather name={tone === 'success' ? 'check-circle' : tone === 'error' ? 'alert-circle' : 'info'} size={17} color={tone === 'success' ? colors.masteredDeep : tone === 'error' ? colors.riskDeep : colors.ink} /><Text style={styles.noticeText}>{label}</Text></View>;
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  ambient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', zIndex: -1 },
  glowA: { position: 'absolute', width: 280, height: 280, borderRadius: 180, backgroundColor: colors.violet, opacity: 0.12, top: -100, right: -80 },
  glowB: { position: 'absolute', width: 220, height: 220, borderRadius: 160, backgroundColor: colors.signal, opacity: 0.08, bottom: 40, left: -120 },
  scroll: { paddingBottom: spacing.lg },
  screen: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  screenCompact: { paddingTop: spacing.sm },
  topBar: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backSpacer: { width: 40 },
  overline: { color: colors.muted, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.3 },
  brandSpace: { marginTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandSpaceCompact: { marginTop: spacing.sm },
  progress: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  progressDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.lineStrong },
  progressActive: { width: 11, height: 11, backgroundColor: colors.signal, shadowColor: colors.signal, shadowOpacity: 0.6, shadowRadius: 8, elevation: 3 },
  progressLine: { width: 48, height: 1, backgroundColor: colors.lineStrong },
  signalDot: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.signal, shadowColor: colors.signal, shadowRadius: 12, shadowOpacity: 0.65, elevation: 4 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 42, lineHeight: 45, letterSpacing: -2, marginTop: spacing.xl, maxWidth: 410 },
  titleCompact: { fontSize: 36, lineHeight: 39, marginTop: spacing.lg },
  lead: { color: colors.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 23, marginTop: spacing.md, maxWidth: 420 },
  leadCompact: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  modeSwitch: { flexDirection: 'row', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.line, padding: 4, borderRadius: radius.md, marginTop: spacing.xl },
  modeSwitchCompact: { marginTop: spacing.md },
  modeOption: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeOptionSelected: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineStrong },
  modeLabel: { color: colors.muted, fontFamily: type.bold, fontSize: 12 },
  modeLabelSelected: { color: colors.ink },
  field: { marginTop: spacing.lg },
  fieldCompact: { marginTop: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontFamily: type.bold, fontSize: 13 },
  fieldHint: { color: colors.faint, fontFamily: type.mono, fontSize: 8, letterSpacing: 0.5 },
  input: { height: 60, borderRadius: radius.lg, borderWidth: 0, backgroundColor: 'rgba(255,255,255,0.045)', color: colors.ink, fontFamily: type.medium, fontSize: 15, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  inputCompact: { height: 52, marginTop: 3 },
  inputFocused: { borderColor: 'transparent', backgroundColor: colors.elevated, shadowColor: colors.violet, shadowOpacity: 0.18, shadowRadius: 12, elevation: 3 },
  passwordWrap: { height: 60, borderRadius: radius.lg, borderWidth: 0, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.045)', flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  passwordWrapCompact: { height: 52, marginTop: 3 },
  passwordInput: { flex: 1, alignSelf: 'stretch', backgroundColor: 'transparent', color: colors.ink, fontFamily: type.medium, fontSize: 15, paddingHorizontal: spacing.md },
  eye: { width: 50, height: '100%', alignItems: 'center', justifyContent: 'center' },
  notice: { marginTop: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.elevated, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noticeSuccess: { borderColor: colors.mastered, backgroundColor: colors.masteredWash },
  noticeError: { borderColor: colors.risk, backgroundColor: colors.riskWash },
  noticeText: { flex: 1, color: colors.ink, fontFamily: type.medium, fontSize: 12, lineHeight: 18 },
  submit: { minHeight: 60, borderRadius: radius.lg, backgroundColor: colors.signal, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, shadowColor: colors.signal, shadowOpacity: 0.24, shadowRadius: 18, elevation: 5 },
  submitCompact: { minHeight: 54, marginTop: spacing.md },
  submitText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 15 },
  disabled: { opacity: 0.46 },
  privacy: { color: colors.faint, fontFamily: type.regular, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg },
  privacyCompact: { fontSize: 8, lineHeight: 12, marginTop: spacing.xs },
  secondaryAction: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryActionCompact: { paddingVertical: 4 },
  secondaryText: { color: colors.inkSoft, fontFamily: type.bold, fontSize: 12 },
  identityCard: { marginTop: spacing.xxl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper, padding: spacing.xl },
  identityOrbit: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.signal, backgroundColor: colors.nav, alignItems: 'center', justifyContent: 'center' },
  identityKicker: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1, marginTop: spacing.xl },
  identityTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 29, letterSpacing: -1.1, marginTop: spacing.xs },
  email: { color: colors.muted, fontFamily: type.medium, fontSize: 14, marginTop: spacing.sm },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
  verifiedDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.mastered },
  verifiedText: { color: colors.masteredDeep, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.7 },
  explainer: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: spacing.lg, maxWidth: 430 },
  signOut: { minHeight: 54, marginTop: spacing.xl, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  signOutText: { color: colors.ink, fontFamily: type.bold, fontSize: 13 },
  deleteAccount: { minHeight: 48, marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.risk, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  deleteAccountText: { color: colors.riskDeep, fontFamily: type.bold, fontSize: 12 },
}));
