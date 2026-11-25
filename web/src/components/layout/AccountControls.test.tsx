import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi } from '@/test/mockApi';
import { USER } from '@/test/fixtures';
import { renderRoutes } from '@/test/renderWithProviders';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { SessionEndedPage } from '@/pages/SessionEndedPage';
import { AccountControls } from './AccountControls';

const routes = [
  { path: '/', element: <AccountControls /> },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/settings', element: <AccountControls /> }],
  },
  { path: '/login', element: <p>Login page</p> },
  { path: '/session-ended', element: <SessionEndedPage /> },
];

describe('AccountControls', () => {
  beforeEach(() => {
    document.cookie = 'tg_csrf=abc; path=/';
  });

  it('offers sign-in to visitors', async () => {
    mockApi({ 'GET /api/auth/session': json({ user: null, canRefresh: false }) });
    renderRoutes(routes);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows the member and a sign-out button', async () => {
    mockApi({ 'GET /api/auth/session': json({ user: USER, canRefresh: false }) });
    renderRoutes(routes);
    expect(await screen.findByRole('link', { name: 'Settings for Ayse Demir' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('signs out from a protected page without bouncing through the login page', async () => {
    let signedOut = false;
    const { count } = mockApi({
      'GET /api/auth/session': () => json({ user: signedOut ? null : USER, canRefresh: false }),
      'POST /api/auth/logout': () => {
        signedOut = true;
        return json(null, 204);
      },
    });
    const { router } = renderRoutes(routes, '/settings');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    // Ends on the home page as a visitor, never on the sign-in screen.
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(count('POST /api/auth/logout')).toBe(1);
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
