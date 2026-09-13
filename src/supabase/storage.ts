import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/**
 * Keeps Supabase credentials in the platform's protected store. The browser
 * has no equivalent keychain/keystore API, so its existing web storage remains
 * the fallback; mobile builds never place auth tokens in AsyncStorage.
 */
const nativeSecureStorage: AuthStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabaseAuthStorage: AuthStorage = Platform.OS === 'web'
  ? AsyncStorage
  : nativeSecureStorage;
