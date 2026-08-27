import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './config';
export const supabaseConfig = resolveSupabaseConfig({ url: process.env.EXPO_PUBLIC_SUPABASE_URL, anonKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY });
export const supabase = supabaseConfig ? createClient(supabaseConfig.url, supabaseConfig.anonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' } }) : null;
export type SupabaseAvailability = 'configured' | 'unavailable';
export const supabaseAvailability: SupabaseAvailability = supabase ? 'configured' : 'unavailable';
export async function signInAnonymously() {
  if (!supabase) return { status: 'unavailable' as const, userId: null };
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return { status: 'error' as const, userId: null };
  return { status: 'signed_in' as const, userId: data.user?.id ?? null };
}
