import { useId, useState, type SubmitEvent } from 'react';
import { useLocation } from 'react-router';
import { EyeOff, SearchCode, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { inspectUrl, RISK_LEVEL_META, type UrlReport } from '@/features/analysis/engine';
import { RISK_TONE } from '@/features/analysis/riskStyles';
import { UrlAnatomy } from '@/features/url-inspector/UrlAnatomy';
import { UrlChecks } from '@/features/url-inspector/UrlChecks';
import { cn } from '@/lib/cn';
import { usePageTitle } from '@/lib/usePageTitle';

const EXAMPLES = [
  'paypa1.com/login',
  'https://www.paypal.com@login-check.example/account',
  'https://xn--pypal-4ve.com/verify',
  'http://0x7f000001/admin',
  'bit.ly/3xYzAbc',
  'https://www.amazon.com/gp/your-account',
];

function initialUrl(state: unknown): string {
  if (state && typeof state === 'object' && 'url' in state && typeof state.url === 'string') return state.url;
  return '';
}

export function UrlInspectorPage() {
  usePageTitle('URL Inspector');
  const location = useLocation();
  const [value, setValue] = useState(() => initialUrl(location.state));
  const [report, setReport] = useState<UrlReport | null>(() => {
    const url = initialUrl(location.state);
    return url ? inspectUrl(url) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const run = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Paste the link you want to inspect.');
      setReport(null);
      return;
    }
    const result = inspectUrl(trimmed);
    if (!result.valid) {
      setError(result.checks[0]?.detail ?? 'This is not a well-formed web address.');
      setReport(null);
      return;
    }
    setError(null);
    setReport(result);
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(value);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">URL Inspector</h1>
      <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
        See where a link really leads before you open it. The link is taken apart as text and is never loaded.
      </p>

      <Panel elevated className="mt-6">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              Link to inspect
            </label>
            <input
              id={inputId}
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://example.com/login"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                'h-12 w-full rounded-xl bg-surface px-4 font-mono text-[14px] text-text ring-1 placeholder:font-sans placeholder:text-faint focus:ring-2 focus:outline-none',
                error ? 'ring-critical focus:ring-critical' : 'ring-line focus:ring-accent',
              )}
            />
            {error && (
              <p id={errorId} role="alert" className="mt-2 text-sm text-critical">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" icon={<SearchCode className="size-4" aria-hidden="true" />}>
            Inspect
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">Examples:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setValue(example);
                run(example);
              }}
              className="max-w-full truncate rounded-full bg-surface px-3 py-1 font-mono text-[12px] text-muted ring-1 ring-line hover:text-text hover:ring-line-strong"
            >
              {example}
            </button>
          ))}
        </div>
      </Panel>

      <div aria-live="polite">
        {report?.parts ? (
          <div className="mt-6 flex flex-col gap-6">
            <Panel title="Verdict" actions={<Badge tone={report.level}>{RISK_LEVEL_META[report.level].label}</Badge>}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <p className="text-4xl font-semibold tracking-tight tabular-nums">
                  {report.score}
                  <span className="ml-1 text-base font-normal text-faint">/100</span>
                </p>
                <p className={cn('max-w-[52ch] text-sm', RISK_TONE[report.level].text)}>
                  {report.findings.length === 0
                    ? report.officialBrand
                      ? `Official ${report.officialBrand} domain with no structural warning signs.`
                      : 'No structural warning signs. That does not prove the site is safe.'
                    : `${report.findings.length} warning sign${report.findings.length === 1 ? '' : 's'} in how this link is built.`}
                </p>
              </div>
              <p className="mt-4 text-[13px] text-muted">
                Safe-to-share form: <code className="font-mono break-all text-text">{report.defanged}</code>
              </p>
            </Panel>

            <Panel
              title="Anatomy of the link"
              description="Only the highlighted registrable domain decides who controls the site."
            >
              <UrlAnatomy parts={report.parts} />
            </Panel>

            <Panel title="Checks">
              <UrlChecks checks={report.checks} />
            </Panel>

            <div className="flex gap-3 rounded-xl bg-surface p-4 text-[13px] text-muted ring-1 ring-line">
              <EyeOff className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <p>
                These checks look at the structure of the address only. Domain age, reputation lists and redirect chains
                need a server-side lookup, which is not part of this version.
              </p>
            </div>
          </div>
        ) : (
          !error && (
            <div className="mt-10 flex flex-col items-center text-center">
              <ShieldQuestion className="size-8 text-faint" aria-hidden="true" />
              <p className="mt-3 max-w-sm text-sm text-muted">
                Paste a link or pick an example. You will see the real owner of the address and every check that was
                run.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
