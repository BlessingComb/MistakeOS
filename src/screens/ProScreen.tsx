import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { trackEvent } from '../analytics';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTranslation, type TranslationKey } from '../i18n';
import { annualSavingsPercent, useRevenueCat, type RevenueCatNotice, type RevenueCatPackage } from '../revenuecat';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

const benefits: { title: TranslationKey; body: TranslationKey; code: string }[] = [
  { title: 'pro.deeperDna', body: 'pro.deeperDnaBody', code: 'DNA+' },
  { title: 'pro.advancedRisk', body: 'pro.advancedRiskBody', code: 'RISK+' },
  { title: 'pro.neverAgain', body: 'pro.neverAgainBody', code: 'NA+' },
  { title: 'pro.prepMap', body: 'pro.prepMapBody', code: 'PM+' },
];

const noticeKeys: Record<RevenueCatNotice, TranslationKey> = {
  purchase_success: 'pro.unlocked',
  purchase_error: 'pro.purchaseError',
  restore_success: 'pro.restoreSuccess',
  restore_empty: 'pro.restoreEmpty',
  restore_error: 'pro.restoreError',
  manage_error: 'pro.manageError',
};

export function ProScreen({ onBack }: { onBack: () => void }) {
  const { t, formatNumber } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const revenueCat = useRevenueCat();
  const offeringStatus = revenueCat.offeringStatus;
  const recordPaywallImpression = revenueCat.recordPaywallImpression;
  const selected = revenueCat.packages.find((item) => item.id === revenueCat.selectedPackageId) ?? null;
  const savings = annualSavingsPercent(revenueCat.packages);
  const busy = revenueCat.operation !== 'idle';

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    trackEvent('pro_screen_viewed', { source: 'settings' });
    trackEvent('paywall_viewed', { source: 'settings' });
  }, []);

  useEffect(() => {
    if (offeringStatus === 'ready') recordPaywallImpression();
  }, [offeringStatus, recordPaywallImpression]);

  const purchase = async () => {
    if (busy || !selected) return;
    Haptics.selectionAsync().catch(() => undefined);
    await revenueCat.purchaseSelected();
  };

  const restore = async () => {
    if (busy || revenueCat.status !== 'ready') return;
    await revenueCat.restorePurchases();
  };

  const manage = async () => {
    if (busy) return;
    await revenueCat.openCustomerCenter();
  };

  const showPurchaseFooter = revenueCat.subscriptionLevel === 'free' && revenueCat.status === 'ready' && revenueCat.offeringStatus === 'ready' && selected;
  const showManageFooter = revenueCat.subscriptionLevel === 'pro' && revenueCat.status === 'ready';

  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={[styles.content, (showPurchaseFooter || showManageFooter) && styles.contentWithFooter]} showsVerticalScrollIndicator={false}>
        <View style={styles.screen}>
          <View style={styles.top}>
            <BrandMark />
            <Pressable accessibilityRole="button" accessibilityLabel={t('pro.back')} onPress={onBack} style={styles.back}><Feather name="x" size={19} color={colors.ink} /></Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.overline}>{t('pro.overline')}</Text>
            <Text style={styles.title}>{t('pro.title')}</Text>
            <Text style={styles.body}>{t('pro.body')}</Text>
          </View>

          {revenueCat.notice && (
            <Pressable accessibilityRole="button" onPress={revenueCat.dismissNotice} style={[styles.notice, revenueCat.notice === 'purchase_success' || revenueCat.notice === 'restore_success' ? styles.noticeSuccess : styles.noticeError]}>
              <Feather name={revenueCat.notice === 'purchase_success' || revenueCat.notice === 'restore_success' ? 'check' : 'info'} size={17} color={colors.onAccent} />
              <Text style={styles.noticeText}>{t(noticeKeys[revenueCat.notice])}</Text>
              <Feather name="x" size={14} color={colors.onAccent} />
            </Pressable>
          )}

          {revenueCat.subscriptionLevel === 'pro' ? (
            <View style={styles.unlocked}>
              <View style={styles.unlockedIcon}><Feather name="check" size={22} color={colors.onDark} /></View>
              <View style={styles.unlockedCopy}><Text style={styles.unlockedTitle}>{t('pro.unlocked')}</Text><Text style={styles.unlockedBody}>{t('pro.unlockedBody')}</Text></View>
            </View>
          ) : (
            <OfferingArea
              status={revenueCat.status}
              offeringStatus={revenueCat.offeringStatus}
              packages={revenueCat.packages}
              selectedPackageId={revenueCat.selectedPackageId}
              savings={savings}
              onSelect={revenueCat.selectPackage}
              onRetry={revenueCat.retry}
              t={t}
              formatNumber={formatNumber}
            />
          )}

          <View style={styles.benefits}>
            {benefits.map((benefit, index) => (
              <View key={benefit.code} style={styles.benefit}>
                <View style={styles.benefitIndex}><Text style={styles.benefitCode}>{benefit.code}</Text><Text style={styles.benefitNumber}>0{index + 1}</Text></View>
                <View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{t(benefit.title)}</Text><Text style={styles.benefitBody}>{t(benefit.body)}</Text></View>
              </View>
            ))}
          </View>

          {revenueCat.status === 'ready' && (
            <Pressable accessibilityRole="button" disabled={busy} onPress={restore} style={styles.restoreInline}>
              <Feather name="rotate-ccw" size={15} color={colors.faint} />
              <Text style={styles.restoreText}>{revenueCat.operation === 'restoring' ? t('pro.restoring') : t('pro.restore')}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backTextButton}><Feather name="arrow-left" size={16} color={colors.faint} /><Text style={styles.backText}>{t('pro.back')}</Text></Pressable>
        </View>
      </ScrollView>

      {showPurchaseFooter && (
        <View style={styles.footer}>
          <View style={[styles.footerInner, busy && styles.busy]}>
            <PrimaryButton
              label={revenueCat.operation === 'purchasing' ? t('pro.starting') : t('pro.start')}
              meta={`${selected.priceString} · ${t(selected.packageType === 'annual' ? 'pro.perYear' : 'pro.perMonth')}`}
              tone="mastered"
              onPress={purchase}
            />
          </View>
        </View>
      )}
      {showManageFooter && (
        <View style={styles.footer}>
          <View style={[styles.footerInner, busy && styles.busy]}>
            <PrimaryButton label={t('pro.manage')} meta={t('settings.proActive')} tone="mastered" onPress={manage} />
          </View>
        </View>
      )}
    </View>
  );
}

