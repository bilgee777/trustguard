import type { ReactNode } from 'react';
import { Link } from 'react-router';
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
        <Section title="By default, your message never leaves your browser">
          <p>
            <strong>Analysis runs on your device.</strong> A rule engine that ships with the page checks the message.
            Without an account, or with history turned off, nothing you paste is sent to a server, an AI provider or an
            analytics service.
          </p>
          <p>
            Every result says where it was produced. The demo samples are fictional and are always analyzed in your
            browser.
          </p>
        </Section>

        <Section title="When something is sent, and what is saved">
          <p>
            Only if you sign in <strong>and</strong> turn history on does a message go to our server. It is analyzed
            there with the same engine (both engines are tested against the same expected results, so the score is the
            same) and then handled according to the mode you chose:
          </p>
          <ul className="list-disc space-y-2 pl-5 marker:text-faint">
            <li>
              <strong>Off:</strong> nothing is saved. This is the default.
            </li>
            <li>
              <strong>Summary only:</strong> the risk score, level, content type, date and the names of the indicators
              found. The message text is not stored.
            </li>
            <li>
              <strong>Summary and masked text:</strong> additionally, a copy of the message with personal data masked.
              The original text is never stored.
            </li>
          </ul>
          <p>
            Masking covers email addresses (the domain is kept, because look-alike domains are a warning sign), phone
            numbers, card numbers, IBANs, national ID numbers, one-time codes, and passwords and query values inside
            links. It errs on the side of masking too much.
          </p>
        </Section>

        <Section title="Your controls">
          <ul className="list-disc space-y-2 pl-5 marker:text-faint">
            <li>Choose how long saved analyses are kept (7 days to a year). Older ones are deleted automatically.</li>
            <li>Delete a single analysis, or all of your history, at any time.</li>
            <li>Switching from masked text to summary only deletes the masked text that was already stored.</li>
            <li>Delete your account to remove it together with every saved analysis and session.</li>
          </ul>
          <p>
            Manage these in your{' '}
            <Link to="/settings" className="font-medium text-accent hover:text-accent-strong">
              settings
            </Link>
            .
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

        <Section title="How accounts are protected">
          <ul className="list-disc space-y-2 pl-5 marker:text-faint">
            <li>Passwords are stored only as salted hashes, never in a form that can be read back.</li>
            <li>
              Your session lives in cookies that scripts cannot read and that browsers never send from other sites.
              Requests that change data also need a one-time token, which blocks forged requests.
            </li>
            <li>Session tokens are stored hashed. A token that is replayed after use ends the whole session.</li>
            <li>Repeated failed sign-ins lock the account for a while, and every endpoint is rate limited.</li>
          </ul>
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

        <Section title="Not part of this version">
          <p>
            AI review is not connected, so no message is ever sent to an AI model. When it is added, masked text will be
            used and the AI&apos;s answer will appear as a separate, labelled opinion next to the rule-based result.
          </p>
        </Section>
      </div>
    </div>
  );
}
