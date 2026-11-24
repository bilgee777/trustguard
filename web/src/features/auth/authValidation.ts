export type AuthMode = 'login' | 'register';

export interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 10;

/** Only same-site paths are accepted as a post-login destination, so a crafted link cannot bounce users elsewhere. */
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/';
}

export function validateAuthFields(
  mode: AuthMode,
  values: { displayName: string; email: string; password: string },
): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === 'register' && values.displayName.trim().length === 0) errors.displayName = 'Enter your name.';
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.password.length === 0) errors.password = 'Enter your password.';
  else if (mode === 'register' && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}
