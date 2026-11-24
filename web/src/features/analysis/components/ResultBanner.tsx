import { Link } from 'react-router';
import { CloudOff, Database, MonitorSmartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { HistoryMode } from '@/lib/api/types';
import type { AnalysisOutcome } from '../api/analysisService';

function Note({
  icon,
  tone = 'neutral',
  children,
}: {
  icon: ReactNode;
  tone?: 'neutral' | 'warn';
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        'mt-4 flex gap-2.5 rounded-xl px-4 py-3 text-[13px] ring-1',
        tone === 'warn' ? 'bg-moderate-soft text-text ring-moderate/25' : 'bg-surface text-muted ring-line',
      )}
    >
      <span className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Tells the user, every time, where their message went. Privacy claims are only useful if they are visible. */
export function ResultBanner({ outcome, historyMode }: { outcome: AnalysisOutcome; historyMode: HistoryMode | null }) {
  if (outcome.notice) {
    return (
      <Note icon={<CloudOff className="size-4" />} tone="warn">
        {outcome.notice}
      </Note>
    );
  }
  if (outcome.location === 'server' && outcome.saved) {
    return (
      <Note icon={<Database className="size-4" />}>
        {historyMode === 'redacted_text'
          ? 'Saved to your history with personal data masked. '
          : 'Saved to your history as a summary. The message text was not stored. '}
        {outcome.historyId && (
          <Link to={`/history/${outcome.historyId}`} className="font-medium text-accent hover:text-accent-strong">
            Open in history
          </Link>
        )}
      </Note>
    );
  }
  return (
    <Note icon={<MonitorSmartphone className="size-4" />}>
      Analyzed in your browser. This message was not sent to any server and is not saved.
    </Note>
  );
}
