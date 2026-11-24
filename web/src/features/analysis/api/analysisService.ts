import { post, ApiError } from '@/lib/api/client';
import type { AnalyzeResponse } from '@/lib/api/types';
import { analyze, MAX_INPUT_LENGTH, type AnalysisResult, type ContentType } from '../engine';

export interface AnalyzeRequest {
  contentType: ContentType;
  text: string;
  demoScenarioId?: string | null;
}

export class ValidationError extends Error {
  override readonly name = 'ValidationError';
}

/** Same rules the API enforces. Client-side validation is for UX, never for security. */
export function validateAnalyzeRequest({ contentType, text }: AnalyzeRequest): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return contentType === 'url' ? 'Paste the link you want to check.' : 'Paste the message you want to check.';
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return `Text is too long. The limit is ${MAX_INPUT_LENGTH.toLocaleString('en')} characters.`;
  }
  if (contentType === 'url' && /\s/.test(trimmed)) {
    return 'Enter a single link without spaces. To check a whole message, choose another content type.';
  }
  return null;
}

export type AnalysisLocation = 'browser' | 'server';

export interface AnalysisOutcome {
  result: AnalysisResult;
  location: AnalysisLocation;
  saved: boolean;
  historyId: string | null;
  /** Set when the analysis did not go the way the user expected (for example the server was unreachable). */
  notice: string | null;
}

export interface AnalyzeOptions {
  /** True only for a signed-in user who turned history on. Otherwise the text never leaves the browser. */
  saveToServer: boolean;
}

function inBrowser(request: AnalyzeRequest, notice: string | null): AnalysisOutcome {
  const result = analyze(
    { contentType: request.contentType, text: request.text },
    {
      source: request.demoScenarioId ? 'demo' : 'user',
      demoScenarioId: request.demoScenarioId ?? null,
    },
  );
  return { result, location: 'browser', saved: false, historyId: null, notice };
}

/**
 * The single entry point the UI uses for analysis. The browser and server engines produce identical results
 * (they are tested against the same golden file), so where it runs is a privacy decision, not a quality one:
 * the message leaves the browser only when the user has history turned on. Demo samples never leave it.
 */
export async function analyzeContent(
  request: AnalyzeRequest,
  options: AnalyzeOptions = { saveToServer: false },
): Promise<AnalysisOutcome> {
  const error = validateAnalyzeRequest(request);
  if (error) throw new ValidationError(error);

  if (options.saveToServer && !request.demoScenarioId) {
    try {
      const response = await post<AnalyzeResponse>('/api/analyses', {
        contentType: request.contentType,
        text: request.text,
      });
      return {
        result: response.result,
        location: 'server',
        saved: response.saved,
        historyId: response.historyId,
        notice: null,
      };
    } catch (failure) {
      if (!(failure instanceof ApiError)) throw failure;
      if (failure.status === 401) {
        return inBrowser(
          request,
          'Your session expired, so this analysis ran in your browser and was not saved. Sign in again to keep saving.',
        );
      }
      if (failure.isUnavailable) {
        return inBrowser(
          request,
          'The server could not be reached, so this analysis ran in your browser and was not saved.',
        );
      }
      throw failure;
    }
  }

  // Yield to the event loop so the pending state renders before the synchronous engine runs.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return inBrowser(request, null);
}
