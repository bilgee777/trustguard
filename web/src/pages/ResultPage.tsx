import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ArrowLeft, Clock, FileSearch, FlaskConical, Sparkles } from 'lucide-react';
import { StatePanel } from '@/components/feedback/StatePanel';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { EvidenceView } from '@/features/analysis/components/EvidenceView';
import { IndicatorList } from '@/features/analysis/components/IndicatorList';
import { LinkReports } from '@/features/analysis/components/LinkReports';
import { RecommendationList } from '@/features/analysis/components/RecommendationList';
import { ScoreSummary } from '@/features/analysis/components/ScoreSummary';
import { CONTENT_TYPE_META } from '@/features/analysis/engine';
import { useAnalysisStore } from '@/features/analysis/store/analysisStore';
import { findScenario } from '@/features/demo/scenarios';
import { formatDateTime } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';

export function ResultPage() {
  const { id = '' } = useParams();
  const result = useAnalysisStore((s) => s.results[id]);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageTitle(result ? `${result.score}/100 analysis result` : 'Result not available');

  useEffect(() => {
    headingRef.current?.focus();
  }, [id]);

  if (!result) {
    return (
      <StatePanel
        icon={<FileSearch className="size-5" />}
        title="This result is no longer available"
        actions={
          <>
            <ButtonLink to="/">Analyze a message</ButtonLink>
            <ButtonLink to="/demo" variant="secondary">
              Open the demo
            </ButtonLink>
          </>
        }
      >
        Results are kept in memory only, so they are cleared when you reload or close the tab. That is intentional: your
        messages are never written to disk or sent to a server in this version.
      </StatePanel>
    );
  }

  const scenario = result.demoScenarioId ? findScenario(result.demoScenarioId) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <ButtonLink
        to="/"
        variant="ghost"
        size="sm"
        className="-ml-2"
        icon={<ArrowLeft className="size-4" aria-hidden="true" />}
      >
        New analysis
      </ButtonLink>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
            Analysis result
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{CONTENT_TYPE_META[result.contentType].label}</Badge>
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
