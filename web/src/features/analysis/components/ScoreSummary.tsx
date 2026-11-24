import { CATEGORY_META, RISK_LEVEL_META, type AnalysisResult, type RiskLevel } from '../engine';
import { RISK_TONE } from '../riskStyles';
import { cn } from '@/lib/cn';

const LEVELS: RiskLevel[] = ['low', 'moderate', 'high', 'critical'];

function RiskScale({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="mt-5">
      <div className="relative">
        <div className="grid grid-cols-4 gap-1" aria-hidden="true">
          {LEVELS.map((l) => (
            <div key={l} className={cn('h-1.5 rounded-full', l === level ? RISK_TONE[l].bar : 'bg-line')} />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute -top-1 size-3.5 -translate-x-1/2 rounded-full border-2 border-surface bg-text shadow"
          style={{ left: `${Math.min(Math.max(score, 1.5), 98.5)}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-[11px] text-faint">
        {LEVELS.map((l) => (
          <span key={l} className={cn(l === level && cn('font-semibold', RISK_TONE[l].text))}>
            {RISK_LEVEL_META[l].label.replace(' risk', '')}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ordered shades from electric blue to violet, one per category in contribution order. */
const LEDGER_SHADES = ['100%', '82%', '66%', '52%', '40%', '30%', '22%', '16%', '12%', '9%'];

function ScoreLedger({ result }: { result: AnalysisResult }) {
  const categories = result.categories.filter((c) => c.points > 0);
  if (categories.length === 0) {
    return <p className="text-sm text-muted">Nothing added to the score. Every category stayed at 0 points.</p>;
  }
  return (
    <div>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-line/60"
        role="img"
        aria-label={`Score breakdown: ${categories.map((c) => `${CATEGORY_META[c.category].label} ${c.points} points`).join(', ')}`}
      >
        {categories.map((c, i) => (
          <div
            key={c.category}
            className="h-full border-r-2 border-surface last:border-r-0"
            style={{
              width: `${c.points}%`,
              background: `color-mix(in oklab, var(--c-accent) ${LEDGER_SHADES[i] ?? '9%'}, var(--c-violet))`,
            }}
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {categories.map((c, i) => (
          <li key={c.category} className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{
                background: `color-mix(in oklab, var(--c-accent) ${LEDGER_SHADES[i] ?? '9%'}, var(--c-violet))`,
              }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{CATEGORY_META[c.category].label}</span>
            <span className="font-medium text-text tabular-nums">{c.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreSummary({ result }: { result: AnalysisResult }) {
  const tone = RISK_TONE[result.level];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      <div>
        <p className="text-sm text-muted">Risk score</p>
        <div className="mt-1 flex items-end gap-3">
          <p className="text-6xl leading-none font-semibold tracking-tight tabular-nums">
            {result.score}
            <span className="ml-1 text-xl font-normal text-faint">/100</span>
          </p>
          <p
            className={cn('mb-1 rounded-lg px-2.5 py-1 text-sm font-semibold ring-1', tone.soft, tone.text, tone.ring)}
          >
            {RISK_LEVEL_META[result.level].label}
          </p>
        </div>
        <RiskScale score={result.score} level={result.level} />
        <div className="mt-6 rounded-xl bg-surface-2/60 p-4 ring-1 ring-line">
          <p className="text-sm">
            <span className="text-muted">Analysis confidence: </span>
            <span className="font-semibold capitalize">{result.confidence.level}</span>
            <span className="text-faint tabular-nums"> ({result.confidence.value}%)</span>
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-muted marker:text-faint">
            {result.confidence.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">Where the score comes from</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Points per indicator type. They add up to the total score.</p>
        <ScoreLedger result={result} />
        <details className="group mt-5 rounded-xl ring-1 ring-line">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-[13px] font-medium text-text marker:hidden hover:bg-surface-2/60">
            How the score is calculated
          </summary>
          <div className="space-y-2 px-4 pb-4 text-[13px] leading-relaxed text-muted">
            <p>
              Each indicator has a weight that reflects how strongly it points to a scam. Weights are combined so every
              extra signal raises the score, a repeated phrase counts once, and a pile of weak signals cannot reach 100
              on its own.
            </p>
            <p>
              The points next to each indicator are its share of the final score. Scores of 0–24 are low, 25–49
              moderate, 50–74 high and 75–100 critical.
            </p>
            <p>A low score means no known pattern matched. It is never proof that a message is safe.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
