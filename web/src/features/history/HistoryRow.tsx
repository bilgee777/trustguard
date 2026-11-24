import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import type { HistoryItem } from '@/lib/api/types';
import { CONTENT_TYPE_META, RISK_LEVEL_META } from '@/features/analysis/engine';
import { RISK_TONE } from '@/features/analysis/riskStyles';

interface HistoryRowProps {
  item: HistoryItem;
  onDelete: (item: HistoryItem) => void;
}

export function HistoryRow({ item, onDelete }: HistoryRowProps) {
  const tone = RISK_TONE[item.level];
  const shown = item.findingTitles.slice(0, 3);
  const extra = item.findingTitles.length - shown.length;

  return (
    <li className="flex items-stretch rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
      <Link
        to={`/history/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-l-2xl p-4 hover:bg-surface-2/50"
      >
        <span
          className={cn(
            'grid size-14 shrink-0 place-items-center rounded-xl text-xl font-semibold tabular-nums',
            tone.soft,
            tone.text,
          )}
          aria-hidden="true"
        >
          {item.score}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={item.level}>
              {RISK_LEVEL_META[item.level].label}
              <span className="sr-only">, score {item.score} of 100</span>
            </Badge>
            <Badge>{CONTENT_TYPE_META[item.contentType].label}</Badge>
            <time dateTime={item.createdAt} className="text-xs text-faint">
              {formatDateTime(item.createdAt)}
            </time>
          </span>
          <span className="mt-1.5 block truncate text-sm text-muted">
            {shown.length > 0 ? shown.join(', ') : 'No threat indicators found'}
            {extra > 0 && ` and ${extra} more`}
          </span>
          <span className="mt-0.5 block text-xs text-faint">
            {item.hasDetails ? 'Masked text saved' : 'Summary only'}. Deleted automatically on{' '}
            {new Date(item.expiresAt).toLocaleDateString('en', { dateStyle: 'medium' })}.
          </span>
        </span>
      </Link>
      <button
        type="button"
        aria-label={`Delete the analysis from ${formatDateTime(item.createdAt)}`}
        onClick={() => {
          onDelete(item);
        }}
        className="grid w-12 shrink-0 place-items-center rounded-r-2xl border-l border-line text-faint transition-colors hover:bg-critical-soft hover:text-critical"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}
