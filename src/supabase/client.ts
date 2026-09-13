import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './config';
import { supabaseAuthStorage } from './storage';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawSupabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function publicProjectDetails(url?: string): { host: string; ref: string } {
  try {
    const host = new URL(url ?? '').host;
    const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    return { host, ref: match?.[1] ?? 'unrecognized' };
  } catch {
    return { host: 'invalid', ref: 'invalid' };
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const project = publicProjectDetails(rawSupabaseUrl);
  console.info(`[SUPABASE_CONFIG] URL_PRESENT ${Boolean(rawSupabaseUrl?.trim())}`);
  console.info(`[SUPABASE_CONFIG] KEY_PRESENT ${Boolean(rawSupabaseKey?.trim())}`);
  console.info(`[SUPABASE_CONFIG] PROJECT_HOST ${project.host}`);
  console.info(`[SUPABASE_CONFIG] PROJECT_REF ${project.ref}`);
}

export const supabaseConfig = resolveSupabaseConfig({ url: rawSupabaseUrl, anonKey: rawSupabaseKey });
export const supabase = supabaseConfig ? createClient(supabaseConfig.url, supabaseConfig.anonKey, { auth: { storage: supabaseAuthStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' } }) : null;
export type SupabaseAvailability = 'configured' | 'unavailable';
export const supabaseAvailability: SupabaseAvailability = supabase ? 'configured' : 'unavailable';
