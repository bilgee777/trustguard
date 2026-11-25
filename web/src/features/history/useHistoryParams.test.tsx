import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoutes } from '@/test/renderWithProviders';
import { DEFAULT_QUERY, isFiltered, useHistoryParams } from './useHistoryParams';

function Probe() {
  const { query, update, clearFilters } = useHistoryParams();
  return (
    <>
      <output data-testid="query">{JSON.stringify(query)}</output>
      <button
        onClick={() => {
          update({ level: ['high'] });
        }}
      >
        filter
      </button>
      <button
        onClick={() => {
          update({ page: 3 });
        }}
      >
        page 3
      </button>
      <button onClick={clearFilters}>clear</button>
    </>
  );
}

function current() {
  return JSON.parse(screen.getByTestId('query').textContent) as typeof DEFAULT_QUERY;
}

describe('useHistoryParams', () => {
  it('reads the filters from the URL', () => {
    renderRoutes(
      [{ path: '/', element: <Probe /> }],
      '/?level=high&level=critical&q=bank&from=2026-01-01&sort=score&page=2',
    );
    expect(current()).toEqual({
      level: ['high', 'critical'],
      from: '2026-01-01',
      to: '',
      q: 'bank',
      sort: 'score',
      page: 2,
    });
  });

  it('falls back to defaults for garbage in the URL instead of failing', () => {
    renderRoutes([{ path: '/', element: <Probe /> }], '/?level=nope&from=yesterday&sort=sideways&page=-4');
    expect(current()).toEqual(DEFAULT_QUERY);
  });

  it('ignores a page that is not a number', () => {
    renderRoutes([{ path: '/', element: <Probe /> }], '/?page=abc');
    expect(current().page).toBe(1);
  });

  it('writes changes to the URL and returns to page 1 when a filter changes', async () => {
    const { router } = renderRoutes([{ path: '/', element: <Probe /> }], '/?page=4');

    await userEvent.click(screen.getByRole('button', { name: 'filter' }));

    expect(router.state.location.search).toBe('?level=high');
  });

  it('keeps the page when only the page changes', async () => {
    const { router } = renderRoutes([{ path: '/', element: <Probe /> }], '/?level=high');
    await userEvent.click(screen.getByRole('button', { name: 'page 3' }));
    expect(router.state.location.search).toBe('?level=high&page=3');
  });

  it('clears filters but keeps the sort order', async () => {
    const { router } = renderRoutes([{ path: '/', element: <Probe /> }], '/?level=high&q=bank&sort=score&page=2');
    await userEvent.click(screen.getByRole('button', { name: 'clear' }));
    expect(router.state.location.search).toBe('?sort=score');
  });
});

describe('isFiltered', () => {
  it('is false for the default view, whatever the sort or page', () => {
    expect(isFiltered(DEFAULT_QUERY)).toBe(false);
    expect(isFiltered({ ...DEFAULT_QUERY, sort: 'score', page: 5 })).toBe(false);
  });

  it.each([{ level: ['low' as const] }, { from: '2026-01-01' }, { to: '2026-02-01' }, { q: 'bank' }])(
    'is true when %j is set',
    (patch) => {
      expect(isFiltered({ ...DEFAULT_QUERY, ...patch })).toBe(true);
    },
  );

  it('does not count a blank search', () => {
    expect(isFiltered({ ...DEFAULT_QUERY, q: '   ' })).toBe(false);
  });
});
