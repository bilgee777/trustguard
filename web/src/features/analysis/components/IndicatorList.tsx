import { Crosshair, Layers } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CATEGORY_META, type AnalysisResult } from '../engine';
import { strengthOf, RISK_TONE } from '../riskStyles';

interface IndicatorListProps {
  result: AnalysisResult;
  activeFindingId: string | null;
  onToggle: (findingId: string) => void;
}

export function IndicatorList({ result, activeFindingId, onToggle }: IndicatorListProps) {
  const points = new Map(result.contributions.map((c) => [c.findingId, c.points]));

  if (result.findings.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2/60 p-4 text-sm text-muted ring-1 ring-line">
        No threat indicators matched. That lowers the risk, but tailored or brand-new scams can look perfectly normal.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {result.findings.map((finding, index) => {
        const active = activeFindingId === finding.id;
        const hasSpans = finding.spans.length > 0;
        const tone = RISK_TONE[strengthOf(finding.weight)];
        return (
          <li
            key={finding.id}
            className={cn(
              'rounded-xl bg-surface p-4 ring-1 transition-shadow duration-150',
              active ? 'ring-2 ring-accent' : 'ring-line',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold',
                  tone.soft,
                  tone.text,
                )}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold text-text">{finding.title}</h3>
                  <span className="text-xs font-medium text-muted tabular-nums">
                    +{points.get(finding.id) ?? 0} pts
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-faint">
                  {CATEGORY_META[finding.category].label}
                  {!hasSpans && finding.ruleId.startsWith('combo.') && ' (combination of signals)'}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{finding.explanation}</p>
                {finding.evidence.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Evidence">
                    {finding.evidence.map((quote) => (
                      <li
                        key={quote}
                        className="max-w-full truncate rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11.5px] text-text ring-1 ring-line"
                      >
                        {quote}
                      </li>
                    ))}
                  </ul>
                )}
                {hasSpans && (
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onToggle(finding.id);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    <Crosshair className="size-3.5" aria-hidden="true" />
                    {active ? 'Clear highlight' : 'Highlight in text'}
                  </button>
                )}
                {!hasSpans && finding.ruleId.startsWith('combo.') && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-faint">
                    <Layers className="size-3.5" aria-hidden="true" />
                    Raised because several indicators appear together.
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
