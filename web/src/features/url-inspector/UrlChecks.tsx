import { CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { UrlCheck, UrlCheckStatus } from '@/features/analysis/engine';
import { cn } from '@/lib/cn';

const STATUS: Record<UrlCheckStatus, { Icon: typeof Info; className: string; label: string }> = {
  pass: { Icon: CircleCheck, className: 'text-low', label: 'Passed' },
  info: { Icon: Info, className: 'text-faint', label: 'Note' },
  warn: { Icon: TriangleAlert, className: 'text-moderate', label: 'Warning' },
  fail: { Icon: OctagonAlert, className: 'text-critical', label: 'Failed' },
};

const ORDER: Record<UrlCheckStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

export function UrlChecks({ checks }: { checks: UrlCheck[] }) {
  const sorted = [...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  return (
    <ul className="divide-y divide-line">
      {sorted.map((check) => {
        const { Icon, className, label } = STATUS[check.status];
        return (
          <li key={check.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className="sr-only">{label}: </span>
                {check.label}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{check.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
