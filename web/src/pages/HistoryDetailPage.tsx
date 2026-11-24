import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { FileSearch, ShieldCheck, TriangleAlert } from 'lucide-react';
import { StatePanel } from '@/components/feedback/StatePanel';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { CATEGORY_META, CONTENT_TYPE_META, RISK_LEVEL_META, type IndicatorCategory } from '@/features/analysis/engine';
import { ResultView } from '@/features/analysis/components/ResultView';
import { RISK_TONE } from '@/features/analysis/riskStyles';
import { useDeleteHistoryItem, useHistoryItem } from '@/features/history/hooks';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';

export function HistoryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const detail = useHistoryItem(id);
  const remove = useDeleteHistoryItem();
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageTitle(detail.data ? `Saved analysis, ${detail.data.item.score}/100` : 'Saved analysis');

  useEffect(() => {
    if (detail.data) headingRef.current?.focus();
  }, [detail.data]);

  if (detail.isPending) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-56" />
      </div>
    );
  }

  if (detail.isError) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <StatePanel
        tone={missing ? 'neutral' : 'error'}
        icon={missing ? <FileSearch className="size-5" /> : <TriangleAlert className="size-5" />}
        title={missing ? 'This analysis no longer exists' : 'The analysis could not be loaded'}
        actions={<ButtonLink to="/history">Back to history</ButtonLink>}
      >
        {missing
          ? 'It was deleted, or it passed its retention period and was removed automatically.'
          : detail.error instanceof ApiError
            ? detail.error.message
            : 'Something went wrong. Try again.'}
      </StatePanel>
    );
  }

  const { item, result } = detail.data;
  const deleteBar = (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-[13px] text-muted ring-1 ring-line">
      <p className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-accent" aria-hidden="true" />
        {result
          ? 'This is the saved copy, with personal data masked. The score can differ slightly from the original.'
          : 'Only a summary was saved. The message text was never stored.'}
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setConfirming(true);
        }}
      >
        Delete this analysis
      </Button>
    </div>
  );

  const dialog = (
    <ConfirmDialog
      open={confirming}
      title="Delete this analysis?"
      description="It will be permanently deleted from your history."
      confirmLabel="Delete analysis"
      pending={remove.isPending}
      error={remove.error instanceof ApiError ? remove.error.message : null}
      onCancel={() => {
        setConfirming(false);
        remove.reset();
      }}
      onConfirm={() => {
        remove.mutate(item.id, {
          onSuccess: () => {
            setConfirming(false);
            void navigate('/history', { replace: true });
          },
        });
      }}
    />
  );

  if (result) {
    return (
      <>
        <ResultView
          key={result.id}
          result={result}
          title="Saved analysis"
          backTo="/history"
          backLabel="History"
          headingRef={headingRef}
          badges={<Badge tone="accent">Saved copy</Badge>}
          banner={deleteBar}
        />
        {dialog}
      </>
    );
  }

  // Summary-only entries have no stored text, so there is nothing to highlight: show what was kept.
  const tone = RISK_TONE[item.level];
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <ButtonLink to="/history" variant="ghost" size="sm" className="-ml-2">
        History
      </ButtonLink>
      <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-2xl font-semibold tracking-tight focus:outline-none">
        Saved analysis
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge>{CONTENT_TYPE_META[item.contentType].label}</Badge>
        <Badge tone="accent">Summary only</Badge>
        <time dateTime={item.createdAt} className="text-xs text-faint">
          {formatDateTime(item.createdAt)}
        </time>
      </div>
      {deleteBar}
      <Panel className="mt-6" title="What was saved">
        <div className="flex items-end gap-3">
          <p className="text-5xl leading-none font-semibold tracking-tight tabular-nums">
            {item.score}
            <span className="ml-1 text-lg font-normal text-faint">/100</span>
          </p>
          <p
            className={cn('mb-1 rounded-lg px-2.5 py-1 text-sm font-semibold ring-1', tone.soft, tone.text, tone.ring)}
          >
            {RISK_LEVEL_META[item.level].label}
          </p>
        </div>
        <p className="mt-3 text-sm text-muted">
          Analysis confidence: <span className="font-medium text-text capitalize">{item.confidenceLevel}</span> (
          {item.confidenceValue}%)
        </p>
        <h2 className="mt-6 text-sm font-semibold">Indicators found</h2>
        {item.findingTitles.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No threat indicators matched. A low score is not a guarantee of safety.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted marker:text-faint">
            {item.findingTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}
        {item.categories.length > 0 && (
          <p className="mt-4 text-[13px] text-faint">
            Types: {item.categories.map((category) => CATEGORY_META[category as IndicatorCategory].label).join(', ')}
          </p>
        )}
      </Panel>
      {dialog}
    </div>
  );
}
