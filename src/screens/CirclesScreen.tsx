import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth';
import { trackEvent } from '../analytics';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTranslation } from '../i18n';
import { createCircle, getCircleRanking, joinCircle, leaveCircle, listCirclePosts, listMyCircles, nextMilestone, previewCircle, rankingEntryForUser, shareCirclePost, topRanked, unlockedMilestone, weeklyHighlights, type Circle, type CirclePost, type CirclePreview, type GroupRankingEntry, type GroupRankingHighlight, type GroupRankingPeriod } from '../circles';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Mode = 'list' | 'create' | 'join' | 'feed' | 'share' | 'ranking';
type Translator = ReturnType<typeof useTranslation>['t'];
export function CirclesScreen() {
  const { t, formatDate } = useTranslation();
  const { account } = useAuth();
  const [mode, setMode] = useState<Mode>('list');
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selected, setSelected] = useState<Circle | null>(null);
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [ranking, setRanking] = useState<GroupRankingEntry[]>([]);
  const [rankingPeriod, setRankingPeriod] = useState<GroupRankingPeriod>('week');
  const [celebration, setCelebration] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState(''); const [preview, setPreview] = useState<CirclePreview | null>(null);
  const [shareSubject, setShareSubject] = useState(''); const [summary, setSummary] = useState(''); const [wrong, setWrong] = useState(''); const [lesson, setLesson] = useState(''); const [rule, setRule] = useState('');

  const load = useCallback(async (): Promise<Circle[]> => {
    if (!account) return [];
    setLoading(true); setError(null);
    try { const next = await listMyCircles(account.id); setCircles(next); return next; } catch (cause) { setError(cause instanceof Error ? cause.message : t('circles.offline')); return []; } finally { setLoading(false); }
  }, [account, t]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const recordRankingTransition = async (circleId: string, entries: readonly GroupRankingEntry[]) => { try { if (!account) return; const mine = rankingEntryForUser(entries, account.id); if (!mine) return; const key = `@mistakeos/group-ranking-snapshot:v1:${circleId}:${account.id}`; const raw = await AsyncStorage.getItem(key); const previous = raw ? JSON.parse(raw) as { rank?: number; allTimeCorrectedCount?: number } : null; let message: string | null = null; if (previous && typeof previous.rank === 'number' && typeof previous.allTimeCorrectedCount === 'number') { const milestone = unlockedMilestone(mine.allTimeCorrectedCount, previous.allTimeCorrectedCount); if (mine.rank === 1 && previous.rank !== 1) { trackEvent('group_rank_first_place_reached', {}); message = t('circles.celebrateFirst'); } else if (mine.rank <= 3 && previous.rank > 3) { trackEvent('group_rank_top3_reached', {}); message = t('circles.celebrateTop3'); } else if (mine.rank < previous.rank) { trackEvent('group_rank_position_changed', { delta: previous.rank - mine.rank }); message = t('circles.celebrateRankUp', { count: previous.rank - mine.rank }); } else if (milestone) { trackEvent('group_milestone_unlocked', { milestone }); message = t('circles.celebrateMilestone', { count: milestone }); } } await AsyncStorage.setItem(key, JSON.stringify({ rank: mine.rank, allTimeCorrectedCount: mine.allTimeCorrectedCount })); if (message) setCelebration(message); } catch { /* analytics and celebration storage must never block the group */ } };
  const openCircle = async (circle: Circle) => { setSelected(circle); setMode('feed'); setLoading(true); setError(null); setCelebration(null); try { const [nextPosts, nextRanking] = await Promise.all([listCirclePosts(circle.id), getCircleRanking(circle.id, 'week')]); setPosts(nextPosts); setRanking(nextRanking); setRankingPeriod('week'); void recordRankingTransition(circle.id, nextRanking); } catch (cause) { setError(cause instanceof Error ? cause.message : t('circles.offline')); } finally { setLoading(false); } };
  const goList = () => { setMode('list'); setSelected(null); setPreview(null); setRanking([]); setCelebration(null); setError(null); load(); };
  const openRanking = () => { if (!selected) return; setMode('ranking'); trackEvent('group_ranking_viewed', { period: rankingPeriod }); };
  const changeRankingPeriod = async (period: GroupRankingPeriod) => { if (!selected || period === rankingPeriod) return; setRankingPeriod(period); setLoading(true); setError(null); try { setRanking(await getCircleRanking(selected.id, period)); trackEvent('group_ranking_period_changed', { period }); } catch (cause) { setError(cause instanceof Error ? cause.message : t('circles.offline')); } finally { setLoading(false); } };
  const create = async () => { if (name.trim().length < 2) return setError(t('circles.nameRequired')); setLoading(true); setError(null); try { const circle = await createCircle({ name, subject: 'General' }); trackEvent('circle_created', { subject: 'General' }); setSelected(circle); setMode('feed'); setPosts([]); } catch (cause) { setError(cause instanceof Error ? cause.message : t('circles.createFailed')); } finally { setLoading(false); } };
  const checkCode = async () => { setLoading(true); setError(null); try { const found = await previewCircle(code); if (!found) setError(t('circles.invalidCode')); setPreview(found); } catch { setError(t('circles.invalidCode')); } finally { setLoading(false); } };
  const join = async () => { if (!account) return; setLoading(true); setError(null); try { const joined = await joinCircle(code); trackEvent('circle_joined', { source: 'invite_code' }); const updated = await listMyCircles(account.id); setCircles(updated); const circle = updated.find((entry) => entry.id === joined.id); if (!circle) throw new Error('Circle could not be loaded.'); setSelected(circle); setMode('feed'); setPosts(await listCirclePosts(circle.id)); } catch { setError(t('circles.joinFailed')); } finally { setLoading(false); } };
  const shareInvite = async () => { if (!selected) return; try { await Share.share({ message: t('circles.inviteMessage', { code: selected.inviteCode }) }); trackEvent('circle_invite_shared', { source: 'native_share' }); } catch { /* native share cancellation is expected */ } };
  const publish = async () => { if (!account || !selected) return; if (!shareSubject.trim() || !summary.trim()) return setError(t('circles.shareRequired')); setLoading(true); setError(null); try { const post = await shareCirclePost({ circleId: selected.id, authorId: account.id, subject: shareSubject.trim(), mistakeType: null, problemSummary: summary.trim(), whatWentWrong: wrong.trim() || null, lesson: lesson.trim() || null, preventionRule: rule.trim() || null }); trackEvent('mistake_shared', { source: 'circle_preview' }); setPosts((current) => [post, ...current]); setMode('feed'); } catch { setError(t('circles.shareFailed')); } finally { setLoading(false); } };
  const leave = () => {
    if (!selected || !account || selected.ownerId === account.id) return;
    Alert.alert(t('circles.leaveTitle'), t('circles.leaveBody'), [
      { text: t('circles.leaveCancel'), style: 'cancel' },
      { text: t('circles.leaveConfirm'), style: 'destructive', onPress: async () => { setLoading(true); setError(null); try { await leaveCircle(selected.id, account.id); goList(); } catch { setError(t('circles.leaveError')); setLoading(false); } } },
    ]);
  };

  if (!account) return null;
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.screen}>
    <View style={styles.header}><BrandMark /><Text style={styles.overline}>{t('circles.overline')}</Text></View>
    {mode !== 'list' && <Pressable accessibilityRole="button" onPress={mode === 'ranking' ? () => setMode('feed') : goList} style={styles.back}><Feather name="arrow-left" size={17} color={colors.ink} /><Text style={styles.backLabel}>{t('common.back')}</Text></Pressable>}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {mode === 'list' && <>
      <Text style={styles.title}>{t('circles.title')}</Text><Text style={styles.body}>{t('circles.body')}</Text>
      {loading ? <ActivityIndicator color={colors.signal} /> : circles.length === 0 ? <View style={styles.empty}><Feather name="users" size={30} color={colors.signal} /><Text style={styles.emptyTitle}>{t('circles.emptyTitle')}</Text><Text style={styles.body}>{t('circles.emptyBody')}</Text><PrimaryButton label={t('circles.create')} onPress={() => { trackEvent('circle_create_started', {}); setMode('create'); }} /><Pressable onPress={() => { trackEvent('circle_join_started', {}); setMode('join'); }}><Text style={styles.secondary}>{t('circles.joinCode')}</Text></Pressable></View> : <>
        <View style={styles.actionRow}><PrimaryButton label={t('circles.create')} onPress={() => { trackEvent('circle_create_started', {}); setMode('create'); }} /><Pressable onPress={() => { trackEvent('circle_join_started', {}); setMode('join'); }} style={styles.join}><Text style={styles.joinText}>{t('circles.joinCode')}</Text></Pressable></View>
        {circles.map((circle) => <Pressable key={circle.id} accessibilityRole="button" accessibilityLabel={circle.name} onPress={() => openCircle(circle)} style={styles.circleCard}><View style={styles.circleIcon}><Feather name="target" size={19} color={colors.signal} /></View><View style={styles.grow}><Text style={styles.circleName}>{circle.name}</Text></View><Feather name="arrow-up-right" size={19} color={colors.signal} /></Pressable>)}
      </>}
    </>}
    {mode === 'create' && <><Text style={styles.title}>{t('circles.createTitle')}</Text><Text style={styles.body}>{t('circles.createBody')}</Text><Label label={t('circles.name')}><TextInput value={name} onChangeText={setName} placeholder={t('circles.namePlaceholder')} placeholderTextColor={colors.muted} style={styles.input} /></Label><PrimaryButton label={t('circles.create')} onPress={create} /></>}
    {mode === 'join' && <><Text style={styles.title}>{t('circles.joinTitle')}</Text><Text style={styles.body}>{t('circles.joinBody')}</Text><Label label={t('circles.inviteCode')}><TextInput autoCapitalize="characters" value={code} onChangeText={(value) => { setCode(value); setPreview(null); }} placeholder="ABC-1234" placeholderTextColor={colors.muted} style={styles.input} /></Label>{preview ? <View style={styles.preview}><Text style={styles.circleName}>{preview.name}</Text><Text style={styles.circleSubject}>{t('circles.members', { count: preview.memberCount })}</Text><PrimaryButton label={t('circles.join')} onPress={join} /></View> : <PrimaryButton label={t('circles.preview')} onPress={checkCode} />}</>}
    {mode === 'feed' && selected && <>
      <Text style={styles.title}>{selected.name}</Text>
      {selected.goal && <Text style={styles.body}>{selected.goal}</Text>}
      <View style={styles.invite}><Text style={styles.inviteMeta}>{t('circles.inviteCode')}</Text><Text style={styles.code}>{selected.inviteCode}</Text><Pressable onPress={shareInvite}><Text style={styles.secondary}>{t('circles.shareInvite')}</Text></Pressable></View>
      {selected.ownerId !== account.id && <Pressable accessibilityRole="button" onPress={leave}><Text style={styles.secondary}>{t('circles.leave')}</Text></Pressable>}
      <PrimaryButton label={t('circles.shareMistake')} onPress={() => { setShareSubject(''); setSummary(''); setWrong(''); setLesson(''); setRule(''); setMode('share'); }} />
      {celebration && <View style={styles.rankingCard}><Feather name="award" size={17} color={colors.mastered} /><Text style={styles.rankingEmptyTitle}>{celebration}</Text></View>}
      <GroupRankingCompact entries={ranking} currentUserId={account.id} onOpen={openRanking} t={t} />
      <GroupHighlights entries={ranking} t={t} />
      <Text style={styles.section}>{t('circles.sharedMistakes')}</Text>
      {loading ? <ActivityIndicator color={colors.signal} /> : posts.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>{t('circles.feedEmpty')}</Text><Text style={styles.body}>{t('circles.feedEmptyBody')}</Text></View> : posts.map((post) => <View key={post.id} style={styles.post}><Text style={styles.postOverline}>{post.subject}{post.mistakeType ? ` / ${post.mistakeType}` : ''}</Text>{post.problemSummary && <Text style={styles.postTitle}>{post.problemSummary}</Text>}{post.whatWentWrong && <PostBlock label={t('circles.wrong')} value={post.whatWentWrong} />}{post.lesson && <PostBlock label={t('circles.lesson')} value={post.lesson} />}{post.preventionRule && <PostBlock label={t('circles.neverAgain')} value={post.preventionRule} />}<Text style={styles.date}>{formatDate(new Date(post.createdAt))}</Text></View>)}
    </>}
    {mode === 'ranking' && selected && <GroupRankingScreen entries={ranking} currentUserId={account.id} period={rankingPeriod} loading={loading} onPeriodChange={changeRankingPeriod} t={t} />}
    {mode === 'share' && selected && <><Text style={styles.title}>{t('circles.shareTitle')}</Text><Text style={styles.body}>{t('circles.shareBody')}</Text><Label label={t('circles.shareSubject')}><TextInput value={shareSubject} onChangeText={setShareSubject} style={styles.input} placeholderTextColor={colors.muted} /></Label><Label label={t('circles.summary')}><TextInput value={summary} onChangeText={setSummary} multiline style={[styles.input, styles.multiline]} placeholder={t('circles.summaryPlaceholder')} placeholderTextColor={colors.muted} /></Label><Label label={t('circles.wrong')}><TextInput value={wrong} onChangeText={setWrong} multiline style={[styles.input, styles.multiline]} placeholder={t('circles.optional')} placeholderTextColor={colors.muted} /></Label><Label label={t('circles.lesson')}><TextInput value={lesson} onChangeText={setLesson} multiline style={[styles.input, styles.multiline]} placeholder={t('circles.optional')} placeholderTextColor={colors.muted} /></Label><Label label={t('circles.neverAgain')}><TextInput value={rule} onChangeText={setRule} multiline style={[styles.input, styles.multiline]} placeholder={t('circles.optional')} placeholderTextColor={colors.muted} /></Label><PrimaryButton label={t('circles.shareConfirm')} onPress={publish} /></>}
  </View></ScrollView>;
}
function GroupRankingCompact({ entries, currentUserId, onOpen, t }: { entries: readonly GroupRankingEntry[]; currentUserId: string; onOpen: () => void; t: Translator }) {
  const mine = rankingEntryForUser(entries, currentUserId);
  const leaders = topRanked(entries);
  if (!entries.some((entry) => entry.correctedCount > 0)) return <View style={styles.rankingCard}><Text style={styles.rankingEyebrow}>{t('circles.rankingWeek')}</Text><Text style={styles.rankingEmptyTitle}>{t('circles.rankingEmpty')}</Text><Text style={styles.rankingEmptyBody}>{t('circles.rankingEmptyBody')}</Text></View>;
  return <View style={styles.rankingCard}>
    <View style={styles.rankingHeading}><View><Text style={styles.rankingEyebrow}>{t('circles.rankingWeek')}</Text><Text style={styles.rankingTitle}>{t('circles.rankingTitle')}</Text></View><Feather name="bar-chart-2" size={19} color={colors.signal} /></View>
    <View style={styles.leaders}>{leaders.map((entry) => <View key={entry.userId} style={[styles.leader, entry.rank === 1 && styles.leaderFirst]}><Text style={styles.leaderRank}>#{entry.rank}</Text><View style={styles.grow}><Text numberOfLines={1} style={styles.leaderName}>{entry.displayName}</Text><Text style={styles.leaderMeta}>{t('circles.correctedCount', { count: entry.correctedCount })}</Text></View><Text style={styles.leaderRate}>{entry.correctionRate.toFixed(0)}%</Text></View>)}</View>
    {mine && <UserRankingCard entry={mine} compact t={t} />}
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.rankingLink}><Text style={styles.rankingLinkText}>{t('circles.openRanking')}</Text><Feather name="arrow-right" size={16} color={colors.signal} /></Pressable>
  </View>;
}

function GroupHighlights({ entries, t }: { entries: readonly GroupRankingEntry[]; t: Translator }) {
  const highlights = weeklyHighlights(entries);
  if (highlights.length === 0) return null;
  return <View style={styles.highlights}>
    <Text style={styles.section}>{t('circles.groupHighlights')}</Text>
    <Text style={styles.body}>{t('circles.groupHighlightsBody')}</Text>
    {highlights.map(({ kind, entry }) => <View key={kind} style={styles.highlight}>
      <Text style={styles.highlightLabel}>{t(`circles.highlight.${kind}`)}</Text>
      <Text style={styles.highlightName}>{groupHighlightTitle(kind, entry, t)}</Text>
      <Text style={styles.highlightValue}>{groupHighlightNote(kind, t)}</Text>
    </View>)}
  </View>;
}

function groupHighlightTitle(kind: GroupRankingHighlight, entry: GroupRankingEntry, t: Translator) {
  if (kind === 'mostCorrected') return t('circles.spotlight.mostCorrected', { name: entry.displayName, count: entry.correctedCount });
  if (kind === 'mostConsistent') return t('circles.spotlight.mostConsistent', { name: entry.displayName, count: entry.activeDays });
  if (kind === 'bestRate') return t('circles.spotlight.bestRate', { name: entry.displayName, rate: entry.correctionRate.toFixed(0) });
  return t('circles.spotlight.biggestClimb', { name: entry.displayName, count: entry.rankDelta });
}

function groupHighlightNote(kind: GroupRankingHighlight, t: Translator) {
  if (kind === 'mostCorrected') return t('circles.spotlightNote.mostCorrected');
  if (kind === 'mostConsistent') return t('circles.spotlightNote.mostConsistent');
  if (kind === 'bestRate') return t('circles.spotlightNote.bestRate');
  return t('circles.spotlightNote.biggestClimb');
}

function GroupRankingScreen({ entries, currentUserId, period, loading, onPeriodChange, t }: { entries: readonly GroupRankingEntry[]; currentUserId: string; period: GroupRankingPeriod; loading: boolean; onPeriodChange: (period: GroupRankingPeriod) => void; t: Translator }) {
  const mine = rankingEntryForUser(entries, currentUserId);
  const leaders = topRanked(entries);
  const highlights = weeklyHighlights(entries);
  return <>
    <Text style={styles.title}>{t('circles.rankingTitle')}</Text>
    <View accessibilityRole="tablist" style={styles.periodControl}>{(['week', 'month', 'total'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: period === item }} onPress={() => onPeriodChange(item)} style={[styles.period, period === item && styles.periodActive]}><Text style={[styles.periodText, period === item && styles.periodTextActive]}>{t(`circles.rankingPeriod.${item}`)}</Text></Pressable>)}</View>
    {loading ? <ActivityIndicator color={colors.signal} /> : !entries.some((entry) => entry.correctedCount > 0) ? <View style={styles.empty}><Text style={styles.emptyTitle}>{t('circles.rankingEmpty')}</Text><Text style={styles.body}>{t('circles.rankingEmptyBody')}</Text></View> : <>
      <Text style={styles.section}>{t('circles.rankingLeaders')}</Text>
      <View style={styles.topThree}>{leaders.map((entry) => <View key={entry.userId} style={[styles.podium, entry.rank === 1 && styles.podiumFirst]}><Text style={styles.podiumRank}>#{entry.rank}</Text><Text numberOfLines={1} style={styles.podiumName}>{entry.displayName}</Text><Text style={styles.podiumMetric}>{t('circles.correctedCount', { count: entry.correctedCount })}</Text><Text style={styles.podiumRate}>{entry.correctionRate.toFixed(0)}% {t('circles.correctionRate')}</Text></View>)}</View>
      {mine && <><Text style={styles.section}>{t('circles.yourPosition')}</Text><UserRankingCard entry={mine} t={t} /></>}
      {highlights.length > 0 && <><Text style={styles.section}>{t('circles.weeklyHighlights')}</Text><View style={styles.highlights}>{highlights.map(({ kind, entry }) => <View key={kind} style={styles.highlight}><Text style={styles.highlightLabel}>{t(`circles.highlight.${kind}`)}</Text><Text style={styles.highlightName}>{entry.displayName}</Text><Text style={styles.highlightValue}>{kind === 'mostConsistent' ? t('circles.activeDays', { count: entry.activeDays }) : kind === 'biggestClimb' ? t('circles.rankUp', { count: entry.rankDelta }) : kind === 'bestRate' ? `${entry.correctionRate.toFixed(0)}% ${t('circles.correctionRate')}` : t('circles.correctedCount', { count: entry.correctedCount })}</Text></View>)}</View></>}
      <Text style={styles.section}>{t('circles.rankingAll')}</Text>
      <View style={styles.rankingList}>{entries.slice(3).map((entry) => <RankingRow key={entry.userId} entry={entry} isCurrent={entry.userId === currentUserId} t={t} />)}</View>
    </>}
  </>;
}

function UserRankingCard({ entry, compact = false, t }: { entry: GroupRankingEntry; compact?: boolean; t: Translator }) {
  const next = nextMilestone(entry.allTimeCorrectedCount);
  return <View style={[styles.userRanking, compact && styles.userRankingCompact]}><View style={styles.userRankingTop}><View><Text style={styles.userRankingLabel}>{compact ? t('circles.yourPosition') : t('circles.yourPosition')}</Text><Text style={styles.userRank}>#{entry.rank}</Text></View><RankChange delta={entry.rankDelta} t={t} /></View><Text style={styles.userMetric}>{t('circles.correctedCount', { count: entry.correctedCount })} · {entry.correctionRate.toFixed(0)}% {t('circles.correctionRate')}</Text>{entry.streakDays > 0 && <Text style={styles.userStreak}>{t('circles.streak', { count: entry.streakDays })}</Text>}{entry.rank > 1 && <Text style={styles.userDistance}>{t('circles.distanceToNext', { count: entry.distanceToNextRank, rank: entry.rank - 1 })}</Text>}{next && <Text style={styles.userMilestone}>{t('circles.nextMilestone', { count: next })}</Text>}</View>;
}

function RankingRow({ entry, isCurrent, t }: { entry: GroupRankingEntry; isCurrent: boolean; t: Translator }) {
  return <View style={[styles.rankingRow, isCurrent && styles.rankingRowCurrent]}><Text style={styles.rankingRowRank}>#{entry.rank}</Text><View style={styles.grow}><Text style={styles.rankingRowName}>{entry.displayName}</Text><Text style={styles.rankingRowMeta}>{t('circles.correctedCount', { count: entry.correctedCount })} · {entry.correctionRate.toFixed(0)}%</Text></View><RankChange delta={entry.rankDelta} t={t} /></View>;
}

function RankChange({ delta, t }: { delta: number; t: Translator }) {
  if (delta > 0) return <Text style={styles.rankUp}>{t('circles.rankUp', { count: delta })}</Text>;
  if (delta < 0) return <Text style={styles.rankDown}>{t('circles.rankDown', { count: Math.abs(delta) })}</Text>;
  return <Text style={styles.rankSame}>{t('circles.rankSame')}</Text>;
}
function Label({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
function PostBlock({ label, value }: { label: string; value: string }) { return <View style={styles.postBlock}><Text style={styles.postLabel}>{label}</Text><Text style={styles.postText}>{value}</Text></View>; }

const styles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { paddingBottom: 108 }, screen: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, overline: { fontFamily: type.monoBold, fontSize: 9, color: colors.signal, letterSpacing: 1 },
  back: { flexDirection: 'row', gap: 8, alignItems: 'center' }, backLabel: { color: colors.ink, fontFamily: type.bold },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 35, lineHeight: 39, letterSpacing: -1.2 }, body: { color: colors.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 22 },
  empty: { minHeight: 260, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'flex-start', gap: spacing.md }, emptyTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 20 },
  secondary: { color: colors.signal, fontFamily: type.bold, paddingVertical: 8 }, actionRow: { gap: spacing.sm }, join: { alignItems: 'center' }, joinText: { color: colors.signal, fontFamily: type.bold, padding: 9 },
  circleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: radius.lg }, circleIcon: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.nav, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1 }, circleName: { color: colors.ink, fontFamily: type.bold, fontSize: 16 }, circleSubject: { color: colors.muted, fontFamily: type.regular, marginTop: 3 },
  field: { gap: 8 }, label: { color: colors.ink, fontFamily: type.bold, fontSize: 13 }, input: { minHeight: 54, borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontFamily: type.regular, fontSize: 16 }, multiline: { minHeight: 92, paddingTop: spacing.sm, textAlignVertical: 'top' },
  preview: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }, invite: { padding: spacing.lg, gap: 7, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, inviteMeta: { color: colors.muted, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1 }, code: { color: colors.signal, fontFamily: type.extraBold, fontSize: 28, letterSpacing: 2 },
  section: { color: colors.ink, fontFamily: type.bold, fontSize: 18, marginTop: spacing.sm }, post: { gap: 10, padding: spacing.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg }, postOverline: { color: colors.signal, fontFamily: type.monoBold, fontSize: 9, letterSpacing: .8 }, postTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 18 }, postBlock: { gap: 2 }, postLabel: { color: colors.muted, fontFamily: type.monoBold, fontSize: 9, letterSpacing: .7 }, postText: { color: colors.ink, fontFamily: type.regular, fontSize: 14, lineHeight: 20 }, date: { color: colors.faint, fontFamily: type.mono, fontSize: 10 }, error: { color: colors.risk, fontFamily: type.regular, lineHeight: 19 },
  rankingCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, gap: spacing.md }, rankingHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, rankingEyebrow: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 }, rankingTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 20, marginTop: 4 }, rankingEmptyTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 17 }, rankingEmptyBody: { color: colors.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 19 },
  leaders: { gap: 7 }, leader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.nav }, leaderFirst: { backgroundColor: colors.violetWash, borderWidth: 1, borderColor: colors.signal }, leaderRank: { color: colors.signal, fontFamily: type.monoBold, fontSize: 11, width: 28 }, leaderName: { color: colors.onDark, fontFamily: type.bold, fontSize: 14 }, leaderMeta: { color: colors.darkMuted, fontFamily: type.mono, fontSize: 8, marginTop: 2 }, leaderRate: { color: colors.signal, fontFamily: type.bold, fontSize: 12 }, rankingLink: { minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7 }, rankingLinkText: { color: colors.signal, fontFamily: type.bold, fontSize: 13 },
  userRanking: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.nav, borderWidth: 1, borderColor: colors.darkLine, gap: 5 }, userRankingCompact: { marginTop: spacing.xs }, userRankingTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, userRankingLabel: { color: colors.darkMuted, fontFamily: type.monoBold, fontSize: 8, letterSpacing: .8 }, userRank: { color: colors.onDark, fontFamily: type.extraBold, fontSize: 28, lineHeight: 30 }, userMetric: { color: colors.onDark, fontFamily: type.semibold, fontSize: 13 }, userStreak: { color: colors.mastered, fontFamily: type.bold, fontSize: 12 }, userDistance: { color: colors.signal, fontFamily: type.regular, fontSize: 12, lineHeight: 17 }, userMilestone: { color: colors.darkMuted, fontFamily: type.mono, fontSize: 8, letterSpacing: .3 },
  periodControl: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, period: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill }, periodActive: { backgroundColor: colors.signal }, periodText: { color: colors.muted, fontFamily: type.bold, fontSize: 12 }, periodTextActive: { color: colors.onAccent }, topThree: { gap: spacing.sm },
  podium: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, gap: 4 }, podiumFirst: { borderColor: colors.signal, backgroundColor: colors.violetWash }, podiumRank: { color: colors.signal, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1 }, podiumName: { color: colors.ink, fontFamily: type.bold, fontSize: 18 }, podiumMetric: { color: colors.muted, fontFamily: type.regular, fontSize: 13 }, podiumRate: { color: colors.signal, fontFamily: type.bold, fontSize: 11 },
  highlights: { gap: spacing.sm }, highlight: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, gap: 3 }, highlightLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: .8 }, highlightName: { color: colors.ink, fontFamily: type.bold, fontSize: 16 }, highlightValue: { color: colors.muted, fontFamily: type.regular, fontSize: 12 },
  rankingList: { borderTopWidth: 1, borderTopColor: colors.line }, rankingRow: { minHeight: 62, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }, rankingRowCurrent: { backgroundColor: colors.violetWash }, rankingRowRank: { color: colors.signal, fontFamily: type.monoBold, fontSize: 10, width: 31 }, rankingRowName: { color: colors.ink, fontFamily: type.bold, fontSize: 14 }, rankingRowMeta: { color: colors.muted, fontFamily: type.mono, fontSize: 8, marginTop: 3 }, rankUp: { color: colors.mastered, fontFamily: type.monoBold, fontSize: 10 }, rankDown: { color: colors.risk, fontFamily: type.monoBold, fontSize: 10 }, rankSame: { color: colors.faint, fontFamily: type.monoBold, fontSize: 10 },
}));
