import { useState, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, Clock, FlaskConical, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { findScenario } from '@/features/demo/scenarios';
import { formatDateTime } from '@/lib/format';
import { CONTENT_TYPE_META, type AnalysisResult } from '../engine';
import { EvidenceView } from './EvidenceView';
import { IndicatorList } from './IndicatorList';
import { LinkReports } from './LinkReports';
import { RecommendationList } from './RecommendationList';
import { ScoreSummary } from './ScoreSummary';

interface ResultViewProps {
  result: AnalysisResult;
  title: string;
  backTo: string;
  backLabel: string;
  /** Extra badges after the content type, such as "Saved". */
  badges?: ReactNode;
  /** Where the analysis ran and what happened to it. */
  banner?: ReactNode;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

/** The full analysis screen. Used for fresh results and for analyses opened from history. Render it with key={result.id}. */
export function ResultView({ result, title, backTo, backLabel, badges, banner, headingRef }: ResultViewProps) {
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);

  const scenario = result.demoScenarioId ? findScenario(result.demoScenarioId) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <ButtonLink
        to={backTo}
        variant="ghost"
        size="sm"
        className="-ml-2"
        icon={<ArrowLeft className="size-4" aria-hidden="true" />}
      >
        {backLabel}
      </ButtonLink>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
            {title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{CONTENT_TYPE_META[result.contentType].label}</Badge>
            {badges}
            {scenario && (
              <Badge tone="accent" icon={<FlaskConical className="size-3" aria-hidden="true" />}>
                Demo: {scenario.title}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-faint">
              <Clock className="size-3" aria-hidden="true" />
              <time dateTime={result.createdAt}>{formatDateTime(result.createdAt)}</time>
            </span>
          </div>
        </div>
        <p className="text-xs text-faint">Rule engine v{result.engineVersion}</p>
      </div>

      {scenario && (
        <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-[13px] text-text ring-1 ring-accent/20">
          <span className="font-semibold">Fictional sample. </span>
          {scenario.lesson} The result below was produced live by the same engine that analyzes your own messages.
        </p>
      )}

      {banner}

      <Panel elevated className="mt-6">
        <div aria-live="polite">
          <ScoreSummary result={result} />
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Sticky on desktop so the text stays in view while the indicator list scrolls. */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Panel
            title="Suspicious text highlights"
            description="Stronger colors mark stronger indicators. Numbers match the indicator list."
          >
            <EvidenceView result={result} activeFindingId={activeFindingId} />
          </Panel>
        </div>
        <Panel
          title={`Detected threat indicators (${result.findings.length})`}
          description="Each one explains what was found and why it matters."
        >
          <IndicatorList
            result={result}
            activeFindingId={activeFindingId}
            onToggle={(fid) => {
              setActiveFindingId((current) => (current === fid ? null : fid));
            }}
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title="Recommended actions">
          <RecommendationList items={result.recommendations} />
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title={`Links found (${result.urls.length})`}>
            <LinkReports reports={result.urls} />
          </Panel>
          <Panel
            title="AI analysis summary"
            actions={<Badge icon={<Sparkles className="size-3" aria-hidden="true" />}>Not connected</Badge>}
          >
            <p className="text-[13px] leading-relaxed text-muted">
              AI review is not part of this version, so no summary is shown. Everything on this page comes from the rule
              engine, and every point can be traced to a rule above. When AI review is added, it will appear here as a
              separate, labelled opinion.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
