import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatePanelProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'error';
  className?: string;
}

/** Shared layout for empty, error and not-found states: say what happened and what to do next. */
export function StatePanel({ icon, title, children, actions, tone = 'neutral', className }: StatePanelProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center', className)}
    >
      <div
        className={cn(
          'mb-5 grid size-12 place-items-center rounded-xl ring-1',
          tone === 'error'
            ? 'bg-critical-soft text-critical ring-critical/25'
            : 'bg-accent-soft text-accent ring-accent/20',
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
