import { StyleSheet, Text, View } from 'react-native';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Props = { compact?: boolean; inverse?: boolean };

export function BrandMark({ compact = false, inverse = false }: Props) {
  const foreground = inverse ? colors.onDark : colors.ink;

  return (
    <View style={styles.wrap}>
      <View style={[styles.glyph, { borderColor: foreground }]}>
        <View style={[styles.cut, { backgroundColor: inverse ? colors.nav : colors.canvas }]} />
        <View style={styles.core} />
      </View>
      {!compact && (
        <Text style={[styles.wordmark, { color: foreground }]}>mistake<Text style={styles.os}>OS</Text></Text>
      )}
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  glyph: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-14deg' }],
    overflow: 'hidden',
  },
  cut: { position: 'absolute', width: 4, height: 32, transform: [{ rotate: '24deg' }] },
  core: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.signal },
  wordmark: { fontFamily: type.extraBold, fontSize: 18, letterSpacing: -0.7 },
  os: { color: colors.signal },
}));
