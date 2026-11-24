import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        icon={<ChevronLeft className="size-4" aria-hidden="true" />}
        onClick={() => {
          onChange(page - 1);
        }}
      >
        Previous
      </Button>
      <p className="text-sm text-muted tabular-nums" aria-live="polite">
        Page {page} of {pages}
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        onClick={() => {
          onChange(page + 1);
        }}
      >
        Next
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
