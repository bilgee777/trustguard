import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { AnalysisResult, Finding } from '../engine';
import { strengthOf } from '../riskStyles';

const MARK_TONE = {
  critical: 'bg-critical-soft decoration-critical',
  high: 'bg-high-soft decoration-high',
  moderate: 'bg-moderate-soft decoration-moderate',
  low: 'bg-low-soft decoration-low',
} as const;

interface EvidenceViewProps {
  result: AnalysisResult;
  activeFindingId: string | null;
}

/**
 * Renders the analysed text as plain React text nodes with <mark> elements. User content is
 * never injected as HTML, so a pasted <script> is displayed, not executed. Footnote numbers
 * match the numbered indicator list.
 */
export function EvidenceView({ result, activeFindingId }: EvidenceViewProps) {
  const { indexById, findingById } = useMemo(() => {
    const indexMap = new Map<string, number>();
    const findingMap = new Map<string, Finding>();
    result.findings.forEach((f, i) => {
      indexMap.set(f.id, i + 1);
      findingMap.set(f.id, f);
    });
    return { indexById: indexMap, findingById: findingMap };
  }, [result.findings]);

  return (
    <div className="max-h-[min(36rem,calc(100dvh-13rem))] overflow-auto rounded-xl bg-surface-2/60 p-4 ring-1 ring-line sm:p-5">
      <p className="font-mono text-[13px] leading-[1.85] break-words whitespace-pre-wrap text-text">
        {result.highlights.map((segment) => {
          if (segment.findingIds.length === 0) return <span key={segment.start}>{segment.text}</span>;
          const findings = segment.findingIds.flatMap((id) => findingById.get(id) ?? []);
          const strongest = Math.max(...findings.map((f) => f.weight));
          const isActive = activeFindingId !== null && segment.findingIds.includes(activeFindingId);
          const dimmed = activeFindingId !== null && !isActive;
          const endingHere = findings.filter((f) => f.spans.some((s) => s.end === segment.end));
          return (
            <span key={segment.start}>
              <mark
                data-active={isActive || undefined}
                className={cn(
                  'rounded-[3px] text-inherit underline decoration-2 underline-offset-[3px] transition-[opacity,box-shadow] duration-150',
                  MARK_TONE[strengthOf(strongest)],
                  isActive && 'shadow-[0_0_0_2px_var(--c-accent)]',
                  dimmed && 'opacity-45',
                )}
              >
                {segment.text}
              </mark>
              {endingHere.length > 0 && (
                <>
                  <sup aria-hidden="true" className="ml-0.5 font-sans text-[10px] font-semibold text-muted">
                    {endingHere.map((f) => indexById.get(f.id)).join(',')}
                  </sup>
                  <span className="sr-only"> (flagged: {endingHere.map((f) => f.title).join('; ')})</span>
                </>
              )}
            </span>
          );
        })}
      </p>
    </div>
  );
}
