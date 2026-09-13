import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type Props = { compact?: boolean; inverse?: boolean };

export function BrandMark({ compact = false, inverse = false }: Props) {
  const foreground = inverse ? colors.onDark : colors.ink;

  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/mistakeos-target-mark.png')} style={styles.glyph} accessibilityLabel="MistakeOS" />
      {!compact && (
        <Text style={[styles.wordmark, { color: foreground }]}>mistake<Text style={styles.os}>OS</Text></Text>
      )}
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  wordmark: { fontFamily: type.extraBold, fontSize: 22, letterSpacing: -0.9 },
  os: { color: colors.signal },
}));
