import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandMark } from '../components/BrandMark';
import { useTranslation } from '../i18n';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';
import type { AuthMode } from '../auth';

export function WelcomeScreen({ onChooseMode }: { onChooseMode: (mode: AuthMode) => void }) {
  const { t } = useTranslation();
  return (
    <LinearGradient colors={[colors.canvas, colors.nav, colors.black]} locations={[0, 0.58, 1]} style={styles.flex}>
      <View pointerEvents="none" style={styles.orbitA} />
      <View pointerEvents="none" style={styles.orbitB} />
      <View style={styles.screen}>
        <BrandMark />
        <View style={styles.copy}>
          <Text style={styles.overline}>{t('welcome.overline')}</Text>
          <Text style={styles.title}>{t('welcome.title')}</Text>
          <Text style={styles.body}>{t('welcome.body')}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => onChooseMode('signIn')} style={styles.primary}>
            <Text style={styles.primaryText}>{t('welcome.signIn')}</Text><Feather name="arrow-up-right" size={18} color={colors.onAccent} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onChooseMode('signUp')} style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('welcome.signUp')}</Text><Feather name="user-plus" size={17} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.note}>{t('welcome.note')}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1, overflow: 'hidden' },
  screen: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', padding: spacing.xl, justifyContent: 'center' },
  orbitA: { position: 'absolute', width: 360, height: 360, borderRadius: 180, borderWidth: 1, borderColor: colors.violet, opacity: 0.22, top: -180, right: -130 },
  orbitB: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: colors.signal, opacity: 0.06, bottom: -160, left: -100 },
  copy: { marginTop: spacing.huge },
  overline: { color: colors.signal, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.2 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 46, lineHeight: 49, letterSpacing: -2.4, marginTop: spacing.md, maxWidth: 410 },
  body: { color: colors.muted, fontFamily: type.regular, fontSize: 16, lineHeight: 24, marginTop: spacing.md, maxWidth: 370 },
  actions: { gap: spacing.sm, marginTop: spacing.huge },
  primary: { minHeight: 58, borderRadius: radius.lg, backgroundColor: colors.signal, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' },
  primaryText: { color: colors.onAccent, fontFamily: type.bold, fontSize: 15 },
  secondary: { minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', backgroundColor: colors.paper },
  secondaryText: { color: colors.ink, fontFamily: type.bold, fontSize: 14 },
  note: { color: colors.faint, fontFamily: type.regular, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: spacing.lg },
}));
