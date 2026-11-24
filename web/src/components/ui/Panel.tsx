import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PanelProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Glass is reserved for the primary surface on a page. */
  elevated?: boolean;
  headingLevel?: 2 | 3;
  id?: string;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  elevated = false,
  headingLevel = 2,
  id,
}: PanelProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        'rounded-2xl',
        elevated ? 'glass shadow-[0_24px_60px_-30px_rgb(5_12_40/0.55)]' : 'border border-line bg-surface',
        className,
      )}
    >
      {(title ?? actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && (
              <Heading id={headingId} className="text-[15px] font-semibold tracking-tight text-text">
                {title}
              </Heading>
            )}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">{children}</div>
    </section>
  );
}
