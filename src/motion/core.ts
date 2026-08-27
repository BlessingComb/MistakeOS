import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';
import { Easing } from 'react-native-reanimated';
import { motionTokens } from './tokens';

export const motion = {
  ...motionTokens,
  easing: { standard: Easing.bezier(0.2, 0, 0, 1), enter: Easing.out(Easing.cubic), exit: Easing.in(Easing.cubic) },
} as const;

export function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
}
