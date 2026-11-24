import { useId, useState, type SubmitEvent, type KeyboardEvent } from 'react';
import { Eraser, FlaskConical, ScanSearch } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { DEMO_SCENARIOS, findScenario } from '@/features/demo/scenarios';
import { ValidationError, validateAnalyzeRequest } from '../api/analysisService';
import { CONTENT_TYPES, CONTENT_TYPE_META, MAX_INPUT_LENGTH, type ContentType } from '../engine';
import { useAnalyze } from '../hooks/useAnalyze';
import { useAnalysisStore } from '../store/analysisStore';

const TYPE_OPTIONS = CONTENT_TYPES.map((value) => ({ value, label: CONTENT_TYPE_META[value].label }));

export function AnalyzerForm() {
  const draft = useAnalysisStore((s) => s.draft);
  const setDraft = useAnalysisStore((s) => s.setDraft);
  const resetDraft = useAnalysisStore((s) => s.resetDraft);
  const analyzeMutation = useAnalyze();
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaId = useId();
  const errorId = useId();
  const hintId = useId();

  const sample = draft.sampleId ? findScenario(draft.sampleId) : undefined;
  const pending = analyzeMutation.isPending;
  const serverError =
    analyzeMutation.error && !(analyzeMutation.error instanceof ValidationError)
      ? 'The analysis could not be completed. Try again, and if it keeps failing, reload the page.'
      : null;

  const submit = (event?: SubmitEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const request = { contentType: draft.contentType, text: draft.text, demoScenarioId: draft.sampleId };
    const error = validateAnalyzeRequest(request);
    setValidationError(error);
    if (error) {
      document.getElementById(textareaId)?.focus();
      return;
    }
    analyzeMutation.mutate(request);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
  };

  const loadSample = (id: string) => {
    const scenario = findScenario(id);
    if (!scenario) return;
    setValidationError(null);
    setDraft({ contentType: scenario.contentType, text: scenario.text, sampleId: scenario.id });
  };

  const length = draft.text.length;
  const nearLimit = length > MAX_INPUT_LENGTH * 0.9;

  return (
    <form onSubmit={submit} noValidate aria-busy={pending} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Content type"
          options={TYPE_OPTIONS}
          value={draft.contentType}
          onChange={(contentType: ContentType) => {
            setDraft({ contentType });
            setValidationError(null);
          }}
        />
        {sample && (
          <Badge tone="accent" icon={<FlaskConical className="size-3" aria-hidden="true" />}>
            Fictional demo sample
          </Badge>
        )}
      </div>

      <div>
        <label htmlFor={textareaId} className="sr-only">
          Content to analyze
        </label>
        <div
          className={cn(
            'relative overflow-hidden rounded-xl bg-surface ring-1 transition-shadow focus-within:ring-2',
            validationError ? 'ring-critical focus-within:ring-critical' : 'ring-line focus-within:ring-accent',
          )}
        >
          {pending && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
              <div className="h-px w-1/3 animate-[scan_1.1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent to-transparent" />
            </div>
          )}
          <textarea
            id={textareaId}
            value={draft.text}
            onChange={(e) => {
              setDraft({ text: e.target.value, sampleId: null });
              if (validationError) setValidationError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder={CONTENT_TYPE_META[draft.contentType].placeholder}
            rows={draft.contentType === 'url' ? 3 : 9}
            maxLength={MAX_INPUT_LENGTH}
            spellCheck={false}
            aria-invalid={validationError ? true : undefined}
            aria-describedby={cn(validationError ? errorId : '', hintId) || undefined}
            className="block w-full resize-y bg-transparent px-4 py-3.5 font-mono text-[13.5px] leading-relaxed text-text placeholder:font-sans placeholder:text-[14px] placeholder:text-faint focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-xs text-faint">
            <span id={hintId}>
              Text is analyzed in your browser and is not stored.{' '}
              <span className="hidden sm:inline">Press Ctrl + Enter to analyze.</span>
            </span>
            <span className={cn('tabular-nums', nearLimit && 'text-moderate')} aria-live="polite">
              {length.toLocaleString('en')} / {MAX_INPUT_LENGTH.toLocaleString('en')}
            </span>
          </div>
        </div>
        {validationError && (
          <p id={errorId} className="mt-2 text-sm text-critical" role="alert">
            {validationError}
          </p>
        )}
        {serverError && (
          <p className="mt-2 text-sm text-critical" role="alert">
            {serverError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          icon={pending ? <Spinner /> : <ScanSearch className="size-4" aria-hidden="true" />}
        >
          {pending ? 'Analyzing…' : 'Analyze'}
        </Button>
        {draft.text && !pending && (
          <Button
            variant="ghost"
            size="lg"
            icon={<Eraser className="size-4" aria-hidden="true" />}
            onClick={() => {
              resetDraft();
              setValidationError(null);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <p className="mb-2.5 text-[13px] text-muted" id="samples-label">
          No message at hand? Load a fictional sample:
        </p>
        <ul aria-labelledby="samples-label" className="flex flex-wrap gap-2">
          {DEMO_SCENARIOS.map((scenario) => (
            <li key={scenario.id}>
              <button
                type="button"
                aria-pressed={draft.sampleId === scenario.id}
                onClick={() => {
                  loadSample(scenario.id);
                }}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[13px] ring-1 transition-colors',
                  draft.sampleId === scenario.id
                    ? 'bg-accent-soft text-accent-strong ring-accent/40'
                    : 'bg-surface text-muted ring-line hover:text-text hover:ring-line-strong',
                )}
              >
                {scenario.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
