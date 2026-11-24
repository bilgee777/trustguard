import { useState, type SubmitEvent } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { useDeleteAccount, useUpdateSettings } from '@/features/auth/hooks';
import { useUser } from '@/features/auth/session';
import { useDeleteAllHistory } from '@/features/history/hooks';
import { ApiError } from '@/lib/api/client';
import type { HistoryMode, User } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { usePageTitle } from '@/lib/usePageTitle';

const MODES: { value: HistoryMode; title: string; description: string; tag?: string }[] = [
  {
    value: 'off',
    title: 'Off',
    tag: 'Default',
    description:
      'Nothing about your messages is saved. Analyses run in your browser, so the text never leaves your device.',
  },
  {
    value: 'summary',
    title: 'Summary only',
    description:
      'Saves the risk score, the level and the names of the indicators found. The message is sent to the server to be analyzed, but its text is never stored.',
  },
  {
    value: 'redacted_text',
    title: 'Summary and masked text',
    description:
      'Also saves a copy of the message with personal data masked: emails, phone numbers, card, IBAN and ID numbers, one-time codes and link tokens. You can reopen the full analysis later.',
  },
];

const RETENTION_OPTIONS = [7, 30, 90, 365];

function HistorySettings({ user }: { user: User }) {
  const update = useUpdateSettings(user);
  const [mode, setMode] = useState<HistoryMode>(user.settings.historyMode);
  const [days, setDays] = useState(user.settings.retentionDays);
  const [saved, setSaved] = useState(false);

  const dirty = mode !== user.settings.historyMode || days !== user.settings.retentionDays;
  const losesStoredText = user.settings.historyMode === 'redacted_text' && mode !== 'redacted_text';

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    update.mutate(
      { historyMode: mode, retentionDays: days },
      {
        onSuccess: () => {
          setSaved(true);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-text">What to keep</legend>
        {MODES.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl p-4 ring-1 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
              mode === option.value ? 'bg-accent-soft ring-accent/50' : 'bg-surface ring-line hover:ring-line-strong',
            )}
          >
            <input
              type="radio"
              name="history-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => {
                setMode(option.value);
                setSaved(false);
              }}
              className="mt-1 size-4 shrink-0 accent-[var(--c-accent)]"
            />
            <span>
              <span className="flex items-center gap-2 text-[15px] font-medium text-text">
                {option.title}
                {option.tag && (
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted ring-1 ring-line">
                    {option.tag}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[13px] leading-relaxed text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="retention" className="mb-1.5 block text-sm font-medium text-text">
          Keep saved analyses for
        </label>
        <select
          id="retention"
          value={days}
          onChange={(event) => {
            setDays(Number(event.target.value));
            setSaved(false);
          }}
          className="h-11 rounded-xl bg-surface px-3.5 text-[15px] text-text ring-1 ring-line focus:ring-2 focus:ring-accent focus:outline-none"
        >
          {RETENTION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 365 ? '1 year' : `${option} days`}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[13px] text-muted">
          Older analyses are deleted automatically. Changing this also applies to analyses you already saved.
        </p>
      </div>

      {losesStoredText && (
        <p
          role="status"
          className="flex gap-2.5 rounded-xl bg-moderate-soft px-4 py-3 text-[13px] text-text ring-1 ring-moderate/25"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-moderate" aria-hidden="true" />
          Saving will permanently delete the masked message text already stored. Scores and indicator names are kept.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!dirty || update.isPending} icon={update.isPending ? <Spinner /> : undefined}>
          {update.isPending ? 'Saving…' : 'Save settings'}
        </Button>
        {saved && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm text-low">
            <Check className="size-4" aria-hidden="true" />
            Settings saved.
          </p>
        )}
        {update.error && (
          <p role="alert" className="text-sm text-critical">
            {update.error instanceof ApiError ? update.error.message : 'Settings could not be saved.'}
          </p>
        )}
      </div>
    </form>
  );
}

export function SettingsPage() {
  usePageTitle('Settings');
  const user = useUser();
  const deleteAll = useDeleteAllHistory();
  const deleteAccount = useDeleteAccount();
  const [confirmHistory, setConfirmHistory] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [password, setPassword] = useState('');

  if (!user) return null;

  const closeAccount = () => {
    setConfirmAccount(false);
    setPassword('');
    deleteAccount.reset();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">Settings</h1>
      <p className="mt-2 text-[15px] text-muted">
        Signed in as <span className="font-medium text-text">{user.displayName}</span>, {user.email}.
      </p>

      <Panel className="mt-8" title="History" description="You decide whether anything is saved, and for how long.">
        <HistorySettings user={user} />
      </Panel>

      <Panel className="mt-6" title="Your data" description="Deleting is immediate and permanent.">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmHistory(true);
            }}
          >
            Delete all history
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmAccount(true);
            }}
          >
            Delete my account
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={confirmHistory}
        title="Delete all history?"
        description="Every saved analysis will be permanently deleted. This cannot be undone."
        confirmLabel="Delete everything"
        pending={deleteAll.isPending}
        error={deleteAll.error instanceof ApiError ? deleteAll.error.message : null}
        onCancel={() => {
          setConfirmHistory(false);
          deleteAll.reset();
        }}
        onConfirm={() => {
          deleteAll.mutate(undefined, {
            onSuccess: () => {
              setConfirmHistory(false);
            },
          });
        }}
      />

      <ConfirmDialog
        open={confirmAccount}
        title="Delete your account?"
        description="Your account, your sessions and every saved analysis will be permanently deleted. This cannot be undone."
        confirmLabel="Delete account"
        pending={deleteAccount.isPending}
        error={deleteAccount.error instanceof ApiError ? deleteAccount.error.message : null}
        onCancel={closeAccount}
        onConfirm={() => {
          deleteAccount.mutate(password);
        }}
      >
        <TextField
          label="Confirm with your password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </ConfirmDialog>
    </div>
  );
}
