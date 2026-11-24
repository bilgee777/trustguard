import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/usePageTitle';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-7 first:border-t-0 first:pt-0">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-text">
        {children}
      </div>
    </section>
  );
}

export function PrivacyPage() {
  usePageTitle('Privacy & Security');
  return (
    <div className="mx-auto max-w-[44rem] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">Privacy &amp; Security</h1>
      <p className="mt-2 text-[15px] text-muted">
        People paste bank messages, job offers and private chats into TrustGuard. This page explains exactly what
        happens to them.
      </p>

      <div className="mt-10">
        <Section title="What happens to your text in this version">
          <p>
            <strong>It never leaves your browser.</strong> The analysis runs on your device with a rule engine that
            ships with the page. Nothing is sent to a server, an AI provider or an analytics service.
          </p>
          <p>
            <strong>Results are kept in memory only</strong> and disappear when you reload or close the tab. The only
            thing saved on your device is your light or dark theme choice.
          </p>
        </Section>

        <Section title="Links are never opened">
          <p>
            The URL Inspector reads links as text. It does not visit them, load previews or follow redirects, so a
            malicious page cannot run code or learn that you looked at it.
          </p>
          <p>
            Links in results are shown in a defanged form, such as{' '}
            <code className="font-mono text-[13px] text-text">hxxps://example[.]com</code>, so they cannot be clicked or
            turned into links by accident when you copy them.
          </p>
        </Section>

        <Section title="How results should be read">
          <p>
            TrustGuard finds known warning signs. It cannot prove that a message is safe. A low score means no common
            pattern matched, and new or carefully targeted scams can still get through.
          </p>
          <p>
            Every point in a score is traced to a named rule and shown to you, so you can judge the reasoning yourself
            instead of trusting a number.
          </p>
        </Section>

        <Section title="Planned with accounts and AI review">
          <p>These safeguards are designed into the next version and are not active yet:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-faint">
            <li>History is off by default. You choose whether analyses are saved, and you can delete any of them.</li>
            <li>
              Email addresses, phone numbers, card and account numbers are redacted before anything is stored or sent to
              an AI model.
            </li>
            <li>
              Messages are passed to the AI as untrusted data, never as instructions, and its answer must match a strict
              schema or it is discarded.
            </li>
            <li>
              Server-side link checks block private network addresses and limit redirects to prevent abuse of the
              server.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
