import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ExamDraft, ExamRecord } from '../exams';
import { useTranslation } from '../i18n';
import { SUBJECT_OPTIONS, SubjectId } from '../onboarding';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Props = {
  exams: ExamRecord[];
  onSave: (draft: ExamDraft) => Promise<unknown>;
  onRemove: (exam: ExamRecord) => Promise<void>;
  onOpenPrepMap: () => void;
};

const isoDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => new Date(`${value}T12:00:00`);

export function ExamsScreen({ exams, onSave, onRemove, onOpenPrepMap }: Props) {
  const { t, formatDate } = useTranslation();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(today));
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [subject, setSubject] = useState<SubjectId>('mathematics');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<"save" | "remove" | null>(null);

  const days = useMemo(() => calendarDays(month), [month]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => formatDate(new Date(2023, 0, 1 + index), { weekday: 'narrow' })), [formatDate]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setOperationError(null);
    try {
      await onSave({ date: selectedDate, subject, notes });
      setNotes('');
    } catch {
      setOperationError('save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (exam: ExamRecord) => {
    if (removingId) return;
    setRemovingId(exam.id);
    setOperationError(null);
    try {
      await onRemove(exam);
    } catch {
      setOperationError('remove');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('exams.title')}</Text>
      <Text style={styles.body}>{t('exams.body')}</Text>

      <View style={styles.calendarCard}>
        <View style={styles.calendarTop}>
          <Text style={styles.calendarLabel}>{t('exams.calendar')}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.selectedDate}>{t('exams.selectedDate', { date: formatDate(parseDate(selectedDate), { day: 'numeric', month: 'short' }) })}</Text>
        </View>
        <View style={styles.monthControls}>
          <CalendarButton icon="chevron-left" label={t('exams.previousMonth')} onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} />
          <Text style={styles.monthTitle}>{formatDate(month, { month: 'long', year: 'numeric' })}</Text>
          <CalendarButton icon="chevron-right" label={t('exams.nextMonth')} onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} />
        </View>
        <View style={styles.weekdays}>{weekdays.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.days}>
          {days.map((day, index) => day ? (
            <Pressable
              key={day.iso}
              accessibilityRole="button"
              accessibilityLabel={formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
              accessibilityState={{ selected: selectedDate === day.iso }}
              onPress={() => { setSelectedDate(day.iso); setMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1)); }}
              style={[styles.day, selectedDate === day.iso && styles.daySelected, isoDate(today) === day.iso && selectedDate !== day.iso && styles.dayToday]}
            >
              <Text style={[styles.dayText, selectedDate === day.iso && styles.dayTextSelected]}>{day.date.getDate()}</Text>
            </Pressable>
          ) : <View key={`blank-${index}`} style={styles.day} />)}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>{t('exams.subject')}</Text>
        <View style={styles.subjectGrid}>
          {SUBJECT_OPTIONS.map((option) => {
            const selected = subject === option.id;
            return <Pressable key={option.id} onPress={() => setSubject(option.id)} style={[styles.subject, selected && styles.subjectSelected]}><Text style={[styles.subjectText, selected && styles.subjectTextSelected]}>{t(option.labelKey)}</Text></Pressable>;
          })}
        </View>
        <Text style={[styles.fieldLabel, styles.notesLabel]}>{t('exams.notes')}</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder={t('exams.notesPlaceholder')} placeholderTextColor={colors.faint} multiline textAlignVertical="top" style={styles.notes} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={save} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, saving && styles.disabled]}>
          <Text style={styles.saveText}>{saving ? t('exams.saving') : t('exams.save')}</Text><Feather name="arrow-up-right" size={18} color={colors.onAccent} />
          <Text style={styles.saveMeta}>{t('exams.saveMeta')}</Text>
        </Pressable>
        {operationError === 'save' && <Text accessibilityRole="alert" style={styles.operationError}>{t('exams.saveError')}</Text>}
      </View>

      <View style={styles.timelineHeader}><Text style={styles.timelineTitle}>{t('exams.upcoming')}</Text><Text style={styles.timelineCount}>{exams.length}</Text></View>
      {exams.length === 0 ? <View style={styles.empty}><Feather name="calendar" size={21} color={colors.signal} /><Text style={styles.emptyTitle}>{t('exams.emptyTitle')}</Text><Text style={styles.emptyBody}>{t('exams.emptyBody')}</Text></View> : exams.map((exam) => <ExamItem key={exam.id} exam={exam} today={today} removing={removingId === exam.id} onRemove={remove} onOpenPrepMap={onOpenPrepMap} />)}
      {operationError === 'remove' && <Text accessibilityRole="alert" style={styles.operationError}>{t('exams.removeError')}</Text>}
    </ScrollView>
  );
}

function CalendarButton({ icon, label, onPress }: { icon: 'chevron-left' | 'chevron-right'; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}><Feather name={icon} size={19} color={colors.ink} /></Pressable>;
}

