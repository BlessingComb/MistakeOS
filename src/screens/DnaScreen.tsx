import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../i18n';
import type { MistakeRecord } from '../mistakes';
import { riskLabelKey, type CauseId, type InitialProfile } from '../onboarding';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Props = { mistakes: readonly MistakeRecord[]; initialProfile: InitialProfile | null };

export function DnaScreen({ mistakes, initialProfile }: Props) {
  const { t, formatNumber } = useTranslation();
  const realSignals = aggregateCauses(mistakes);
  const signals = realSignals.length > 0
    ? realSignals.map(([cause, count]) => ({ cause, count, source: 'real' as const }))
    : initialProfile?.evidence.map((cause) => ({ cause, count: 0, source: 'self' as const })) ?? [];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.screen}>
        <View style={styles.topLine}><Text style={styles.overline}>{t('dna.overline')}</Text><Feather name="aperture" size={20} color={colors.ink} /></View>
        <Text style={styles.title}>{t('dna.title').replace(' ', '\n')}</Text>
        <Text style={styles.lead}>{t('dna.lead')}</Text>

        {signals.length > 0 ? (
          <View style={styles.genome}>
            {signals.map((signal, index) => {
              const activeNodes = signal.source === 'real' ? Math.min(7, Math.max(2, signal.count + 1)) : 2;
              const tone = signal.source === 'real' ? (signal.count >= 2 ? colors.risk : colors.recovering) : colors.faint;
              return (
                <View key={signal.cause} style={styles.patternRow}>
                  <View style={styles.patternMeta}>
                    <Text style={styles.patternId}>{signal.source === 'real' ? t('dna.realEvidence') : t('dna.selfReportedSignal')}</Text>
                    <Text style={styles.patternName}>{t(riskLabelKey(signal.cause))}</Text>
                  </View>
                  <View style={styles.strandWrap}>
                    <View style={styles.strandRail} />
                    {Array.from({ length: 7 }).map((_, dot) => (
                      <View key={dot} style={[styles.node, { left: `${dot * 15.2}%`, top: 22 + Math.sin((dot + index) * 1.4) * 12, backgroundColor: dot < activeNodes ? tone : colors.line }]} />
                    ))}
                  </View>
                  <Text style={[styles.patternValue, { color: tone }]}>{signal.source === 'real' ? formatNumber(signal.count) : '—'}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}><Feather name="activity" size={24} color={colors.risk} /><Text style={styles.emptyTitle}>{t('dna.noRealPattern')}</Text><Text style={styles.emptyBody}>{t('dna.noRealPatternBody')}</Text></View>
        )}

        <View style={styles.insight}>
          <View style={styles.insightNumber}><Text style={styles.insightNumberText}>{realSignals.length > 0 ? formatNumber(mistakes.length) : 'i'}</Text></View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightKicker}>{realSignals.length > 0 ? t('dna.realEvidence') : t('dna.startingPoint')}</Text>
            <Text style={styles.insightTitle}>{realSignals.length > 0 ? t(mistakes.length === 1 ? 'dna.occurrence' : 'dna.occurrences', { count: formatNumber(mistakes.length) }) : t('home.selfReported')}</Text>
            <Text style={styles.insightBody}>{realSignals.length > 0 ? t('home.evidenceSubheadline') : t('onboarding.profileBody')}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function aggregateCauses(mistakes: readonly MistakeRecord[]): [CauseId, number][] {
  const counts = new Map<CauseId, number>();
  mistakes.forEach((mistake) => { if (mistake.cause) counts.set(mistake.cause, (counts.get(mistake.cause) ?? 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { paddingBottom: 116 },
  screen: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.ink },
  overline: { color: colors.muted, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.3 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 62, lineHeight: 56, letterSpacing: -3.5, marginTop: spacing.xl },
  lead: { color: colors.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 23, maxWidth: 540, marginTop: spacing.lg },
  genome: { marginTop: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.line },
  patternRow: { minHeight: 124, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, gap: spacing.sm },
  patternMeta: { width: '36%' },
  patternId: { color: colors.faint, fontFamily: type.monoBold, fontSize: 6, letterSpacing: 0.8, marginBottom: 7 },
  patternName: { color: colors.ink, fontFamily: type.bold, fontSize: 14, letterSpacing: -0.3 },
  strandWrap: { flex: 1, height: 62, position: 'relative' },
  strandRail: { position: 'absolute', top: 31, left: 2, right: 2, height: 1, backgroundColor: colors.line, transform: [{ rotate: '-5deg' }] },
  node: { position: 'absolute', width: 10, height: 10, borderRadius: 10, borderWidth: 2, borderColor: colors.paper },
  patternValue: { width: 28, textAlign: 'right', fontFamily: type.extraBold, fontSize: 24, letterSpacing: -1 },
  empty: { marginTop: spacing.xxl, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.xl },
  emptyTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 22, letterSpacing: -0.8, marginTop: spacing.lg },
  emptyBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  insight: { marginTop: spacing.xxl, backgroundColor: colors.nav, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.lg, flexDirection: 'row', gap: spacing.md },
  insightNumber: { width: 36, height: 36, borderRadius: 19, backgroundColor: colors.risk, alignItems: 'center', justifyContent: 'center' },
  insightNumberText: { color: colors.onAccent, fontFamily: type.extraBold, fontSize: 15 },
  insightCopy: { flex: 1 },
  insightKicker: { color: colors.risk, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1, marginBottom: spacing.sm },
  insightTitle: { color: colors.onDark, fontFamily: type.bold, fontSize: 17, lineHeight: 22 },
  insightBody: { color: colors.darkMuted, fontFamily: type.regular, fontSize: 12, lineHeight: 19, marginTop: spacing.sm },
}));