type OfferingAreaProps = {
  status: ReturnType<typeof useRevenueCat>['status'];
  offeringStatus: ReturnType<typeof useRevenueCat>['offeringStatus'];
  packages: RevenueCatPackage[];
  selectedPackageId: string | null;
  savings: number | null;
  onSelect: (id: string) => void;
  onRetry: () => Promise<void>;
  t: ReturnType<typeof useTranslation>['t'];
  formatNumber: ReturnType<typeof useTranslation>['formatNumber'];
};

function OfferingArea({ status, offeringStatus, packages, selectedPackageId, savings, onSelect, onRetry, t, formatNumber }: OfferingAreaProps) {
  if (status === 'loading' || offeringStatus === 'loading' || offeringStatus === 'idle') {
    return <StatusPanel mode="loading" title={t('pro.loadingTitle')} body={t('pro.loadingBody')} />;
  }
  if (status === 'unavailable' || offeringStatus === 'unavailable') {
    return <StatusPanel mode="unavailable" title={t('pro.unavailableTitle')} body={t('pro.unavailableBody')} />;
  }
  if (status === 'error' || offeringStatus === 'error') {
    return <StatusPanel mode="error" title={t('pro.offeringErrorTitle')} body={t('pro.offeringErrorBody')} action={t('pro.retry')} onAction={onRetry} />;
  }
  if (offeringStatus === 'empty') {
    return <StatusPanel mode="empty" title={t('pro.offeringEmptyTitle')} body={t('pro.offeringEmptyBody')} action={t('pro.retry')} onAction={onRetry} />;
  }
  return (
    <View style={styles.packages}>
      {packages.map((item) => {
        const selected = item.id === selectedPackageId;
        const annual = item.packageType === 'annual';
        return (
          <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onSelect(item.id)} style={[styles.packageOption, selected && styles.packageSelected]}>
            <View style={styles.packageTop}>
              <View><Text style={[styles.packageTitle, selected && styles.packageTitleSelected]}>{t(annual ? 'pro.annual' : 'pro.monthly')}</Text><Text style={[styles.packagePeriod, selected && styles.packagePeriodSelected]}>{t(annual ? 'pro.perYear' : 'pro.perMonth')}</Text></View>
              <View style={styles.packagePriceWrap}><Text style={[styles.packagePrice, selected && styles.packageTitleSelected]}>{item.priceString}</Text>{selected && <Text style={styles.selectedLabel}>{t('pro.selected')}</Text>}</View>
            </View>
            {annual && item.pricePerMonthString && <Text style={[styles.packageDetail, selected && styles.packageDetailSelected]}>{t('pro.monthlyEquivalent', { price: item.pricePerMonthString })}</Text>}
            {annual && savings && <Text style={styles.savings}>{t('pro.savings', { percent: formatNumber(savings) })}</Text>}
          </Pressable>
        );
      })}
      <Text style={styles.storeTerms}>{t('pro.storeTerms')}</Text>
    </View>
  );
}

