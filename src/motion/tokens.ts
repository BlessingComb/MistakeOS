export const motionTokens = {
  duration: { fast: 160, normal: 280, slow: 520 },
  spring: {
    snappy: { damping: 20, stiffness: 240, mass: 0.8 },
    soft: { damping: 22, stiffness: 150, mass: 0.9 },
    emphasis: { damping: 17, stiffness: 190, mass: 0.85 },
  },
  pressScale: 0.985,
  questionOffset: 14,
} as const;
