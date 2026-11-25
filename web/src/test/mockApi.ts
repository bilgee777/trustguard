import { vi } from 'vitest';

export interface RecordedRequest {
  method: string;
  path: string;
  search: string;
  body: unknown;
  headers: Headers;
}

export type Handler = Response | ((request: RecordedRequest) => Response | Promise<Response>);

export function json(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** An RFC 7807 problem response, like the API's. */
export function problem(status: number, code: string, detail: string, errors: Record<string, string[]> = {}): Response {
  return new Response(JSON.stringify({ title: detail, detail, code, errors }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

/**
 * Replaces fetch with an in-memory API. Routes are keyed "METHOD /path". Every request is recorded, and an
 * unmocked route answers 404, so a test can never reach the network by accident.
 */
export function mockApi(routes: Record<string, Handler> = {}) {
  const calls: RecordedRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const request: RecordedRequest = {
      method,
      path: url.pathname,
      search: url.search,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      headers: new Headers(init?.headers),
    };
    calls.push(request);

    const handler = routes[`${method} ${url.pathname}`];
    if (handler === undefined) return problem(404, 'not_found', `No mock for ${method} ${url.pathname}`);
    return typeof handler === 'function' ? handler(request) : handler.clone();
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    calls,
    count: (key: string) => calls.filter((call) => `${call.method} ${call.path}` === key).length,
    last: (key: string) => calls.findLast((call) => `${call.method} ${call.path}` === key),
  };
}
