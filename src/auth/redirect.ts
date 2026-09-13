export const PASSWORD_RESET_REDIRECT = 'mistakeos://reset-password';
export const AUTH_CALLBACK_REDIRECT = 'mistakeos://auth/callback';

export type AuthRedirect = {
  recovery: boolean;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
};

/** Parses only MistakeOS deep links and never logs their sensitive parameters. */
export function parseAuthRedirect(url: string): AuthRedirect | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'mistakeos:') return null;
    const query = new URLSearchParams(parsed.search);
    const fragment = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
    const get = (key: string) => query.get(key) ?? fragment.get(key);
    const code = get('code') ?? undefined;
    const accessToken = get('access_token') ?? undefined;
    const refreshToken = get('refresh_token') ?? undefined;
    if (!code && !(accessToken && refreshToken)) return null;
    return { recovery: get('type') === 'recovery', code, accessToken, refreshToken };
  } catch {
    return null;
  }
}
