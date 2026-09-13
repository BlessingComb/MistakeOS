import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../auth';
import { AppLanguage, useTranslation, type TranslationKey } from '../i18n';
import { useRevenueCat, type RevenueCatNotice } from '../revenuecat';
import { colors, createThemedStyles, radius, spacing, type, type ThemeMode } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

const languages: AppLanguage[] = ['en', 'pt-BR'];
const themes: ThemeMode[] = ['dark', 'light'];
const noticeKeys: Record<RevenueCatNotice, TranslationKey> = {
  purchase_success: 'pro.unlocked',
  purchase_error: 'pro.purchaseError',
  restore_success: 'pro.restoreSuccess',
  restore_empty: 'pro.restoreEmpty',
  restore_error: 'pro.restoreError',
  manage_error: 'pro.manageError',
};

type Props = { onResetOnboarding: () => Promise<void>; onOpenPro: () => void; onOpenAccount: () => void; onOpenPrepMap: () => void; onOpenExams: () => void; onOpenLegal: (document: 'privacy' | 'terms' | 'support') => void; onExportData: () => Promise<boolean> };

export function SettingsScreen({ onResetOnboarding, onOpenPro, onOpenAccount, onOpenPrepMap, onOpenExams, onOpenLegal, onExportData }: Props) {
  const { t, language, setLanguage } = useTranslation();
  const { mode, setMode } = useTheme();
  const revenueCat = useRevenueCat();
  const auth = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<TranslationKey | null>(null);
  const subscriptionStatus = revenueCat.status === 'loading'
    ? t('settings.proChecking')
    : revenueCat.subscriptionLevel === 'pro'
      ? t('settings.proActive')
      : t('settings.proFree');
  const accountStatus = auth.status === 'loading'
    ? t('settings.accountChecking')
    : auth.account && !auth.account.isAnonymous
      ? t('settings.accountSignedIn')
      : t('settings.accountLocal');

  const chooseLanguage = (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) return;
    Haptics.selectionAsync().catch(() => undefined);
    setLanguage(nextLanguage);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.screen}>
        <View style={styles.topLine}>
          <Feather name="sliders" size={20} color={colors.ink} />
        </View>

        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.lead}>{t('settings.lead')}</Text>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
          <View style={styles.liveMark} />
        </View>
        <Text style={styles.sectionBody}>{t('settings.appearanceBody')}</Text>
        <View style={styles.themeSelector}>
          {themes.map((option) => {
            const selected = option === mode;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={t(option === 'dark' ? 'settings.darkMode' : 'settings.lightMode')}
                accessibilityState={{ checked: selected }}
                onPress={() => setMode(option)}
                style={[styles.themeOption, selected && styles.themeOptionSelected]}
              >
                <View style={[styles.themePreview, option === 'light' && styles.themePreviewLight]}>
                  <View style={styles.themePreviewOrb} />
                  <View style={[styles.themePreviewLine, option === 'light' && styles.themePreviewLineLight]} />
                </View>
                <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>{t(option === 'dark' ? 'settings.darkMode' : 'settings.lightMode')}</Text>
                {selected && <Feather name="check" size={15} color={colors.signal} />}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <View style={styles.liveMark} />
        </View>
        <Text style={styles.sectionBody}>{t('settings.languageDescription')}</Text>

        <View style={styles.languageList}>
          {languages.map((option) => {
            const selected = option === language;
            const name = option === 'en' ? t('settings.english') : t('settings.portuguese');
            const detail = option === 'en' ? t('settings.englishDetail') : t('settings.portugueseDetail');
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={name}
                accessibilityState={{ checked: selected }}
                onPress={() => chooseLanguage(option)}
                style={[styles.languageRow, selected && styles.languageRowSelected]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioCore} />}
                </View>
                <View style={styles.languageCopy}>
                  <Text style={styles.languageName}>{name}</Text>
                  <Text style={styles.languageDetail}>{detail}</Text>
                </View>
                {selected && <Text style={styles.selected}>{t('settings.selected')}</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.persistenceNote}>
          <Feather name="hard-drive" size={18} color={colors.masteredDeep} />
          <View style={styles.noteCopy}>
            <Text style={styles.noteTitle}>{t('settings.savedLocally')}</Text>
            <Text style={styles.noteBody}>{t('settings.instant')}</Text>
          </View>
        </View>

        <View style={styles.utilitySection}>
          <View style={styles.subscriptionHead}>
            <View style={styles.utilityCopy}>
              <Text style={styles.utilityTitle}>{t('settings.account')}</Text>
              <Text style={styles.subscriptionStatus}>{accountStatus}</Text>
            </View>
            <View style={[styles.subscriptionDot, auth.account && !auth.account.isAnonymous && styles.subscriptionDotActive]} />
          </View>
          <View style={styles.utilityCopy}>
            <Text style={styles.utilityBody}>{t('settings.accountBody')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenAccount} style={styles.utilityButton}>
            <Text style={styles.utilityButtonText}>{t(auth.account && !auth.account.isAnonymous ? 'settings.manageAccount' : 'settings.openAccount')}</Text>
            <Feather name="arrow-up-right" size={17} color={colors.onAccent} />
          </Pressable>
          {auth.account && !auth.account.isAnonymous && <Pressable accessibilityRole="button" disabled={signingOut} onPress={async () => { setSigningOut(true); await auth.signOut(); setSigningOut(false); }} style={[styles.signOutButton, signingOut && styles.disabled]}><Feather name="log-out" size={16} color={colors.riskDeep} /><Text style={styles.signOutText}>{signingOut ? t('account.signingOut') : t('account.signOut')}</Text></Pressable>}
        </View>

        <View style={styles.utilitySection}>
          <View style={styles.utilityCopy}>
            <Text style={styles.utilityTitle}>{t('settings.yourData')}</Text>
            <Text style={styles.utilityBody}>{t('settings.yourDataBody')}</Text>
          </View>
          {exportNotice && <Text style={exportNotice === 'settings.exportError' ? styles.unavailableText : styles.subscriptionStatus}>{t(exportNotice)}</Text>}
          <Pressable accessibilityRole="button" disabled={exporting} onPress={async () => { setExporting(true); setExportNotice(null); const shared = await onExportData(); setExporting(false); setExportNotice(shared ? 'settings.exportReady' : 'settings.exportError'); }} style={[styles.outlineButton, exporting && styles.disabled]}>
            <Feather name="download" size={16} color={colors.ink} />
            <Text style={styles.outlineButtonText}>{t(exporting ? 'settings.exporting' : 'settings.exportData')}</Text>
          </Pressable>
        </View>

        <View style={styles.utilitySection}>
          <View style={styles.utilityCopy}>
            <Text style={styles.utilityTitle}>{t('settings.studies')}</Text>
            <Text style={styles.utilityBody}>{t('settings.studiesBody')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenPrepMap} style={styles.outlineButton}><Feather name="map" size={16} color={colors.ink} /><Text style={styles.outlineButtonText}>{t('settings.openPreparation')}</Text><Feather name="chevron-right" size={16} color={colors.ink} /></Pressable>
          <Pressable accessibilityRole="button" onPress={onOpenExams} style={styles.outlineButton}><Feather name="calendar" size={16} color={colors.ink} /><Text style={styles.outlineButtonText}>{t('settings.examDates')}</Text><Feather name="chevron-right" size={16} color={colors.ink} /></Pressable>
        </View>

        <View style={styles.utilitySection}>
          <View style={styles.utilityCopy}>
            <Text style={styles.utilityTitle}>{t('settings.legal')}</Text>
            <Text style={styles.utilityBody}>{t('settings.legalBody')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => onOpenLegal('privacy')} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{t('settings.privacyPolicy')}</Text><Feather name="arrow-up-right" size={16} color={colors.ink} /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onOpenLegal('terms')} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{t('settings.termsOfService')}</Text><Feather name="arrow-up-right" size={16} color={colors.ink} /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onOpenLegal('support')} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{t('settings.helpSupport')}</Text><Feather name="arrow-up-right" size={16} color={colors.ink} /></Pressable>
        </View>

        <View style={styles.utilitySection}>
          <View style={styles.subscriptionHead}>
            <View style={styles.utilityCopy}>
              <Text style={styles.utilityTitle}>{t('settings.pro')}</Text>
              <Text style={styles.subscriptionStatus}>{subscriptionStatus}</Text>
            </View>
            <View style={[styles.subscriptionDot, revenueCat.subscriptionLevel === 'pro' && styles.subscriptionDotActive]} />
          </View>
          <View style={styles.utilityCopy}>
            <Text style={styles.utilityBody}>{t('settings.proBody')}</Text>
          </View>
          {revenueCat.status === 'unavailable' && <Text style={styles.unavailableText}>{t('settings.purchasesUnavailable')}</Text>}
          {revenueCat.notice && (
            <Pressable accessibilityRole="button" onPress={revenueCat.dismissNotice} style={styles.subscriptionNotice}>
              <Text style={styles.subscriptionNoticeText}>{t(noticeKeys[revenueCat.notice])}</Text>
              <Feather name="x" size={14} color={colors.ink} />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={revenueCat.subscriptionLevel === 'pro' ? revenueCat.openCustomerCenter : onOpenPro} style={styles.utilityButton}>
            <Text style={styles.utilityButtonText}>{t(revenueCat.subscriptionLevel === 'pro' ? 'settings.managePro' : 'settings.openPro')}</Text>
            <Feather name="arrow-up-right" size={17} color={colors.onAccent} />
          </Pressable>
          {revenueCat.status === 'ready' && (
            <Pressable accessibilityRole="button" disabled={revenueCat.operation !== 'idle'} onPress={revenueCat.restorePurchases} style={styles.restoreButton}>
              <Feather name="rotate-ccw" size={15} color={colors.ink} />
              <Text style={styles.restoreButtonText}>{t(revenueCat.operation === 'restoring' ? 'settings.restoring' : 'settings.restorePurchases')}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.utilitySection}>
          <View style={styles.utilityCopy}>
            <Text style={styles.utilityTitle}>{t('settings.onboarding')}</Text>
            <Text style={styles.utilityBody}>{t('settings.onboardingBody')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { Haptics.selectionAsync().catch(() => undefined); onResetOnboarding(); }} style={styles.outlineButton}>
            <Feather name="rotate-ccw" size={16} color={colors.ink} />
            <Text style={styles.outlineButtonText}>{t('settings.restartOnboarding')}</Text>
          </Pressable>
        </View>

        <View style={styles.productLanguage}>
          <Text style={styles.productKicker}>{t('settings.preservedNames')}</Text>
          <Text style={styles.productTitle}>{t('settings.translationLayer')}</Text>
          <Text style={styles.productBody}>{t('settings.preservedNamesBody')}</Text>
          <View style={styles.namesRail}>
            {(language === 'pt-BR'
              ? ['Índice de Risco', 'DNA dos Erros', 'Quebre o Padrão', 'Preparação para Provas']
              : ['Risk Score', 'Mistake DNA', 'Never Again', 'Exam Prep Map']
            ).map((name) => (
              <View key={name} style={styles.namePill}><Text style={styles.namePillText}>{name}</Text></View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { paddingBottom: 116 },
  screen: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.ink },
  overline: { color: colors.muted, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.3 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 54, lineHeight: 60, letterSpacing: -3, marginTop: spacing.xl },
  lead: { color: colors.muted, fontFamily: type.regular, fontSize: 16, lineHeight: 24, maxWidth: 500, marginTop: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.huge, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  sectionTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 27, letterSpacing: -1.1 },
  liveMark: { width: 9, height: 9, borderRadius: 9, backgroundColor: colors.mastered },
  sectionBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, maxWidth: 560, marginTop: spacing.md },
  themeSelector: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  themeOption: { flex: 1, minHeight: 116, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm },
  themeOptionSelected: { borderColor: colors.signal, backgroundColor: colors.violetWash },
  themePreview: { height: 54, borderRadius: radius.md, backgroundColor: colors.nav, borderWidth: 1, borderColor: colors.darkLine, padding: 10, justifyContent: 'flex-end' },
  themePreviewLight: { backgroundColor: '#F4F7FA', borderColor: '#DDE3EA' },
  themePreviewOrb: { position: 'absolute', width: 17, height: 17, borderRadius: 9, backgroundColor: colors.signal, top: 9, right: 9 },
  themePreviewLine: { height: 5, width: '68%', borderRadius: 4, backgroundColor: colors.onDark },
  themePreviewLineLight: { backgroundColor: '#111827' },
  themeLabel: { color: colors.ink, fontFamily: type.bold, fontSize: 12 },
  themeLabelSelected: { color: colors.ink },
  languageList: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.ink },
  languageRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: spacing.xs },
  languageRowSelected: { backgroundColor: colors.masteredWash, paddingHorizontal: spacing.md, borderRadius: radius.md, borderBottomColor: colors.mastered },
  radio: { width: 24, height: 24, borderRadius: 14, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.masteredDeep },
  radioCore: { width: 12, height: 12, borderRadius: 8, backgroundColor: colors.masteredDeep },
  languageCopy: { flex: 1 },
  languageName: { color: colors.ink, fontFamily: type.bold, fontSize: 16 },
  languageDetail: { color: colors.muted, fontFamily: type.regular, fontSize: 11, marginTop: 4 },
  selected: { color: colors.masteredDeep, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 1 },
  persistenceNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.line },
  noteCopy: { flex: 1 },
  noteTitle: { color: colors.ink, fontFamily: type.semibold, fontSize: 13 },
  noteBody: { color: colors.muted, fontFamily: type.regular, fontSize: 11, marginTop: 4 },
  utilitySection: { paddingVertical: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.line, gap: spacing.md },
  subscriptionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subscriptionStatus: { color: colors.muted, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 1, marginTop: 4 },
  subscriptionDot: { width: 10, height: 10, borderRadius: 6, backgroundColor: colors.faint },
  subscriptionDotActive: { backgroundColor: colors.mastered },
  utilityCopy: { maxWidth: 560 },
  utilityTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, letterSpacing: -0.7 },
  utilityBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: 6 },
  utilityButton: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.signal, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  utilityButtonText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 13 },
  unavailableText: { color: colors.riskDeep, fontFamily: type.semibold, fontSize: 11, lineHeight: 17 },
  subscriptionNotice: { backgroundColor: colors.recoveringWash, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subscriptionNoticeText: { color: colors.ink, fontFamily: type.semibold, fontSize: 11, lineHeight: 17, flex: 1 },
  restoreButton: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ink, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  restoreButtonText: { color: colors.ink, fontFamily: type.bold, fontSize: 12 },
  signOutButton: { minHeight: 46, marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.risk, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  signOutText: { color: colors.riskDeep, fontFamily: type.bold, fontSize: 12 },
  disabled: { opacity: 0.5 },
  outlineButton: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ink, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  outlineButtonText: { color: colors.ink, fontFamily: type.bold, fontSize: 13 },
  productLanguage: { backgroundColor: colors.nav, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.lg, marginTop: spacing.xxl },
  productKicker: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1 },
  productTitle: { color: colors.onDark, fontFamily: type.extraBold, fontSize: 24, letterSpacing: -0.9, marginTop: spacing.sm },
  productBody: { color: colors.darkMuted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  namesRail: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.lg },
  namePill: { borderWidth: 1, borderColor: colors.darkLine, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  namePillText: { color: colors.onDark, fontFamily: type.mono, fontSize: 8 },
}));
