import { useState } from 'react';
import { History, SearchX, ShieldOff, TriangleAlert } from 'lucide-react';
import { StatePanel } from '@/components/feedback/StatePanel';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUser } from '@/features/auth/session';
import { PAGE_SIZE } from '@/features/history/historyApi';
import { HistoryFilters } from '@/features/history/HistoryFilters';
import { HistoryRow } from '@/features/history/HistoryRow';
import { useDeleteAllHistory, useDeleteHistoryItem, useHistoryList } from '@/features/history/hooks';
import { isFiltered, useHistoryParams } from '@/features/history/useHistoryParams';
import { ApiError } from '@/lib/api/client';
import type { HistoryItem } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';

export function HistoryPage() {
  usePageTitle('History');
  const user = useUser();
  const { query, update, clearFilters } = useHistoryParams();
  const list = useHistoryList(query);
  const deleteOne = useDeleteHistoryItem();
  const deleteAll = useDeleteAllHistory();
  const [pendingDelete, setPendingDelete] = useState<HistoryItem | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const filtered = isFiltered(query);
  const total = list.data?.total ?? 0;
  const historyOff = user?.settings.historyMode === 'off';

  const closeOne = () => {
    setPendingDelete(null);
    deleteOne.reset();
  };
  const closeAll = () => {
    setConfirmAll(false);
    deleteAll.reset();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">History</h1>
          <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
            Analyses you chose to keep. They are deleted automatically after the retention period in your settings.
          </p>
        </div>
        {total > 0 && !filtered && (
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmAll(true);
            }}
          >
            Delete all history
          </Button>
        )}
      </div>

      <div className="mt-6">
        <HistoryFilters query={query} onChange={update} onClear={clearFilters} />
      </div>

      <div className="mt-6" aria-busy={list.isFetching}>
        {list.isPending ? (
          <ul aria-label="Loading history" className="flex flex-col gap-3">
            {[0, 1, 2].map((key) => (
              <li key={key}>
                <Skeleton className="h-[5.5rem]" />
              </li>
            ))}
          </ul>
        ) : list.isError ? (
          <StatePanel
            tone="error"
            icon={<TriangleAlert className="size-5" />}
            title="History could not be loaded"
            actions={
              <Button
                onClick={() => {
                  void list.refetch();
                }}
              >
                Try again
              </Button>
            }
          >
            {list.error instanceof ApiError ? list.error.message : 'Something went wrong while loading your history.'}
          </StatePanel>
        ) : total === 0 && filtered ? (
          <StatePanel
            icon={<SearchX className="size-5" />}
            title="No analyses match these filters"
            actions={<Button onClick={clearFilters}>Clear filters</Button>}
          >
            Try a different search, a wider date range or fewer risk levels.
          </StatePanel>
        ) : total === 0 && historyOff ? (
          <StatePanel
            icon={<ShieldOff className="size-5" />}
            title="History is turned off"
            actions={<ButtonLink to="/settings">Choose history settings</ButtonLink>}
          >
            Nothing is saved, which is the default. If you want to look back at past analyses, turn history on. You
            decide whether to keep only a summary or also a copy of the message with personal data masked.
          </StatePanel>
        ) : total === 0 ? (
          <StatePanel
            icon={<History className="size-5" />}
            title="No saved analyses yet"
            actions={<ButtonLink to="/">Analyze a message</ButtonLink>}
          >
            New analyses are saved here while history is on.
          </StatePanel>
        ) : (
          <>
            <ul aria-label="Saved analyses" className="flex flex-col gap-3">
              {list.data.items.map((item) => (
                <HistoryRow key={item.id} item={item} onDelete={setPendingDelete} />
              ))}
            </ul>
            <Pagination
              page={query.page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={(page) => {
                update({ page });
              }}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this analysis?"
        description={
          pendingDelete
            ? `The analysis from ${formatDateTime(pendingDelete.createdAt)} will be permanently deleted.`
            : ''
        }
        confirmLabel="Delete analysis"
        pending={deleteOne.isPending}
        error={deleteOne.error instanceof ApiError ? deleteOne.error.message : null}
        onCancel={closeOne}
        onConfirm={() => {
          if (pendingDelete) deleteOne.mutate(pendingDelete.id, { onSuccess: closeOne });
        }}
      />
      <ConfirmDialog
        open={confirmAll}
        title="Delete all history?"
        description={`All ${total} saved analyses will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete everything"
        pending={deleteAll.isPending}
        error={deleteAll.error instanceof ApiError ? deleteAll.error.message : null}
        onCancel={closeAll}
        onConfirm={() => {
          deleteAll.mutate(undefined, { onSuccess: closeAll });
        }}
      />
    </div>
  );
}
