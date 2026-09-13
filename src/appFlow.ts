export type AuthGateStatus = 'loading' | 'visitor' | 'passwordRecovery' | 'authenticated';

/**
 * Keeps private surfaces out of the tree until the auth session has been
 * restored. A missing local Supabase configuration is treated as a visitor,
 * never as permission to enter the application.
 */
export function resolveAuthGate(input: {
  status: 'loading' | 'ready' | 'unavailable';
  hasAccount: boolean;
  passwordRecovery: boolean;
}): AuthGateStatus {
  if (input.status === 'loading') return 'loading';
  if (input.passwordRecovery) return 'passwordRecovery';
  return input.hasAccount ? 'authenticated' : 'visitor';
}

/** The regular app shell remains available for normal study surfaces. */
export function shouldShowTabBar(surface: 'app' | 'mistakeForm' | 'review' | 'fullscreen' | 'modal') {
  return surface === 'app' || surface === 'mistakeForm' || surface === 'review';
}
