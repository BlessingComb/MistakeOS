import type { RevenueCatResolvedConfig } from './types';

export type RevenueCatEnvironment = {
  iosKey?: string;
  androidKey?: string;
  testKey?: string;
};

function publicKey(value: string | undefined): string | null {
  const key = value?.trim();
  if (!key || /^(sk_|secret_)/i.test(key)) return null;
  return key;
}

export function resolveRevenueCatConfig(
  platform: string,
  development: boolean,
  environment: RevenueCatEnvironment,
): RevenueCatResolvedConfig | null {
  if (platform !== 'ios' && platform !== 'android') return null;

  const testKey = publicKey(environment.testKey);
  if (development && testKey) return { apiKey: testKey, source: 'test_store' };

  const platformKey = publicKey(platform === 'ios' ? environment.iosKey : environment.androidKey);
  if (!platformKey) return null;
  return { apiKey: platformKey, source: platform === 'ios' ? 'apple' : 'google_play' };
}

export function getRevenueCatEnvironment(): RevenueCatEnvironment {
  return {
    iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    testKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  };
}
