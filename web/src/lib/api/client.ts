/**
 * The only place the web app talks to the API. It adds the CSRF header, renews an expired session once
 * and turns every failure into an ApiError with a stable `code`, so screens never parse raw responses.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: string;
  /** Field-level problems from validation responses, keyed by the API's property name. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** The API could not be reached or did not answer with JSON (offline, server down, wrong URL). */
  get isUnavailable(): boolean {
    return this.status === 0 || this.status >= 500 || this.code === 'invalid_response';
  }
}

const CSRF_COOKIE = 'tg_csrf';
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | null {
  for (const part of document.cookie.split('; ')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator) === name) return decodeURIComponent(part.slice(separator + 1));
  }
  return null;
}

interface Problem {
  title?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('json')) return undefined;
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function toError(response: Response, body: unknown): ApiError {
  const problem = (typeof body === 'object' && body !== null ? body : {}) as Problem;
  return new ApiError(
    response.status,
    problem.code ?? 'request_failed',
    problem.detail ?? problem.title ?? 'The request could not be completed.',
    problem.errors ?? {},
  );
}

let csrfPending: Promise<void> | null = null;

/** The CSRF cookie is issued by the API. Fetch one before the first state-changing request if missing. */
async function ensureCsrf(): Promise<void> {
  if (readCookie(CSRF_COOKIE) !== null) return;
  csrfPending ??= fetch('/api/auth/csrf', { credentials: 'same-origin' })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      csrfPending = null;
    });
  await csrfPending;
}

let refreshPending: Promise<boolean> | null = null;

/** Single flight: when several requests find the session expired together, only one renews it. */
export function refreshSession(): Promise<boolean> {
  refreshPending ??= (async () => {
    try {
      await ensureCsrf();
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'X-CSRF-Token': readCookie(CSRF_COOKIE) ?? '' },
        });
        if (response.ok) return true;
        const body = await readJson(response);
        // Another tab renewed the session a moment ago: its new cookies are already in place, so retry once.
        if (response.status === 409 && (body as Problem | undefined)?.code === 'refresh_in_progress') {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        return false;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPending = null;
    }
  })();
  return refreshPending;
}

export interface RequestOptions {
  body?: unknown;
  /** Set false for calls that must not trigger a session refresh (sign-in itself, the session probe). */
  renewSession?: boolean;
  signal?: AbortSignal;
  /** Let the request finish even if the page navigates away (used for sign-out, which must not be lost). */
  keepalive?: boolean;
}

export async function api<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (UNSAFE.has(method)) {
      await ensureCsrf();
      const token = readCookie(CSRF_COOKIE);
      if (token !== null) headers['X-CSRF-Token'] = token;
    }
    const init: RequestInit = { method, headers, credentials: 'same-origin' };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    if (options.signal) init.signal = options.signal;
    if (options.keepalive) init.keepalive = true;
    return fetch(path, init);
  };

  let response: Response;
  try {
    response = await send();
    if (
      response.status === 401 &&
      options.renewSession !== false &&
      !path.startsWith('/api/auth/') &&
      (await refreshSession())
    ) {
      response = await send();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'network_error',
      'Could not reach the TrustGuard server. Check your connection and try again.',
    );
  }

  const body = await readJson(response);
  if (!response.ok) throw toError(response, body);
  if (body === undefined && response.status !== 204) {
    // 200 with no JSON means something other than the API answered (for example a static file server).
    throw new ApiError(502, 'invalid_response', 'The server returned an unexpected response.');
  }
  return body as T;
}

export const get = <T>(path: string, options?: RequestOptions) => api<T>('GET', path, options);
export const post = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  api<T>('POST', path, { ...options, body });
export const put = <T>(path: string, body: unknown) => api<T>('PUT', path, { body });
export const del = <T = void>(path: string, body?: unknown) => api<T>('DELETE', path, { body });
