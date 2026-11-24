import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RISK_LEVEL_META, type RiskLevel } from '@/features/analysis/engine';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { useSyncedState } from '@/lib/useSyncedState';
import type { HistoryQuery } from '@/lib/api/types';
import { isFiltered } from './useHistoryParams';

const LEVELS: RiskLevel[] = ['low', 'moderate', 'high', 'critical'];

const FIELD =
  'h-10 rounded-lg bg-surface px-3 text-sm text-text ring-1 ring-line focus:ring-2 focus:ring-accent focus:outline-none';

interface HistoryFiltersProps {
  query: HistoryQuery;
  onChange: (patch: Partial<HistoryQuery>) => void;
  onClear: () => void;
}

export function HistoryFilters({ query, onChange, onClear }: HistoryFiltersProps) {
  // While the user types, the draft shows immediately; the URL (and the request) follow after a short pause.
  const [draft, setDraft] = useState<string | null>(null);
  const commitSearch = useDebouncedCallback((value: string) => {
    onChange({ q: value });
    setDraft(null);
  }, 300);

  // Controls show the user's change immediately and follow the URL once navigation catches up.
  const [levels, setLevels] = useSyncedState(query.level);
  const [from, setFrom] = useSyncedState(query.from);
  const [to, setTo] = useSyncedState(query.to);
  const [sort, setSort] = useSyncedState(query.sort);

  const toggleLevel = (level: RiskLevel) => {
    const next = levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level];
    setLevels(next);
    onChange({ level: next });
  };

  return (
    <form
      role="search"
      aria-label="Filter history"
      onSubmit={(event) => {
        event.preventDefault();
      }}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div>
          <label htmlFor="history-search" className="mb-1.5 block text-[13px] font-medium text-muted">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
              aria-hidden="true"
            />
            <input
              id="history-search"
              type="search"
              value={draft ?? query.q}
              placeholder="Indicators or saved text"
              onChange={(event) => {
                setDraft(event.target.value);
                commitSearch(event.target.value);
              }}
              className={`${FIELD} w-full pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="history-from" className="mb-1.5 block text-[13px] font-medium text-muted">
            From
          </label>
          <input
            id="history-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              onChange({ from: event.target.value });
            }}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="history-to" className="mb-1.5 block text-[13px] font-medium text-muted">
            To
          </label>
          <input
            id="history-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              onChange({ to: event.target.value });
            }}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="history-sort" className="mb-1.5 block text-[13px] font-medium text-muted">
            Sort by
          </label>
          <select
            id="history-sort"
            value={sort}
            onChange={(event) => {
              const next = event.target.value as HistoryQuery['sort'];
              setSort(next);
              onChange({ sort: next });
            }}
            className={FIELD}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Highest risk first</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <legend className="sr-only">Risk level</legend>
          <span aria-hidden="true" className="mr-1 text-[13px] font-medium text-muted">
            Risk level
          </span>
          {LEVELS.map((level) => (
            <label
              key={level}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] text-text ring-1 ring-line has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong has-[:checked]:ring-accent/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="checkbox"
                checked={levels.includes(level)}
                onChange={() => {
                  toggleLevel(level);
                }}
                className="size-3.5 accent-[var(--c-accent)]"
              />
              {RISK_LEVEL_META[level].label.replace(' risk', '')}
            </label>
          ))}
        </fieldset>
        {isFiltered(query) && (
          <Button variant="ghost" size="sm" icon={<X className="size-4" aria-hidden="true" />} onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </form>
  );
}
