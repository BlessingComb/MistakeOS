import { ReactNode, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { animationDriver, colors, createThemedStyles, motion, radius, spacing, type } from '../theme';

type Props = {
  label: string;
  meta?: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'dark' | 'risk' | 'mastered';
  icon?: ReactNode;
};

export function PrimaryButton({ label, meta, onPress, disabled = false, tone = 'dark', icon }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const gradient: readonly [string, string] = tone === 'risk'
    ? [colors.risk, colors.riskDeep]
    : tone === 'mastered'
      ? [colors.mastered, colors.signal]
      : [colors.violet, colors.signal];
  const foreground = colors.onAccent;

  const animate = (toValue: number) => Animated.timing(scale, {
    toValue,
    duration: motion.fast,
    useNativeDriver: animationDriver,
  }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        style={[styles.button, disabled && styles.disabled]}
      >
        <LinearGradient colors={gradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gradient} />
        <View style={styles.labelRow}>
          {icon}
          <View style={styles.copy}>
            <Text style={[styles.label, { color: foreground }]}>{label}</Text>
            {!!meta && <Text style={[styles.meta, { color: foreground }]}>{meta}</Text>}
          </View>
        </View>
        <View style={styles.iconWrap}>
          <Feather name="arrow-up-right" size={18} color={foreground} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  button: {
    minHeight: 72,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gradient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  disabled: { opacity: 0.52 },
  labelRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  label: { fontFamily: type.bold, fontSize: 16, letterSpacing: -0.35 },
  meta: { fontFamily: type.mono, fontSize: 10, opacity: 0.58, marginTop: 3, letterSpacing: 0.5 },
  iconWrap: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(7, 16, 25, 0.32)', backgroundColor: 'rgba(255,255,255,0.18)' },
}));
