import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { colors } from '../theme';
import { AppLanguage, LanguageController, localeForLanguage, translate, TranslationParams } from './core';
import type { TranslationKey } from './en';

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => {
    const localeTags = getLocales().map((locale) => locale.languageTag);
    return new LanguageController(AsyncStorage, localeTags);
  });
  const [language, setLanguageState] = useState<AppLanguage>(controller.language);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = controller.subscribe(setLanguageState);
    controller.initialize().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [controller]);

  const value = useMemo<I18nContextValue>(() => {
    const locale = localeForLanguage(language);
    return {
      language,
      setLanguage: (nextLanguage) => controller.setLanguage(nextLanguage),
      t: (key, params) => translate(language, key, params),
      formatDate: (date, options) => new Intl.DateTimeFormat(locale, options).format(date),
      formatNumber: (number, options) => new Intl.NumberFormat(locale, options).format(number),
    };
  }, [controller, language]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used inside I18nProvider');
  return context;
}
