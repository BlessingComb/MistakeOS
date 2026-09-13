export type AuthMode = 'signIn' | 'signUp';
export type AuthForm = { displayName: string; email: string; password: string; passwordConfirmation: string };
export type AuthValidationError = 'name' | 'email' | 'password' | 'passwordConfirmation' | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthForm(form: AuthForm): AuthForm {
  return {
    displayName: form.displayName.trim().replace(/\s+/g, ' '),
    email: form.email.trim().toLowerCase(),
    password: form.password,
    passwordConfirmation: form.passwordConfirmation,
  };
}

export function validateAuthForm(mode: AuthMode, form: AuthForm): AuthValidationError {
  const normalized = normalizeAuthForm(form);
  if (mode === 'signUp' && (normalized.displayName.length < 2 || normalized.displayName.length > 32)) return 'name';
  if (!emailPattern.test(normalized.email)) return 'email';
  if (normalized.password.length < 8) return 'password';
  if (mode === 'signUp' && normalized.password !== normalized.passwordConfirmation) return 'passwordConfirmation';
  return null;
}

export function isValidEmail(value: string): boolean {
  return emailPattern.test(value.trim().toLowerCase());
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8;
}
