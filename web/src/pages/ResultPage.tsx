import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { FileSearch } from 'lucide-react';
import { StatePanel } from '@/components/feedback/StatePanel';
import { ButtonLink } from '@/components/ui/Button';
import { ResultBanner } from '@/features/analysis/components/ResultBanner';
import { ResultView } from '@/features/analysis/components/ResultView';
import { useAnalysisStore } from '@/features/analysis/store/analysisStore';
import { useUser } from '@/features/auth/session';
import { usePageTitle } from '@/lib/usePageTitle';

export function ResultPage() {
  const { id = '' } = useParams();
  const outcome = useAnalysisStore((s) => s.results[id]);
  const user = useUser();
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageTitle(outcome ? `${outcome.result.score}/100 analysis result` : 'Result not available');

  useEffect(() => {
    headingRef.current?.focus();
  }, [id]);

  if (!outcome) {
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
        Fresh results are kept in memory only, so they are cleared when you reload or close the tab. That is
        intentional. To keep analyses, turn on history in your settings.
      </StatePanel>
    );
  }

  return (
    <ResultView
      key={outcome.result.id}
      result={outcome.result}
      title="Analysis result"
      backTo="/"
      backLabel="New analysis"
      headingRef={headingRef}
      banner={<ResultBanner outcome={outcome} historyMode={user?.settings.historyMode ?? null} />}
    />
  );
}
