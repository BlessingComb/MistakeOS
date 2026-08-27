import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { activateTheme, palettes, type ThemeColors, type ThemeMode } from '../theme';
import { normalizeTheme, THEME_STORAGE_KEY } from './core';

type ThemeContextValue = { colors: ThemeColors; mode: ThemeMode; setMode: (mode: ThemeMode) => Promise<void> };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);
  activateTheme(mode);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => { if (mounted) setModeState(normalizeTheme(stored)); })
      .catch(() => undefined)
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    Haptics.selectionAsync().catch(() => undefined);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ colors: palettes[mode], mode, setMode }), [mode, setMode]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: palettes[mode].canvas }} />;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
