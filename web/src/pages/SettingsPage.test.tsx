import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, problem } from '@/test/mockApi';
import { USER, userWith } from '@/test/fixtures';
import { renderRoutes } from '@/test/renderWithProviders';
import { SessionEndedPage } from './SessionEndedPage';
import { SettingsPage } from './SettingsPage';

function renderSettings() {
  document.cookie = 'tg_csrf=abc; path=/';
  return renderRoutes([
    { path: '/', element: <SettingsPage /> },
    { path: '/session-ended', element: <SessionEndedPage /> },
  ]);
}

const sessionOf = (settings = USER.settings) => json({ user: userWith(settings), canRefresh: false });

describe('SettingsPage', () => {
  it('shows who is signed in and starts on the current setting, with history off by default', async () => {
    mockApi({ 'GET /api/auth/session': sessionOf() });
    renderSettings();

    expect(await screen.findByText('Ayse Demir')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('saves a changed mode and retention, then confirms', async () => {
    const { last } = mockApi({
      'GET /api/auth/session': sessionOf(),
      'PUT /api/me/settings': (request) => json(request.body),
    });
    renderSettings();

    await userEvent.click(await screen.findByRole('radio', { name: /^Summary only/ }));
    await userEvent.selectOptions(screen.getByLabelText('Keep saved analyses for'), '90');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    expect(last('PUT /api/me/settings')?.body).toEqual({ historyMode: 'summary', retentionDays: 90 });
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('warns before stepping down from masked text, because stored text is deleted', async () => {
    mockApi({ 'GET /api/auth/session': sessionOf({ historyMode: 'redacted_text', retentionDays: 30 }) });
    renderSettings();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('radio', { name: /^Summary only/ }));

    expect(screen.getByRole('status')).toHaveTextContent('permanently delete the masked message text');
  });

  it('shows a save failure', async () => {
    mockApi({
      'GET /api/auth/session': sessionOf(),
      'PUT /api/me/settings': problem(400, 'invalid_settings', 'That retention period is not allowed.'),
    });
    renderSettings();

    await userEvent.click(await screen.findByRole('radio', { name: /^Summary only/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That retention period is not allowed.');
  });

  it('deletes the account only with the password, then ends on the home page signed out', async () => {
    let deleted = false;
    const { last } = mockApi({
      'GET /api/auth/session': () => json({ user: deleted ? null : USER, canRefresh: false }),
      'DELETE /api/me': () => {
        deleted = true;
        return json(null, 204);
      },
    });
    const { router } = renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await userEvent.type(screen.getByLabelText('Confirm with your password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(last('DELETE /api/me')?.body).toEqual({ password: 'correct horse battery' });
  });

  it('keeps the account when the password is wrong, and says so inside the dialog', async () => {
    mockApi({
      'GET /api/auth/session': sessionOf(),
      'DELETE /api/me': problem(401, 'invalid_credentials', 'Password is incorrect.'),
    });
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await userEvent.type(screen.getByLabelText('Confirm with your password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(await screen.findByText('Password is incorrect.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
