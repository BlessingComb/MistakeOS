import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import { trackEvent } from '../analytics';
import { supabase } from '../supabase';
import { AUTH_CALLBACK_REDIRECT, parseAuthRedirect, PASSWORD_RESET_REDIRECT } from './redirect';
import { AuthForm, AuthMode, isValidEmail, isValidPassword, normalizeAuthForm, validateAuthForm } from './core';
import { clearAuthFailures, mayAttemptAuth, recordAuthFailure } from './attemptGuard';

export type AuthStatus = 'loading' | 'ready' | 'unavailable';
export type AuthAccount = { id: string; email: string | null; isAnonymous: boolean };
export type AuthResult = 'signed_in' | 'confirmation_sent' | 'unavailable' | 'validation_error' | 'error';

type AuthContextValue = {
  status: AuthStatus;
  account: AuthAccount | null;
  submit: (mode: AuthMode, form: AuthForm) => Promise<{ result: AuthResult; field: ReturnType<typeof validateAuthForm> }>;
  signOut: () => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
  passwordRecovery: boolean;
  requestPasswordReset: (email: string) => Promise<'sent' | 'invalid_email' | 'unavailable' | 'error'>;
  completePasswordReset: (password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function logAuthSubmit(event: string, detail?: string) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info(`[AUTH_SUBMIT] ${event}${detail ? ` ${detail}` : ''}`);
  }
}

function safeAuthErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[a-z0-9_-]+$/i.test(code)) return code;
  }
  return 'provider_error';
}

function toAccount(user: User | null | undefined): AuthAccount | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null, isAnonymous: user.is_anonymous ?? false };
}

