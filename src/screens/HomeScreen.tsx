import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { trackEvent } from '../analytics';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import type { ExamRecord } from '../exams';
import { useTranslation } from '../i18n';
import { groupMistakesBySubject, QuestionPhotoImage, type MistakeRecord } from '../mistakes';
import { riskLabelKey, subjectLabelKey, type InitialProfile, type SubjectId } from '../onboarding';
import { buildExamPrepMap, upcomingExam, type ReviewEvidence } from '../prepMap';
import { colors, createThemedStyles, glow, radius, shadow, spacing, type } from '../theme';

type Props = {
  mistakes: readonly MistakeRecord[];
  initialProfile: InitialProfile | null;
  exams: readonly ExamRecord[];
  reviewEvidence: ReviewEvidence;
  onLogMistake: () => void;
  onDna: () => void;
  onStartReview: (subject: SubjectId) => void;
  onOpenPrepMap: () => void;
};

export function HomeScreen({ mistakes, initialProfile, exams, reviewEvidence, onLogMistake, onDna, onStartReview, onOpenPrepMap }: Props) {
  const { t, language, formatDate, formatNumber } = useTranslation();
  const hasEvidence = mistakes.length > 0;
  const latest = mistakes[0];
  const repeatedCause = getRepeatedCause(mistakes);
  const milestoneRemaining = Math.max(0, 5 - mistakes.length);
  const topicGroups = groupMistakesBySubject(mistakes);
  const nextExam = upcomingExam(exams);
  const prepMap = nextExam ? buildExamPrepMap(nextExam, mistakes, reviewEvidence) : null;
  const dateLabel = formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' })
    .toLocaleUpperCase(language === 'pt-BR' ? 'pt-BR' : 'en-US');

  const logMistake = () => {
    trackEvent('first_mistake_cta_clicked', { source: 'home' });
    onLogMistake();
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.screen}>
        <View style={styles.header}><BrandMark /><Text style={styles.date}>{dateLabel}</Text></View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{hasEvidence ? t('home.evidenceTitle') : t('home.newUserEyebrow')}</Text>
          <Text style={styles.title}>{hasEvidence ? t('home.evidenceHeadline') : t('home.emptyTitle')}</Text>
          <Text style={styles.subtitle}>{hasEvidence ? t('home.evidenceSubheadline') : t('home.emptyBody')}</Text>
        </View>

        {!hasEvidence ? (
          <View style={[styles.emptyStage, shadow]}>
            <View style={styles.scanField}>
              <View style={styles.scanRingOuter} />
              <View style={styles.scanRing} />
              <View style={styles.scanCore}><Feather name="plus" size={25} color={colors.onAccent} /></View>
              <View style={styles.scanLine} />
            </View>
            <Text style={styles.emptySignal}>{t('home.notEnoughSignal')}</Text>
            <PrimaryButton label={t('home.logMistake')} meta={t('home.logMistakeMeta')} tone="risk" onPress={logMistake} />
          </View>
        ) : (
          <>
            <View style={[styles.evidenceStage, shadow, glow]}>
              <View style={styles.evidenceTop}>
                <View style={styles.evidenceCopy}>
                  <Text style={styles.evidenceLabel}>{t('home.evidencePulse')}</Text>
                  <Text style={styles.evidenceCount}>{t(mistakes.length === 1 ? 'home.mistakeCount' : 'home.mistakesCount', { count: formatNumber(mistakes.length) })}</Text>
                  <Text style={styles.evidenceHint}>{t('home.evidenceHint')}</Text>
                </View>
                <View style={styles.signalOrb}>
                  <View style={styles.signalOrbitOuter} />
                  <View style={styles.signalOrbitInner} />
                  <Text style={styles.counterText}>{formatNumber(Math.min(mistakes.length, 5))}</Text>
                  <Text style={styles.counterTotal}>/5</Text>
                </View>
              </View>
              <View style={styles.progressRail}>
                {Array.from({ length: 5 }).map((_, index) => <View key={index} style={[styles.progressSegment, index < mistakes.length && styles.progressActive]} />)}
              </View>
              <Text style={styles.milestone}>{milestoneRemaining > 0 ? t('home.nextMilestone', { count: formatNumber(milestoneRemaining) }) : t('home.firstPatternReady')}</Text>
              <PrimaryButton label={t('home.logAnother')} meta={t('home.logAnotherMeta')} onPress={onLogMistake} />
            </View>

            <View style={styles.evidenceDetails}>
              <View style={styles.factRow}>
                <View style={styles.factMarker} />
                <View style={styles.factCopy}>
                  <Text style={styles.factLabel}>{t('home.latestMistake')}</Text>
                  <Text numberOfLines={2} style={styles.factValue}>{latest.note}</Text>
                  <Text style={styles.factMeta}>{latest.customSubject ?? t(subjectLabelKey(latest.subject))} · {formatDate(new Date(latest.createdAt), { month: 'short', day: 'numeric' })}</Text>
                </View>
              </View>
              <View style={styles.factRow}>
                <View style={[styles.factMarker, { backgroundColor: repeatedCause ? colors.recovering : colors.lineStrong }]} />
                <View style={styles.factCopy}>
                  <Text style={styles.factLabel}>{t('home.emergingSignal')}</Text>
                  <Text style={styles.factValue}>{repeatedCause ? t(riskLabelKey(repeatedCause)) : t('home.notEnoughSignal')}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {topicGroups.length > 0 && (
          <View style={styles.topicsSection}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionEyebrow}>{t('home.reviewTopicsEyebrow')}</Text>
                <Text style={styles.sectionTitle}>{t('home.reviewTopicsTitle')}</Text>
              </View>
              <Text style={styles.sectionMeta}>{t(topicGroups.length === 1 ? 'home.topicCountOne' : 'home.topicCount', { count: formatNumber(topicGroups.length) })}</Text>
            </View>
            <Text style={styles.sectionBody}>{t('home.reviewTopicsBody')}</Text>
            <View style={styles.topicList}>
              {topicGroups.map((group, index) => {
                const latestInTopic = group.mistakes[0];
                return (
                  <Pressable
                    key={group.subject}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.startTopicReviewLabel', { topic: group.customSubject ?? t(subjectLabelKey(group.subject)) })}
                    onPress={() => onStartReview(group.subject)}
                    style={({ pressed }) => [styles.topicRow, pressed && styles.topicPressed]}
                  >
                    <View style={styles.topicIndex}><Text style={styles.topicIndexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                    {latestInTopic.photoUri ? (
                      <QuestionPhotoImage uri={latestInTopic.photoUri} style={styles.topicThumbnail} />
                    ) : (
                      <View style={styles.topicGlyph}><Feather name="book-open" size={16} color={colors.signal} /></View>
                    )}
                    <View style={styles.topicCopy}>
                      <Text style={styles.topicTitle}>{group.customSubject ?? t(subjectLabelKey(group.subject))}</Text>
                      <Text style={styles.topicMeta}>{t(group.mistakes.length === 1 ? 'home.topicQuestion' : 'home.topicQuestions', { count: formatNumber(group.mistakes.length) })}</Text>
                    </View>
                    <View style={styles.topicAction}><Feather name="arrow-right" size={17} color={colors.onAccent} /></View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {nextExam && prepMap && (
          <Pressable accessibilityRole="button" onPress={onOpenPrepMap} style={styles.prepPreview}>
            <View style={styles.prepPreviewIcon}><Feather name="map" size={18} color={colors.onAccent} /></View>
            <View style={styles.prepPreviewCopy}><Text style={styles.prepPreviewLabel}>{t('home.nextExam')}</Text><Text style={styles.prepPreviewTitle}>{t(subjectLabelKey(nextExam.subject))}</Text><Text style={styles.prepPreviewBody}>{prepMap.items.length ? t('home.prepMapTitle', { count: formatNumber(prepMap.items.length) }) : t('home.prepMapEmpty')}</Text></View>
            <Feather name="arrow-up-right" size={18} color={colors.signal} />
          </Pressable>
        )}

        {initialProfile && (
          <Pressable accessibilityRole="button" onPress={onDna} style={styles.profilePanel}>
            <View style={styles.profileHead}>
              <View><Text style={styles.profileEyebrow}>{t('home.startingProfile')}</Text><Text style={styles.profileMeta}>{t('home.selfReported')}</Text></View>
              <Feather name="arrow-up-right" size={18} color={colors.signal} />
            </View>
            <ProfileRow index="01" label={t('onboarding.primaryRisk')} value={t(riskLabelKey(initialProfile.primaryRisk))} tone={colors.risk} />
            {initialProfile.secondaryRisk && <ProfileRow index="02" label={t('onboarding.secondaryRisk')} value={t(riskLabelKey(initialProfile.secondaryRisk))} tone={colors.recovering} />}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function getRepeatedCause(mistakes: readonly MistakeRecord[]) {
  const counts = new Map<NonNullable<MistakeRecord['cause']>, number>();
  mistakes.forEach((mistake) => {
    if (mistake.cause) counts.set(mistake.cause, (counts.get(mistake.cause) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).find(([, count]) => count >= 2)?.[0] ?? null;
}

function ProfileRow({ index, label, value, tone }: { index: string; label: string; value: string; tone: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileIndex}>{index}</Text><View style={[styles.profileMarker, { backgroundColor: tone }]} />
      <View style={styles.profileCopy}><Text style={styles.profileLabel}>{label}</Text><Text style={styles.profileValue}>{value}</Text></View>
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { paddingBottom: 116 },
  screen: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.muted, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 },
  intro: { marginTop: spacing.xl, marginBottom: spacing.lg, maxWidth: 580 },
  eyebrow: { color: colors.signal, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.3, marginBottom: spacing.sm, textTransform: 'uppercase' },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 38, lineHeight: 40, letterSpacing: -2 },
  subtitle: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, maxWidth: 520 },
  emptyStage: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
  scanField: { height: 124, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scanRingOuter: { position: 'absolute', width: 116, height: 116, borderRadius: 62, borderWidth: 1, borderColor: colors.violet, opacity: 0.36 },
  scanRing: { position: 'absolute', width: 82, height: 82, borderRadius: 44, borderWidth: 1, borderColor: colors.signal, opacity: 0.56 },
  scanCore: { width: 50, height: 50, borderRadius: 27, backgroundColor: colors.risk, alignItems: 'center', justifyContent: 'center' },
  scanLine: { position: 'absolute', height: 1, width: '100%', backgroundColor: colors.risk, opacity: 0.5 },
  emptySignal: { color: colors.muted, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.8, textAlign: 'center', marginBottom: spacing.lg, textTransform: 'uppercase' },
  evidenceStage: { backgroundColor: colors.navRaised, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.lg },
  evidenceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  evidenceCopy: { flex: 1, paddingRight: spacing.md },
  evidenceLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1, textTransform: 'uppercase' },
  evidenceCount: { color: colors.onDark, fontFamily: type.extraBold, fontSize: 23, letterSpacing: -0.8, marginTop: 5 },
  evidenceHint: { color: colors.darkMuted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 5 },
  signalOrb: { width: 78, height: 78, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  signalOrbitOuter: { position: 'absolute', width: 78, height: 78, borderRadius: 40, borderWidth: 1, borderColor: colors.violet },
  signalOrbitInner: { position: 'absolute', width: 61, height: 61, borderRadius: 32, borderWidth: 2, borderColor: colors.signal, borderRightColor: colors.darkLine },
  counterText: { color: colors.onDark, fontFamily: type.extraBold, fontSize: 23, lineHeight: 25, letterSpacing: -1 },
  counterTotal: { color: colors.darkMuted, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.8 },
  progressRail: { flexDirection: 'row', gap: 5, marginTop: spacing.lg },
  progressSegment: { height: 5, flex: 1, borderRadius: 3, backgroundColor: colors.darkLine },
  progressActive: { backgroundColor: colors.signal },
  milestone: { color: colors.darkMuted, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.8, marginTop: spacing.xs, marginBottom: spacing.lg },
  evidenceDetails: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  factRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  factMarker: { width: 8, minHeight: 48, borderRadius: 5, backgroundColor: colors.risk },
  factCopy: { flex: 1 },
  factLabel: { color: colors.faint, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 1 },
  factValue: { color: colors.ink, fontFamily: type.bold, fontSize: 14, lineHeight: 20, marginTop: 4 },
  factMeta: { color: colors.muted, fontFamily: type.regular, fontSize: 10, marginTop: 4 },
  topicsSection: { marginTop: spacing.xl },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  sectionCopy: { flex: 1 },
  sectionEyebrow: { color: colors.risk, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1 },
  sectionTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 23, letterSpacing: -0.8, marginTop: 4 },
  sectionMeta: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.8 },
  sectionBody: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  topicList: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  topicRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing.sm },
  topicPressed: { opacity: 0.72 },
  topicIndex: { width: 24 },
  topicIndexText: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8 },
  topicThumbnail: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.elevated },
  topicGlyph: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.violetWash, alignItems: 'center', justifyContent: 'center' },
  topicCopy: { flex: 1 },
  topicTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 15 },
  topicMeta: { color: colors.muted, fontFamily: type.mono, fontSize: 8, letterSpacing: 0.6, marginTop: 5 },
  topicAction: { width: 36, height: 36, borderRadius: 19, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' },
  profilePanel: { backgroundColor: colors.nav, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.lg, marginTop: spacing.xl },
  profileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.darkLine },
  profileEyebrow: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.1 },
  profileMeta: { color: colors.darkMuted, fontFamily: type.mono, fontSize: 7, letterSpacing: 0.8, marginTop: 4 },
  profileRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.darkLine },
  profileIndex: { color: colors.darkMuted, fontFamily: type.mono, fontSize: 8, width: 28 },
  profileMarker: { width: 8, height: 38, borderRadius: 5, marginRight: spacing.md },
  profileCopy: { flex: 1 },
  profileLabel: { color: colors.darkMuted, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.9 },
  profileValue: { color: colors.onDark, fontFamily: type.bold, fontSize: 17, marginTop: 3 },
  prepPreview: { marginTop: spacing.xxl, minHeight: 94, borderRadius: radius.lg, backgroundColor: colors.nav, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prepPreviewIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }, prepPreviewCopy: { flex: 1 }, prepPreviewLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.8 }, prepPreviewTitle: { color: colors.onDark, fontFamily: type.bold, fontSize: 15, marginTop: 3 }, prepPreviewBody: { color: colors.darkMuted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
}));
