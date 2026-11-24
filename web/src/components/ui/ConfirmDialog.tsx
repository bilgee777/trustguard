import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  /** Extra content, such as a password field. */
  children?: ReactNode;
  /** Server error to show inside the dialog. */
  error?: string | null;
}

/**
 * Modal built on the native <dialog> element: the browser provides the focus trap, makes the page behind it
 * inert, and closes it on Escape. Focus lands on Cancel, so a stray Enter never confirms a destructive action.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  pending = false,
  children,
  error,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Land on the safe choice so a stray Enter never confirms a destructive action.
      dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-text shadow-2xl ring-1 ring-line backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) onConfirm();
        }}
        className="p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div id={descriptionId} className="mt-2 text-sm text-muted">
          {description}
        </div>
        {children && <div className="mt-4">{children}</div>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-critical">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={pending} data-initial-focus>
            Cancel
          </Button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-critical px-4 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
