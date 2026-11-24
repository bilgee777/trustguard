import { Lock } from 'lucide-react';
import { Link } from 'react-router';
import { Panel } from '@/components/ui/Panel';
import { AnalyzerForm } from '@/features/analysis/components/AnalyzerForm';
import { CATEGORY_META, INDICATOR_CATEGORIES } from '@/features/analysis/engine';
import { usePageTitle } from '@/lib/usePageTitle';

export function AnalyzerPage() {
  usePageTitle(null);
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]">
          Think before you trust.
        </h1>
        <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
          Paste a message or link you are unsure about. TrustGuard marks the parts that look like a scam and explains
          why.
        </p>
        <Panel elevated className="mt-6">
          <AnalyzerForm />
        </Panel>
      </div>

      <aside aria-labelledby="checks-title" className="lg:pt-[5.75rem]">
        <h2 id="checks-title" className="text-sm font-semibold">
          What gets checked
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {INDICATOR_CATEGORIES.map((category) => (
            <li key={category} className="border-l-2 border-line pl-3">
              <p className="text-[13px] font-medium text-text">{CATEGORY_META[category].label}</p>
              <p className="text-[12.5px] leading-snug text-muted">{CATEGORY_META[category].description}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
          <Lock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-[13px] text-muted">
            Nothing you paste leaves this browser in this version.{' '}
            <Link to="/privacy" className="font-medium text-accent hover:text-accent-strong">
              Read how data is handled
            </Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
