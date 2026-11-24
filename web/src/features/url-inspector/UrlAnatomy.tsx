import type { UrlParts } from '@/features/analysis/engine';
import { cn } from '@/lib/cn';

interface Part {
  key: string;
  label: string;
  value: string;
  className: string;
}

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * Marks every non-ASCII character so look-alike letters become visible. Splits by grapheme,
 * not code point, so a letter with a combining accent stays one marked unit.
 */
function DisplayHost({ value }: { value: string }) {
  return (
    <>
      {Array.from(graphemes.segment(value), (s) => s.segment).map((char, index) =>
        (char.codePointAt(0) ?? 0) > 127 || char.length > 1 ? (
          <mark
            key={index}
            className="rounded-[3px] bg-critical-soft px-px text-critical underline decoration-critical"
          >
            {char}
            <span className="sr-only">
              {' '}
              (non-Latin character U+{char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')})
            </span>
          </mark>
        ) : (
          <span key={index}>{char}</span>
        ),
      )}
    </>
  );
}

/** Splits a URL into labelled parts so the user can see which part decides ownership. */
export function UrlAnatomy({ parts }: { parts: UrlParts }) {
  const list: Part[] = [
    { key: 'scheme', label: 'Protocol', value: parts.scheme ? `${parts.scheme}://` : '', className: 'text-faint' },
    {
      key: 'user',
      label: 'Ignored text before @',
      value: parts.username ? `${parts.username}@` : '',
      className: 'bg-critical-soft text-critical line-through decoration-critical/60',
    },
    { key: 'sub', label: 'Subdomain', value: parts.subdomain ? `${parts.subdomain}.` : '', className: 'text-muted' },
    {
      key: 'domain',
      label: 'Registrable domain (the owner)',
      value: parts.registrableDomain,
      className: 'bg-accent-soft font-semibold text-accent-strong',
    },
    { key: 'port', label: 'Port', value: parts.port ? `:${parts.port}` : '', className: 'text-moderate' },
    { key: 'path', label: 'Path', value: parts.path === '/' ? '' : parts.path, className: 'text-muted' },
    { key: 'query', label: 'Query', value: parts.query, className: 'text-faint' },
  ].filter((p) => p.value);

  return (
    <div>
      <p className="rounded-xl bg-surface-2/60 p-4 font-mono text-[14px] leading-relaxed break-all ring-1 ring-line">
        {list.map((part) => (
          <span key={part.key} className={cn('rounded px-0.5', part.className)}>
            {part.value}
          </span>
        ))}
      </p>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
        {list.map((part) => (
          <div key={part.key} className="min-w-0">
            <dt className="text-faint">{part.label}</dt>
            <dd className="mt-0.5 font-mono text-[12.5px] break-all text-text">{part.value}</dd>
          </div>
        ))}
        {parts.unicodeHost !== parts.host && (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-faint">How the address bar may display it</dt>
            <dd className="mt-0.5 font-mono text-[12.5px] break-all text-text">
              <DisplayHost value={parts.unicodeHost} />
            </dd>
            <dd className="mt-1 text-[12.5px] text-muted">
              Marked letters are not Latin, even if they look identical. The registered name is{' '}
              {parts.registrableDomain}.
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
