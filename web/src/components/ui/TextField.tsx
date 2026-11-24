import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'aria-invalid' | 'aria-describedby'
> {
  label: string;
  error?: string | null | undefined;
  hint?: ReactNode;
}

/** A labelled input whose error and hint are announced by screen readers (aria-invalid and aria-describedby). */
export function TextField({ label, error, hint, className, type = 'text', ...props }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full rounded-xl bg-surface px-3.5 text-[15px] text-text ring-1 placeholder:text-faint focus:ring-2 focus:outline-none',
            isPassword && 'pr-11',
            error ? 'ring-critical focus:ring-critical' : 'ring-line focus:ring-accent',
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            aria-pressed={revealed}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            onClick={() => {
              setRevealed((value) => !value);
            }}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-faint hover:text-text"
          >
            {revealed ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-critical">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