function StatusPanel({ mode, title, body, action, onAction }: { mode: 'loading' | 'unavailable' | 'error' | 'empty'; title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.statusPanel}>
      <View style={[styles.statusGlyph, mode === 'loading' && styles.statusGlyphLoading]}><Feather name={mode === 'loading' ? 'activity' : mode === 'unavailable' ? 'smartphone' : 'wifi-off'} size={21} color={mode === 'loading' ? colors.onAccent : colors.risk} /></View>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusBody}>{body}</Text>
      {action && onAction && <Pressable accessibilityRole="button" onPress={onAction} style={styles.retry}><Text style={styles.retryText}>{action}</Text><Feather name="refresh-cw" size={15} color={colors.onAccent} /></Pressable>}
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  contentWithFooter: { paddingBottom: 152 },
  screen: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 24, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: spacing.xxl, maxWidth: 620 },
  overline: { color: colors.signal, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.4 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 42, lineHeight: 45, letterSpacing: -2.1, marginTop: spacing.md },
  body: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  benefits: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.xl },
  benefit: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  benefitIndex: { width: 43, justifyContent: 'space-between' },
  benefitCode: { color: colors.risk, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.8 },
  benefitNumber: { color: colors.faint, fontFamily: type.mono, fontSize: 8 },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 16, letterSpacing: -0.35 },
  benefitBody: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  notice: { borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  noticeSuccess: { backgroundColor: colors.mastered },
  noticeError: { backgroundColor: colors.recovering },
  noticeText: { flex: 1, color: colors.onAccent, fontFamily: type.semibold, fontSize: 12, lineHeight: 18 },
  unlocked: { backgroundColor: colors.mastered, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  unlockedIcon: { width: 46, height: 46, borderRadius: 24, backgroundColor: colors.nav, alignItems: 'center', justifyContent: 'center' },
  unlockedCopy: { flex: 1 },
  unlockedTitle: { color: colors.onAccent, fontFamily: type.extraBold, fontSize: 19 },
  unlockedBody: { color: colors.onAccent, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: 3, opacity: 0.68 },
  packages: { gap: spacing.sm, marginTop: spacing.xl },
  packageOption: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  packageSelected: { backgroundColor: colors.signal, borderColor: colors.signal },
  packageTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  packageTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 18 },
  packageTitleSelected: { color: colors.onAccent },
  packagePeriod: { color: colors.faint, fontFamily: type.mono, fontSize: 7, letterSpacing: 0.7, marginTop: 3, textTransform: 'uppercase' },
  packagePeriodSelected: { color: colors.onAccent, opacity: 0.6 },
  packagePriceWrap: { alignItems: 'flex-end' },
  packagePrice: { color: colors.ink, fontFamily: type.extraBold, fontSize: 19 },
  selectedLabel: { color: colors.onAccent, fontFamily: type.monoBold, fontSize: 6, letterSpacing: 0.9, marginTop: 3 },
  packageDetail: { color: colors.faint, fontFamily: type.regular, fontSize: 11, marginTop: spacing.sm },
  packageDetailSelected: { color: colors.onAccent, opacity: 0.68 },
  savings: { alignSelf: 'flex-start', color: colors.onAccent, backgroundColor: colors.mastered, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontFamily: type.monoBold, fontSize: 7, marginTop: spacing.sm },
  storeTerms: { color: colors.faint, fontFamily: type.regular, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: spacing.xs },
  statusPanel: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xl },
  statusGlyph: { width: 48, height: 48, borderRadius: 25, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  statusGlyphLoading: { backgroundColor: colors.signal, borderColor: colors.signal },
  statusTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 20, lineHeight: 25, marginTop: spacing.lg },
  statusBody: { color: colors.faint, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  retry: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.signal, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginTop: spacing.lg },
  retryText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 13 },
  restoreInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center', padding: spacing.md, marginTop: spacing.md },
  restoreText: { color: colors.faint, fontFamily: type.semibold, fontSize: 12 },
  backTextButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center', padding: spacing.md },
  backText: { color: colors.faint, fontFamily: type.semibold, fontSize: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  footerInner: { width: '100%', maxWidth: 712, alignSelf: 'center' },
  busy: { opacity: 0.6 },
}));
