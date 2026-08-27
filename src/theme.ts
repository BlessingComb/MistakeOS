import { Platform, StyleSheet } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  canvas: string; paper: string; elevated: string; ink: string; inkSoft: string; muted: string; faint: string;
  line: string; lineStrong: string; risk: string; riskDeep: string; riskWash: string; recovering: string;
  recoveringWash: string; mastered: string; masteredDeep: string; masteredWash: string; signal: string;
  violet: string; violetWash: string; nav: string; navRaised: string; onAccent: string; onDark: string;
  darkMuted: string; darkLine: string; white: string; black: string;
};

export const palettes: Record<ThemeMode, ThemeColors> = {
  light: {
    canvas: '#F2F5F8', paper: '#FFFFFF', elevated: '#F9FBFC', ink: '#111827', inkSoft: '#283347',
    muted: '#667085', faint: '#98A2B3', line: '#DDE3EA', lineStrong: '#C4CCD7', risk: '#FF5968',
    riskDeep: '#C9384B', riskWash: '#FFF0F2', recovering: '#F1AE35', recoveringWash: '#FFF6E2',
    mastered: '#00C99A', masteredDeep: '#007E67', masteredWash: '#E8FBF5', signal: '#00CDEB',
    violet: '#A64DFF', violetWash: '#F5EBFF', nav: '#090D1A', navRaised: '#141A2B', onAccent: '#071019',
    onDark: '#F8FAFC', darkMuted: '#99A3B8', darkLine: '#2B3348', white: '#FFFFFF', black: '#050712',
  },
  dark: {
    canvas: '#070A14', paper: '#101625', elevated: '#151C2E', ink: '#F6F8FC', inkSoft: '#D9DEEA',
    muted: '#929BAF', faint: '#667086', line: '#252D40', lineStrong: '#364159', risk: '#FF6170',
    riskDeep: '#FF8791', riskWash: '#2D1721', recovering: '#F4B846', recoveringWash: '#2B2417',
    mastered: '#00DAA5', masteredDeep: '#55F2C5', masteredWash: '#102A25', signal: '#00D8F4',
    violet: '#B35CFF', violetWash: '#241636', nav: '#090D1A', navRaised: '#151B2D', onAccent: '#061016',
    onDark: '#F8FAFC', darkMuted: '#98A2B8', darkLine: '#2B3348', white: '#FFFFFF', black: '#04060D',
  },
};

let activeMode: ThemeMode = 'dark';

export function activateTheme(mode: ThemeMode) { activeMode = mode; }
export function activeThemeMode() { return activeMode; }

export const colors = new Proxy({} as ThemeColors, {
  get: (_target, property) => typeof property === 'string' ? palettes[activeMode][property as keyof ThemeColors] : undefined,
});

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (palette: ThemeColors) => T): T {
  const cache = new Map<ThemeMode, T>();
  return new Proxy({} as T, {
    get: (_target, property) => {
      if (typeof property !== 'string') return undefined;
      let sheet = cache.get(activeMode);
      if (!sheet) {
        sheet = StyleSheet.create(factory(palettes[activeMode]));
        cache.set(activeMode, sheet);
      }
      return sheet[property as keyof T];
    },
  });
}

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, huge: 72 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const type = {
  // Nunito gives the product its friendly, rounded display voice while staying
  // highly legible in Brazilian Portuguese and English at mobile sizes.
  regular: 'Nunito_400Regular', medium: 'Nunito_500Medium', semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold', extraBold: 'Nunito_900Black', mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
} as const;

export const shadow = Platform.select({
  web: { boxShadow: '0 20px 70px rgba(2, 7, 20, 0.16)' },
  default: { shadowColor: '#020714', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 9 },
});

export const glow = Platform.select({
  web: { boxShadow: '0 0 34px rgba(0, 216, 244, 0.20)' },
  default: { shadowColor: '#00D8F4', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 6 },
});

export const motion = { fast: 160, standard: 280, expressive: 620 } as const;
export const animationDriver = Platform.OS !== 'web';
export type RiskState = 'HIGH RISK' | 'RECOVERING' | 'MASTERED';
export const riskStateColor: Record<RiskState, 'risk' | 'recovering' | 'mastered'> = {
  'HIGH RISK': 'risk', RECOVERING: 'recovering', MASTERED: 'mastered',
};
