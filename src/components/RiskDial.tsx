import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from 'react-native-svg';
import Reanimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { colors, createThemedStyles, riskStateColor, RiskState, type } from '../theme';
import { motion, useReducedMotionPreference } from '../motion';

type Props = {
  score: number;
  status?: RiskState;
  statusLabel?: string;
  size?: number;
  caption?: string;
};

export function RiskDial({ score, status = 'HIGH RISK', statusLabel = status, size = 248, caption = 'Risk Score' }: Props) {
  const [progress] = useState(() => new Animated.Value(0));
  const [displayScore, setDisplayScore] = useState(score);
  const stroke = Math.max(9, size * 0.045);
  const radius = size * 0.37;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const tone = colors[riskStateColor[status]];
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    const listener = progress.addListener(({ value }) => setDisplayScore(Math.round(value)));
    Animated.spring(progress, {
      toValue: score,
      damping: 18,
      stiffness: 72,
      mass: 0.9,
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(listener);
  }, [progress, score]);

  const ticks = useMemo(() => Array.from({ length: 32 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2 - Math.PI / 2;
    const active = index / 31 <= score / 100;
    const r1 = size * 0.455;
    const r2 = size * (index % 4 === 0 ? 0.488 : 0.475);
    return (
      <Line
        key={index}
        x1={center + Math.cos(angle) * r1}
        y1={center + Math.sin(angle) * r1}
        x2={center + Math.cos(angle) * r2}
        y2={center + Math.sin(angle) * r2}
        stroke={active ? tone : colors.line}
        strokeWidth={index % 4 === 0 ? 2.5 : 1.4}
        strokeLinecap="round"
      />
    );
  }), [center, score, size, tone]);

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${caption}: ${score}, ${statusLabel}`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="riskGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tone} stopOpacity="1" />
            <Stop offset="1" stopColor={status === 'HIGH RISK' ? colors.riskDeep : tone} stopOpacity="0.72" />
          </LinearGradient>
        </Defs>
        {ticks}
        <Circle cx={center} cy={center} r={radius} stroke={colors.line} strokeWidth={stroke} fill="none" opacity={0.62} />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#riskGradient)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - displayScore / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
        <Circle cx={center} cy={center} r={size * 0.29} fill={colors.paper} stroke={colors.line} strokeWidth="1" />
      </Svg>
      <View style={styles.readout}>
        <Text style={[styles.caption, { color: tone }]}>{caption}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{displayScore}</Text>
          <Text style={styles.total}>/100</Text>
        </View>
        <Reanimated.View key={status} entering={reducedMotion ? undefined : FadeIn.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)} style={[styles.status, { backgroundColor: tone }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </Reanimated.View>
      </View>
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  readout: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  caption: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1.5, marginBottom: 2, textTransform: 'uppercase' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  score: { color: colors.ink, fontFamily: type.extraBold, fontSize: 62, letterSpacing: -5, lineHeight: 68 },
  total: { color: colors.muted, fontFamily: type.mono, fontSize: 11, marginLeft: 5 },
  status: { borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5, marginTop: 4 },
  statusText: { color: colors.onAccent, fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.1 },
}));
