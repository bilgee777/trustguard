import { SearchCode } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RISK_LEVEL_META, type UrlReport } from '../engine';

export function LinkReports({ reports }: { reports: UrlReport[] }) {
  const navigate = useNavigate();
  if (reports.length === 0) {
    return <p className="text-sm text-muted">No links were found in this content.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report, index) => {
        const worst = report.checks.find((c) => c.status === 'fail') ?? report.checks.find((c) => c.status === 'warn');
        return (
          <li key={`${report.input}-${index}`} className="rounded-xl bg-surface-2/60 p-3.5 ring-1 ring-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all text-text">{report.defanged}</code>
              <Badge tone={report.level}>
                {RISK_LEVEL_META[report.level].label} ({report.score})
              </Badge>
            </div>
            {report.officialBrand && (
              <p className="mt-2 text-[13px] text-muted">Official {report.officialBrand} domain.</p>
            )}
            {worst && <p className="mt-2 text-[13px] text-muted">{worst.detail}</p>}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-2"
              icon={<SearchCode className="size-3.5" aria-hidden="true" />}
              onClick={() => {
                void navigate('/url-inspector', { state: { url: report.input } });
              }}
            >
              Inspect link
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
