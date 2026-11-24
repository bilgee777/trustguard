import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_8px_24px_-12px_var(--c-accent)] hover:bg-accent-strong disabled:opacity-60',
  secondary: 'bg-surface text-text ring-1 ring-line hover:ring-line-strong hover:bg-surface-2 disabled:opacity-60',
  ghost: 'text-muted hover:text-text hover:bg-surface-2 disabled:opacity-60',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
};

const base =
  'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed';

interface StyleProps {
  variant?: Variant | undefined;
  size?: Size | undefined;
  icon?: ReactNode | undefined;
}

function buttonClass({ variant = 'primary', size = 'md' }: StyleProps = {}) {
  return cn(base, VARIANTS[variant], SIZES[size]);
}

export function Button({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(buttonClass({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, className, children, ...props }: StyleProps & LinkProps) {
  return (
    <Link className={cn(buttonClass({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