function ExamItem({ exam, today, removing, onRemove, onOpenPrepMap }: { exam: ExamRecord; today: Date; removing: boolean; onRemove: (exam: ExamRecord) => Promise<void>; onOpenPrepMap: () => void }) {
  const { t, formatDate } = useTranslation();
  const target = parseDate(exam.date);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const difference = Math.round((target.getTime() - startToday) / 86_400_000);
  const countdown = difference === 0 ? t('exams.today') : difference === 1 ? t('exams.tomorrow') : difference > 1 ? t('exams.inDays', { count: difference }) : t('exams.past');
  const subject = SUBJECT_OPTIONS.find((option) => option.id === exam.subject);
  return <View style={styles.examItem}>
    <View style={styles.examDate}><Text style={styles.examDay}>{target.getDate()}</Text><Text style={styles.examMonth}>{formatDate(target, { month: 'short' }).replace('.', '').toUpperCase()}</Text></View>
    <View style={styles.examCopy}><Text style={styles.examSubject}>{t(subject?.labelKey ?? 'onboarding.subject.other')}</Text><Text style={styles.examCountdown}>{countdown}</Text>{exam.notes ? <Text style={styles.examNotes}>{exam.notes}</Text> : null}<Pressable accessibilityRole="button" onPress={onOpenPrepMap} style={styles.prepMapButton}><Text style={styles.prepMapButtonText}>{t('exams.openPrepMap')}</Text><Feather name="map" size={12} color={colors.signal} /></Pressable></View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('exams.delete')} accessibilityState={{ disabled: removing }} disabled={removing} onPress={() => Alert.alert(t('exams.deleteTitle'), t('exams.deleteBody'), [{ text: t('exams.deleteCancel'), style: 'cancel' }, { text: t('exams.deleteConfirm'), style: 'destructive', onPress: () => { void onRemove(exam); } }])} hitSlop={10} style={[styles.delete, removing && styles.disabled]}><Feather name="trash-2" size={16} color={colors.faint} /></Pressable>
  </View>;
}

function calendarDays(month: Date): ({ date: Date; iso: string } | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days: ({ date: Date; iso: string } | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= total; day += 1) { const date = new Date(month.getFullYear(), month.getMonth(), day); days.push({ date, iso: isoDate(date) }); }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 128 },
  overline: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.15 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 37, lineHeight: 41, letterSpacing: -1.6, marginTop: spacing.sm },
  body: { color: colors.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  calendarCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginTop: spacing.xl },
  calendarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  calendarLabel: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 0.9 },
  selectedDate: { color: colors.faint, fontFamily: type.mono, fontSize: 8, flexShrink: 1, textAlign: 'right' },
  monthControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  monthButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 17, textTransform: 'capitalize' },
  weekdays: { flexDirection: 'row', marginTop: spacing.md }, weekday: { flex: 1, color: colors.faint, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.2, textAlign: 'center' },
  days: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }, day: { width: '14.2857%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, dayToday: { borderWidth: 1, borderColor: colors.signal }, daySelected: { backgroundColor: colors.signal }, dayText: { color: colors.ink, fontFamily: type.semibold, fontSize: 13 }, dayTextSelected: { color: colors.onAccent, fontFamily: type.extraBold },
  formSection: { marginTop: spacing.xl }, fieldLabel: { color: colors.faint, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 }, subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }, subject: { minHeight: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, justifyContent: 'center' }, subjectSelected: { backgroundColor: colors.violet, borderColor: colors.violet }, subjectText: { color: colors.ink, fontFamily: type.semibold, fontSize: 12 }, subjectTextSelected: { color: colors.white }, notesLabel: { marginTop: spacing.lg }, notes: { minHeight: 100, marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink, fontFamily: type.regular, fontSize: 14, lineHeight: 20, padding: spacing.md },
  saveButton: { minHeight: 60, borderRadius: radius.lg, backgroundColor: colors.signal, marginTop: spacing.md, paddingHorizontal: spacing.md, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, position: 'relative' }, saveText: { color: colors.onAccent, fontFamily: type.extraBold, fontSize: 15 }, saveMeta: { position: 'absolute', bottom: 7, color: colors.onAccent, opacity: 0.6, fontFamily: type.monoBold, fontSize: 6, letterSpacing: 0.6 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.sm }, timelineTitle: { color: colors.ink, fontFamily: type.extraBold, fontSize: 20, letterSpacing: -0.7 }, timelineCount: { color: colors.signal, fontFamily: type.extraBold, fontSize: 18 }, empty: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.lg }, emptyTitle: { color: colors.ink, fontFamily: type.bold, fontSize: 16, marginTop: spacing.sm }, emptyBody: { color: colors.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  examItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, marginBottom: spacing.sm }, examDate: { width: 50, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.nav, alignItems: 'center', justifyContent: 'center' }, examDay: { color: colors.onDark, fontFamily: type.extraBold, fontSize: 22, lineHeight: 24 }, examMonth: { color: colors.signal, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.6 }, examCopy: { flex: 1 }, examSubject: { color: colors.ink, fontFamily: type.bold, fontSize: 15 }, examCountdown: { color: colors.signal, fontFamily: type.monoBold, fontSize: 7, letterSpacing: 0.7, marginTop: 3 }, examNotes: { color: colors.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 15, marginTop: 5 }, prepMapButton: { alignSelf: 'flex-start', minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm }, prepMapButtonText: { color: colors.signal, fontFamily: type.bold, fontSize: 10 }, delete: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.55 },
  operationError: { color: colors.risk, fontFamily: type.semibold, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
}));
