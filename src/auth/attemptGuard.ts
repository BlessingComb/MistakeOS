const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type AttemptKind = 'signIn' | 'signUp' | 'passwordReset';

const failures = new Map<AttemptKind, number[]>();

function recent(kind: AttemptKind, now: number) {
  const values = (failures.get(kind) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  failures.set(kind, values);
  return values;
}

/** UX backstop only. Supabase Auth rate limits remain the authoritative guard. */
export function mayAttemptAuth(kind: AttemptKind, now = Date.now()) {
  return recent(kind, now).length < MAX_FAILURES;
}

export function recordAuthFailure(kind: AttemptKind, now = Date.now()) {
  const values = recent(kind, now);
  failures.set(kind, [...values, now]);
}

export function clearAuthFailures(kind: AttemptKind) {
  failures.delete(kind);
}

export function resetAuthAttemptGuardForTests() {
  failures.clear();
}
