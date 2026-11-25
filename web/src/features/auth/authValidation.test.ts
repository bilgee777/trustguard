import { MIN_PASSWORD_LENGTH, safeRedirect, validateAuthFields } from './authValidation';

describe('safeRedirect', () => {
  it.each(['/history', '/history?level=high', '/settings', '/'])('keeps the same-site path %s', (path) => {
    expect(safeRedirect(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'history',
    '',
    undefined,
    null,
    42,
    { from: '/x' },
  ])('replaces the unsafe destination %j with the home page', (value) => {
    expect(safeRedirect(value)).toBe('/');
  });
});

describe('validateAuthFields', () => {
  const valid = { displayName: 'Ayse', email: 'ayse@example.com', password: 'a long enough password' };

  it('accepts valid sign-up details', () => {
    expect(validateAuthFields('register', valid)).toEqual({});
  });

  it('requires every field when registering', () => {
    expect(validateAuthFields('register', { displayName: ' ', email: '', password: '' })).toEqual({
      displayName: 'Enter your name.',
      email: 'Enter a valid email address.',
      password: 'Enter your password.',
    });
  });

  it('applies the password length rule to sign-up but not to sign-in', () => {
    const short = { ...valid, password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1) };
    expect(validateAuthFields('register', short).password).toBe(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    expect(validateAuthFields('login', short)).toEqual({});
  });

  it('does not ask for a name when signing in', () => {
    expect(validateAuthFields('login', { ...valid, displayName: '' })).toEqual({});
  });

  it.each(['plain', 'a@b', '@example.com', 'a b@example.com', 'a@@example.com'])('rejects the email %s', (email) => {
    expect(validateAuthFields('login', { ...valid, email }).email).toBe('Enter a valid email address.');
  });

  it('trims the email before checking it', () => {
    expect(validateAuthFields('login', { ...valid, email: '  ayse@example.com  ' })).toEqual({});
  });
});
