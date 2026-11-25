import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi } from '@/test/mockApi';
import { USER } from '@/test/fixtures';
import { renderRoutes } from '@/test/renderWithProviders';
import { ProtectedRoute } from './ProtectedRoute';

function renderProtected(path = '/history?level=high') {
  return renderRoutes(
    [
      { element: <ProtectedRoute />, children: [{ path: '/history', element: <p>Secret history</p> }] },
      { path: '/login', element: <p>Login page</p> },
    ],
    path,
  );
}

describe('ProtectedRoute', () => {
  it('shows the page to a signed-in user', async () => {
    mockApi({ 'GET /api/auth/session': json({ user: USER, canRefresh: false }) });
    renderProtected();
    expect(await screen.findByText('Secret history')).toBeInTheDocument();
  });

  it('sends visitors to sign in, remembering where they were going, filters included', async () => {
    mockApi({ 'GET /api/auth/session': json({ user: null, canRefresh: false }) });
    const { router } = renderProtected();

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.state).toEqual({ from: '/history?level=high' });
  });

  it('shows a loading state, not the page, while the session is being checked', () => {
    mockApi({ 'GET /api/auth/session': () => new Promise<Response>(() => undefined) });
    renderProtected();
    expect(screen.getByText('Checking your session')).toBeInTheDocument();
    expect(screen.queryByText('Secret history')).not.toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('says the server is unreachable instead of bouncing to sign-in, and can retry', async () => {
    let up = false;
    mockApi({
      'GET /api/auth/session': () => {
        if (!up) throw new TypeError('fetch failed');
        return json({ user: USER, canRefresh: false });
      },
    });
    renderProtected();

    expect(await screen.findByText('The server is not reachable')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();

    up = true;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Secret history')).toBeInTheDocument();
  });

  it('renews an expired session before deciding the user is signed out', async () => {
    let renewed = false;
    document.cookie = 'tg_csrf=abc; path=/';
    const { count } = mockApi({
      'POST /api/auth/refresh': () => {
        renewed = true;
        return json({});
      },
      'GET /api/auth/session': () =>
        json(renewed ? { user: USER, canRefresh: false } : { user: null, canRefresh: true }),
    });
    renderProtected();

    expect(await screen.findByText('Secret history')).toBeInTheDocument();
    expect(count('POST /api/auth/refresh')).toBe(1);
  });
});
