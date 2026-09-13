import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from '../i18n';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

export type TabId = 'home' | 'review' | 'dna' | 'prepMap' | 'exams' | 'classrooms' | 'settings';

type Props = { active: TabId; onChange: (tab: TabId) => void };

export function TabBar({ active, onChange }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabs: { id: TabId; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: 'home', label: t('nav.today'), icon: 'home' },
    { id: 'review', label: t('nav.review'), icon: 'file-text' },
    { id: 'prepMap', label: t('nav.prepMap'), icon: 'map' },
    { id: 'classrooms', label: t('nav.classrooms'), icon: 'users' },
    { id: 'settings', label: t('nav.settings'), icon: 'user' },
  ];
  return (
    <View style={styles.shell}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const selected = active === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.id)}
              style={[styles.item, selected && styles.itemActive, width < 480 && styles.itemCompact, selected && width >= 480 && { flex: 2 }]}
            >
              <Feather name={tab.icon} size={18} color={selected ? colors.onAccent : colors.darkMuted} />
              {selected && <Text style={[styles.label, width < 480 && styles.labelCompact]}>{tab.label}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    ...(Platform.OS === 'web' ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' as unknown as number } : {}),
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 560,
    minHeight: 68,
    padding: 8,
    backgroundColor: colors.nav,
    borderWidth: 1,
    borderColor: colors.darkLine,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    height: 52,
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  itemActive: { backgroundColor: colors.signal },
  itemCompact: { flexDirection: 'column', gap: 2 },
  labelCompact: { fontSize: 9, textAlign: 'center', flexShrink: 1 },
  label: { color: colors.onAccent, fontFamily: type.bold, fontSize: 12 },
}));
