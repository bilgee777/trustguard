import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, problem } from '@/test/mockApi';
import { USER } from '@/test/fixtures';
import { renderRoutes } from '@/test/renderWithProviders';
import { AuthForm } from './AuthForm';

function renderForm(entry: string | { pathname: string; state: unknown } = '/login') {
  return renderRoutes(
    [
      { path: '/login', element: <AuthForm mode="login" /> },
      { path: '/register', element: <AuthForm mode="register" /> },
      { path: '/history', element: <p>History page</p> },
      { path: '/', element: <p>Home page</p> },
    ],
    entry,
  );
}

async function fill(label: string, value: string) {
  await userEvent.type(screen.getByLabelText(label), value);
}

describe('AuthForm', () => {
  beforeEach(() => {
    document.cookie = 'tg_csrf=abc; path=/';
  });

  it('signs in and returns to the page the user came from', async () => {
    const { last } = mockApi({ 'POST /api/auth/login': json(USER) });
    renderForm({ pathname: '/login', state: { from: '/history' } });

    await fill('Email', ' ayse@example.com ');
    await fill('Password', 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('History page')).toBeInTheDocument();
    expect(last('POST /api/auth/login')?.body).toEqual({
      email: 'ayse@example.com',
      password: 'correct horse battery',
    });
  });

  it('ignores a redirect that points off-site', async () => {
    mockApi({ 'POST /api/auth/login': json(USER) });
    renderForm({ pathname: '/login', state: { from: 'https://evil.example' } });

    await fill('Email', 'ayse@example.com');
    await fill('Password', 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('validates before sending anything and focuses the first invalid field', async () => {
    const { count } = mockApi();
    renderForm('/register');

    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(count('POST /api/auth/register')).toBe(0);
  });

  it('puts a duplicate-email error on the email field', async () => {
    mockApi({ 'POST /api/auth/register': problem(409, 'email_taken', 'That email is already registered.') });
    renderForm('/register');

    await fill('Name', 'Ayse');
    await fill('Email', 'ayse@example.com');
    await fill('Password', 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('That email is already registered.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });

  it('shows wrong credentials as a form-level alert, without saying which field was wrong', async () => {
    mockApi({ 'POST /api/auth/login': problem(401, 'invalid_credentials', 'Email or password is incorrect.') });
    renderForm();

    await fill('Email', 'ayse@example.com');
    await fill('Password', 'wrong password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('disables the button while the request runs, so it cannot be submitted twice', async () => {
    let release: () => void = () => undefined;
    const { count } = mockApi({
      'POST /api/auth/login': () =>
        new Promise<Response>((resolve) => {
          release = () => {
            resolve(json(USER));
          };
        }),
    });
    renderForm();

    await fill('Email', 'ayse@example.com');
    await fill('Password', 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const busy = await screen.findByRole('button', { name: 'Signing in…' });
    expect(busy).toBeDisabled();
    expect(count('POST /api/auth/login')).toBe(1);

    release();
    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument();
    });
  });

  it('keeps the destination when switching between sign-in and sign-up', async () => {
    mockApi({ 'POST /api/auth/register': json(USER, 201) });
    renderForm({ pathname: '/login', state: { from: '/history' } });

    await userEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    await fill('Name', 'Ayse');
    await fill('Email', 'ayse@example.com');
    await fill('Password', 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('History page')).toBeInTheDocument();
  });
});
