import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../i18n';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

export type TabId = 'home' | 'review' | 'dna' | 'prepMap' | 'exams' | 'classrooms' | 'settings';

type Props = { active: TabId; onChange: (tab: TabId) => void };

export function TabBar({ active, onChange }: Props) {
  const { t } = useTranslation();
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
              style={[styles.item, selected && styles.itemActive]}
            >
              <Feather name={tab.icon} size={18} color={selected ? colors.onAccent : colors.darkMuted} />
              {selected && <Text style={styles.label}>{tab.label}</Text>}
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
    minWidth: 52,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  itemActive: { backgroundColor: colors.signal },
  label: { color: colors.onAccent, fontFamily: type.bold, fontSize: 12 },
}));
