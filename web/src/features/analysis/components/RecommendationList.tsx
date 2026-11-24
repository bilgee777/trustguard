import { CircleAlert, CircleCheck } from 'lucide-react';
import type { Recommendation } from '../engine';

export function RecommendationList({ items }: { items: Recommendation[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 text-sm leading-relaxed">
          {item.priority === 'primary' ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />
          )}
          <span className={item.priority === 'primary' ? 'font-medium text-text' : 'text-muted'}>
            {item.priority === 'primary' && <span className="sr-only">Important: </span>}
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
