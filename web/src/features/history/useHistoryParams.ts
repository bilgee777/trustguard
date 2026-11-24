import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { RiskLevel } from '@/features/analysis/engine';
import type { HistoryQuery } from '@/lib/api/types';

const LEVELS: readonly RiskLevel[] = ['low', 'moderate', 'high', 'critical'];
const SORTS: readonly HistoryQuery['sort'][] = ['newest', 'oldest', 'score'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_QUERY: HistoryQuery = { level: [], from: '', to: '', q: '', sort: 'newest', page: 1 };

function parse(params: URLSearchParams): HistoryQuery {
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  const sort = params.get('sort');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  return {
    level: LEVELS.filter((level) => params.getAll('level').includes(level)),
    from: DATE.test(from) ? from : '',
    to: DATE.test(to) ? to : '',
    q: params.get('q') ?? '',
    sort: SORTS.find((candidate) => candidate === sort) ?? 'newest',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

function serialize(query: HistoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const level of query.level) params.append('level', level);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.q) params.set('q', query.q);
  if (query.sort !== 'newest') params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  return params;
}

export function isFiltered(query: HistoryQuery): boolean {
  return query.level.length > 0 || query.from !== '' || query.to !== '' || query.q.trim() !== '';
}

/**
 * History filters live in the URL, not in component state: a filtered view can be bookmarked or shared, the
 * browser's back button steps through filter changes, and a reload keeps the user where they were.
 */
export function useHistoryParams() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parse(params), [params]);

  const update = useCallback(
    (patch: Partial<HistoryQuery>) => {
      // Changing any filter returns to the first page; only an explicit page change keeps its page.
      const next: HistoryQuery = { ...query, page: 1, ...patch };
      setParams(serialize(next));
    },
    [query, setParams],
  );

  const clearFilters = useCallback(() => {
    setParams(serialize({ ...DEFAULT_QUERY, sort: query.sort }));
  }, [query.sort, setParams]);

  return { query, update, clearFilters };
}
