import { Platform } from 'react-native';
import { supabaseAvailability } from '../supabase';

const configuredUrl = process.env.EXPO_PUBLIC_MISTAKE_ANALYSIS_URL?.trim();

const development = typeof __DEV__ !== 'undefined' && __DEV__;

export const mistakeAnalysisUrl = development ? (configuredUrl || (Platform.OS === 'web'
  ? 'http://localhost:8787/analyze-question'
  : null)) : null;

export const isMistakeAnalysisConfigured = supabaseAvailability === 'configured' || Boolean(mistakeAnalysisUrl);
