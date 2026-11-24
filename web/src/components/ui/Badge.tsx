import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'low' | 'moderate' | 'high' | 'critical';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted ring-line',
  accent: 'bg-accent-soft text-accent-strong ring-accent/25',
  low: 'bg-low-soft text-low ring-low/25',
  moderate: 'bg-moderate-soft text-moderate ring-moderate/25',
  high: 'bg-high-soft text-high ring-high/25',
  critical: 'bg-critical-soft text-critical ring-critical/25',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
