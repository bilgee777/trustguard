import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { historyItem, historyPage, userWith } from '@/test/fixtures';
import { json, mockApi, problem } from '@/test/mockApi';
import { renderRoutes } from '@/test/renderWithProviders';
import { HistoryPage } from './HistoryPage';

function renderHistory(path = '/history') {
  document.cookie = 'tg_csrf=abc; path=/';
  return renderRoutes(
    [
      { path: '/history', element: <HistoryPage /> },
      { path: '/settings', element: <p>Settings page</p> },
      { path: '/', element: <p>Home page</p> },
    ],
    path,
  );
}

const session = (historyMode: 'off' | 'summary') => json({ user: userWith({ historyMode }), canRefresh: false });

describe('HistoryPage', () => {
  it('lists saved analyses', async () => {
    mockApi({
      'GET /api/auth/session': session('summary'),
      'GET /api/history': json(historyPage([historyItem({ id: 'a' }), historyItem({ id: 'b' })])),
    });
    renderHistory();

    const list = await screen.findByRole('list', { name: 'Saved analyses' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('sends the filters from the URL to the server', async () => {
    const { last } = mockApi({
      'GET /api/auth/session': session('summary'),
      'GET /api/history': json(historyPage([historyItem()])),
    });
    renderHistory('/history?level=high&q=bank&sort=score&page=2');

    await screen.findByRole('list', { name: 'Saved analyses' });

    const search = new URLSearchParams(last('GET /api/history')?.search);
    expect(search.getAll('level')).toEqual(['high']);
    expect(search.get('q')).toBe('bank');
    expect(search.get('sort')).toBe('score');
    expect(search.get('page')).toBe('2');
  });

  it('explains that history is off, with a way to change it', async () => {
    mockApi({
      'GET /api/auth/session': session('off'),
      'GET /api/history': json(historyPage([])),
    });
    renderHistory();

    expect(await screen.findByText('History is turned off')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose history settings' })).toHaveAttribute('href', '/settings');
  });

  it('shows an empty state when history is on but nothing is saved yet', async () => {
    mockApi({ 'GET /api/auth/session': session('summary'), 'GET /api/history': json(historyPage([])) });
    renderHistory();
    expect(await screen.findByText('No saved analyses yet')).toBeInTheDocument();
  });

  it('tells the user when filters match nothing, and clears them', async () => {
    mockApi({ 'GET /api/auth/session': session('summary'), 'GET /api/history': json(historyPage([])) });
    const { router } = renderHistory('/history?level=low&sort=score');

    expect(await screen.findByText('No analyses match these filters')).toBeInTheDocument();
    // One in the filter bar, one in the empty state: both do the same thing.
    const [clear] = screen.getAllByRole('button', { name: 'Clear filters' });
    if (!clear) throw new Error('No clear button');
    await userEvent.click(clear);

    expect(router.state.location.search).toBe('?sort=score');
  });

  it('reports a load failure and can retry', async () => {
    let fail = true;
    mockApi({
      'GET /api/auth/session': session('summary'),
      'GET /api/history': () =>
        fail ? problem(500, 'internal_error', 'The server hiccuped.') : json(historyPage([historyItem()])),
    });
    renderHistory();

    expect(await screen.findByText('History could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('The server hiccuped.')).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Saved analyses' })).toBeInTheDocument();
  });

  it('deletes one analysis only after confirmation', async () => {
    const { count } = mockApi({
      'GET /api/auth/session': session('summary'),
      'GET /api/history': json(historyPage([historyItem({ id: 'item-9' })])),
      'DELETE /api/history/item-9': json(null, 204),
    });
    renderHistory();

    await userEvent.click(await screen.findByRole('button', { name: /^Delete the analysis from/ }));
    expect(count('DELETE /api/history/item-9')).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Delete analysis' }));

    expect(count('DELETE /api/history/item-9')).toBe(1);
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const { count } = mockApi({
      'GET /api/auth/session': session('summary'),
      'GET /api/history': json(historyPage([historyItem({ id: 'item-9' })])),
    });
    renderHistory();

    await userEvent.click(await screen.findByRole('button', { name: /^Delete the analysis from/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(count('DELETE /api/history/item-9')).toBe(0);
  });

  it('deletes everything after confirmation, saying how many will go', async () => {
    const { count } = mockApi({
      'GET /api/auth/session': session('summary'),
      'GET /api/history': json(historyPage([historyItem()], 37)),
      'DELETE /api/history': json({ deleted: 37 }),
    });
    renderHistory();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete all history' }));
    expect(screen.getByText(/All 37 saved analyses/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete everything' }));

    expect(count('DELETE /api/history')).toBe(1);
  });

  it('hides "delete all" while a filter is active, so it cannot be mistaken for "delete these"', async () => {
    mockApi({
      'GET /api/auth/session': session('summary'),
      'GET /api/history': json(historyPage([historyItem()])),
    });
    renderHistory('/history?level=high');

    await screen.findByRole('list', { name: 'Saved analyses' });
    expect(screen.queryByRole('button', { name: 'Delete all history' })).not.toBeInTheDocument();
  });
});
