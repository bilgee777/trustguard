import { analyze, MAX_INPUT_LENGTH, type AnalysisResult, type ContentType } from '../engine';

export interface AnalyzeRequest {
  contentType: ContentType;
  text: string;
  demoScenarioId?: string | null;
}

export class ValidationError extends Error {
  override readonly name = 'ValidationError';
}

/** Same rules the API will enforce. Client-side validation is for UX, never for security. */
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

/**
 * The single entry point the UI uses for analysis. Today it runs the rule engine in the
 * browser; in the next phase it calls POST /api/analyses and the engine moves server-side
 * next to the AI service. Components do not change when that happens.
 */
export async function analyzeContent(request: AnalyzeRequest): Promise<AnalysisResult> {
  const error = validateAnalyzeRequest(request);
  if (error) throw new ValidationError(error);
  // Yield to the event loop so the pending state renders before the synchronous engine runs.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return analyze(
    { contentType: request.contentType, text: request.text },
    {
      source: request.demoScenarioId ? 'demo' : 'user',
      demoScenarioId: request.demoScenarioId ?? null,
    },
  );
}