async function provisionProfile(user: User) {
  if (!supabase) return;
  const rawDisplayName = user.user_metadata?.display_name;
  const displayName = typeof rawDisplayName === 'string' ? rawDisplayName.trim() : '';
  if (displayName.length < 2 || displayName.length > 32) return;
  // This is profile presentation data only. Authorization always uses auth.uid() in RLS.
  await supabase.from('profiles').upsert({ id: user.id, display_name: displayName }, { onConflict: 'id' });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unavailable');
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAccount(toAccount(data.session?.user));
      setStatus('ready');
    }).catch(() => {
      if (active) setStatus('ready');
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setAccount(toAccount(session?.user));
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setStatus('ready');
    });
    const handleUrl = (url: string) => { void completeAuthRedirect(url, () => active && setPasswordRecovery(true)); };
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); }).catch(() => undefined);
    const linkSubscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => { active = false; subscription.subscription.unsubscribe(); linkSubscription.remove(); };
  }, []);

  const submit = useCallback<AuthContextValue['submit']>(async (mode, form) => {
    const field = validateAuthForm(mode, form);
    if (field) {
      logAuthSubmit('VALIDATION_ERROR', field);
      return { result: 'validation_error', field };
    }
    if (!supabase) {
      logAuthSubmit('ERROR', 'provider_unavailable');
      return { result: 'unavailable', field: null };
    }
    logAuthSubmit('VALIDATION_PASSED');
    const normalized = normalizeAuthForm(form);
    if (mode === 'signIn') {
      if (!mayAttemptAuth('signIn')) {
        logAuthSubmit('ERROR', 'attempts_throttled');
        return { result: 'error', field: null };
      }
      trackEvent('account_signin_started', { source: 'account_screen' });
      try {
        logAuthSubmit('SIGNIN_CALL_START');
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalized.email, password: normalized.password });
        logAuthSubmit('SIGNIN_CALL_END');
        if (error || !data.session) {
          recordAuthFailure('signIn');
          logAuthSubmit('ERROR', safeAuthErrorCode(error));
          trackEvent('account_signin_failed', { source: 'account_screen' });
          return { result: 'error', field: null };
        }
        clearAuthFailures('signIn');
        logAuthSubmit('SUCCESS');
        logAuthSubmit('SESSION_CREATED', 'true');
        trackEvent('account_signin_succeeded', { source: 'account_screen' });
        return { result: 'signed_in', field: null };
      } catch (error) {
        recordAuthFailure('signIn');
        logAuthSubmit('SIGNIN_CALL_END');
        logAuthSubmit('ERROR', safeAuthErrorCode(error));
        trackEvent('account_signin_failed', { source: 'account_screen' });
        return { result: 'error', field: null };
      }
    }

    if (!mayAttemptAuth('signUp')) {
      logAuthSubmit('ERROR', 'attempts_throttled');
      return { result: 'error', field: null };
    }
    trackEvent('account_signup_started', { source: 'account_screen' });
    try {
      logAuthSubmit('SIGNUP_CALL_START');
      const { data, error } = await supabase.auth.signUp({
        email: normalized.email,
        password: normalized.password,
        options: {
          data: { display_name: normalized.displayName },
          emailRedirectTo: AUTH_CALLBACK_REDIRECT,
        },
      });
      logAuthSubmit('SIGNUP_CALL_END');
      if (error || !data.user) {
        recordAuthFailure('signUp');
        logAuthSubmit('ERROR', safeAuthErrorCode(error));
        trackEvent('account_signup_failed', { source: 'account_screen' });
        return { result: 'error', field: null };
      }
      clearAuthFailures('signUp');
      logAuthSubmit('SUCCESS');
      logAuthSubmit('USER_CREATED', String(Boolean(data.user)));
      logAuthSubmit('SESSION_CREATED', String(Boolean(data.session)));
      if (data.session) {
        await provisionProfile(data.user).catch(() => undefined);
        trackEvent('account_signup_succeeded', { source: 'account_screen', confirmationRequired: false });
        return { result: 'signed_in', field: null };
      }
      trackEvent('account_signup_succeeded', { source: 'account_screen', confirmationRequired: true });
      return { result: 'confirmation_sent', field: null };
    } catch (error) {
      recordAuthFailure('signUp');
      logAuthSubmit('SIGNUP_CALL_END');
      logAuthSubmit('ERROR', safeAuthErrorCode(error));
      trackEvent('account_signup_failed', { source: 'account_screen' });
      return { result: 'error', field: null };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return false;
    const { error } = await supabase.auth.signOut();
    if (error) return false;
    trackEvent('account_signed_out', { source: 'account_screen' });
    return true;
  }, []);
  const deleteAccount = useCallback(async () => {
    if (!supabase) return false;
    // The Edge Function derives the account from the verified JWT. This client
    // never receives or uses a service-role credential.
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) return false;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    trackEvent('account_delete_completed', { source: 'account_screen' });
    return true;
  }, []);
  const requestPasswordReset = useCallback<AuthContextValue['requestPasswordReset']>(async (email) => {
    if (!isValidEmail(email)) return 'invalid_email';
    if (!supabase) return 'unavailable';
    if (!mayAttemptAuth('passwordReset')) return 'error';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: PASSWORD_RESET_REDIRECT });
    if (error) { recordAuthFailure('passwordReset'); return 'error'; }
    clearAuthFailures('passwordReset');
    trackEvent('account_password_reset_requested', { source: 'account_screen' });
    return 'sent';
  }, []);
  const completePasswordReset = useCallback(async (password: string) => {
    if (!supabase || !isValidPassword(password)) return false;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return false;
    setPasswordRecovery(false);
    trackEvent('account_password_reset_completed', { source: 'recovery_link' });
    return true;
  }, []);
  const value = useMemo<AuthContextValue>(() => ({ status, account, submit, signOut, deleteAccount, passwordRecovery, requestPasswordReset, completePasswordReset }), [account, completePasswordReset, deleteAccount, passwordRecovery, requestPasswordReset, signOut, status, submit]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

async function completeAuthRedirect(url: string, onRecovery: () => void) {
  const redirect = parseAuthRedirect(url);
  if (!supabase || !redirect) return;
  if (redirect.code) await supabase.auth.exchangeCodeForSession(redirect.code);
  else if (redirect.accessToken && redirect.refreshToken) await supabase.auth.setSession({ access_token: redirect.accessToken, refresh_token: redirect.refreshToken });
  else return;
  if (redirect.recovery) onRecovery();
}
