import { useNavigate } from 'react-router';
import { FlaskConical, PencilLine, Play } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { CONTENT_TYPE_META } from '@/features/analysis/engine';
import { useAnalyze } from '@/features/analysis/hooks/useAnalyze';
import { useAnalysisStore } from '@/features/analysis/store/analysisStore';
import { DEMO_SCENARIOS } from '@/features/demo/scenarios';
import { usePageTitle } from '@/lib/usePageTitle';

export function DemoPage() {
  usePageTitle('Interactive demo');
  const navigate = useNavigate();
  const setDraft = useAnalysisStore((s) => s.setDraft);
  const analyzeMutation = useAnalyze();
  const runningId = analyzeMutation.isPending ? analyzeMutation.variables.demoScenarioId : null;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">Interactive demo</h1>
      <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
        Six fictional messages, from obvious scams to a genuine notice. Run one to see the full analysis, or open it in
        the analyzer and change the wording to watch the score react.
      </p>
      <p className="mt-4 flex gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[13px] text-text ring-1 ring-accent/20">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        Every sample is invented for this demo, including the names and domains. Results are produced live by the rule
        engine, not pre-recorded.
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {DEMO_SCENARIOS.map((scenario) => (
          <li key={scenario.id} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">{scenario.title}</h2>
              <Badge>{CONTENT_TYPE_META[scenario.contentType].label}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              <span className="font-medium text-text">What to look for: </span>
              {scenario.lesson}
            </p>
            <p className="mt-3 line-clamp-3 rounded-lg bg-surface-2/60 px-3 py-2 font-mono text-[12.5px] leading-relaxed whitespace-pre-line text-muted ring-1 ring-line">
              {scenario.text}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={analyzeMutation.isPending}
                icon={runningId === scenario.id ? <Spinner /> : <Play className="size-3.5" aria-hidden="true" />}
                onClick={() => {
                  analyzeMutation.mutate({
                    contentType: scenario.contentType,
                    text: scenario.text,
                    demoScenarioId: scenario.id,
                  });
                }}
              >
                {runningId === scenario.id ? 'Analyzing…' : 'Run analysis'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<PencilLine className="size-3.5" aria-hidden="true" />}
                onClick={() => {
                  setDraft({ contentType: scenario.contentType, text: scenario.text, sampleId: scenario.id });
                  void navigate('/');
                }}
              >
                Edit in analyzer
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
