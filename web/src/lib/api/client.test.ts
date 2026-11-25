import { mockApi, json, problem } from '@/test/mockApi';
import { ApiError, api, del, get, post } from './client';

function setCsrfCookie(value: string) {
  document.cookie = `tg_csrf=${value}; path=/`;
}

describe('API client', () => {
  describe('CSRF protection', () => {
    it('adds the CSRF header to state-changing requests, copied from the cookie', async () => {
      setCsrfCookie('token-123');
      const { last, count } = mockApi({ 'POST /api/things': json({ ok: true }) });

      await post('/api/things', { a: 1 });

      expect(last('POST /api/things')?.headers.get('X-CSRF-Token')).toBe('token-123');
      expect(last('POST /api/things')?.body).toEqual({ a: 1 });
      expect(count('GET /api/auth/csrf')).toBe(0);
    });

    it('fetches a CSRF cookie first when there is none', async () => {
      const { calls } = mockApi({
        'GET /api/auth/csrf': json({ csrfToken: 'x' }),
        'POST /api/things': json({ ok: true }),
      });

      await post('/api/things', {});

      expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /api/auth/csrf', 'POST /api/things']);
    });

    it('does not send a CSRF header on reads', async () => {
      setCsrfCookie('token-123');
      const { last } = mockApi({ 'GET /api/things': json([]) });

      await get('/api/things');

      expect(last('GET /api/things')?.headers.has('X-CSRF-Token')).toBe(false);
    });

    it.each(['PUT', 'DELETE'])('protects %s requests too', async (method) => {
      setCsrfCookie('abc');
      const { last } = mockApi({ [`${method} /api/things`]: json({}) });
      await api(method, '/api/things');
      expect(last(`${method} /api/things`)?.headers.get('X-CSRF-Token')).toBe('abc');
    });
  });

  describe('session renewal', () => {
    it('renews an expired session once and retries the request', async () => {
      setCsrfCookie('abc');
      let renewed = false;
      const { count } = mockApi({
        'POST /api/auth/refresh': () => {
          renewed = true;
          return json({});
        },
        'GET /api/things': () => (renewed ? json({ ok: true }) : problem(401, 'session_expired', 'Expired')),
      });

      await expect(get('/api/things')).resolves.toEqual({ ok: true });
      expect(count('POST /api/auth/refresh')).toBe(1);
      expect(count('GET /api/things')).toBe(2);
    });

    it('shares one renewal between requests that expire together', async () => {
      setCsrfCookie('abc');
      let renewed = false;
      const { count } = mockApi({
        'POST /api/auth/refresh': async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          renewed = true;
          return json({});
        },
        'GET /api/things': () => (renewed ? json({ ok: true }) : problem(401, 'session_expired', 'Expired')),
      });

      await Promise.all([get('/api/things'), get('/api/things'), get('/api/things')]);

      expect(count('POST /api/auth/refresh')).toBe(1);
    });

    it('gives up and reports the 401 when renewal fails', async () => {
      setCsrfCookie('abc');
      const { count } = mockApi({
        'POST /api/auth/refresh': problem(401, 'session_revoked', 'Ended'),
        'GET /api/things': problem(401, 'session_expired', 'Your session expired.'),
      });

      await expect(get('/api/things')).rejects.toMatchObject({ status: 401, code: 'session_expired' });
      expect(count('GET /api/things')).toBe(1);
    });

    it('never tries to renew the session for sign-in itself', async () => {
      setCsrfCookie('abc');
      const { count } = mockApi({ 'POST /api/auth/login': problem(401, 'invalid_credentials', 'Wrong') });

      await expect(post('/api/auth/login', {})).rejects.toMatchObject({ code: 'invalid_credentials' });
      expect(count('POST /api/auth/refresh')).toBe(0);
    });

    it('retries once when another tab just renewed the session', async () => {
      setCsrfCookie('abc');
      let attempts = 0;
      const { count } = mockApi({
        'POST /api/auth/refresh': () => {
          attempts += 1;
          return attempts === 1 ? problem(409, 'refresh_in_progress', 'Retry') : json({});
        },
        'GET /api/things': () => (attempts >= 2 ? json({ ok: true }) : problem(401, 'session_expired', 'Expired')),
      });

      await expect(get('/api/things')).resolves.toEqual({ ok: true });
      expect(count('POST /api/auth/refresh')).toBe(2);
    });
  });

  describe('failures', () => {
    it('turns problem responses into ApiError with the code, message and field errors', async () => {
      mockApi({ 'GET /api/things': problem(400, 'weak_password', 'Too short.', { password: ['Use 10 characters.'] }) });

      const error = await get('/api/things').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 400,
        code: 'weak_password',
        message: 'Too short.',
        fieldErrors: { password: ['Use 10 characters.'] },
      });
    });

    it('falls back to a generic message when the error body is not JSON', async () => {
      mockApi({
        'GET /api/things': new Response('Bad gateway', { status: 502, headers: { 'content-type': 'text/plain' } }),
      });

      const error = await get('/api/things').catch((e: unknown) => e);

      expect(error).toMatchObject({
        status: 502,
        code: 'request_failed',
        message: 'The request could not be completed.',
      });
    });

    it('reports an unreachable server as unavailable', async () => {
      mockApi({
        'GET /api/things': () => {
          throw new TypeError('fetch failed');
        },
      });

      const error = await get('/api/things').catch((e: unknown) => e);

      expect(error).toMatchObject({ status: 0, code: 'network_error' });
      expect((error as ApiError).isUnavailable).toBe(true);
    });

    it('treats an HTML answer as "something other than the API replied"', async () => {
      mockApi({
        'GET /api/things': new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      });

      const error = await get('/api/things').catch((e: unknown) => e);

      expect(error).toMatchObject({ code: 'invalid_response' });
      expect((error as ApiError).isUnavailable).toBe(true);
    });

    it('does not call client errors "unavailable"', async () => {
      mockApi({ 'GET /api/things': problem(429, 'rate_limited', 'Slow down') });
      const error = await get('/api/things').catch((e: unknown) => e);
      expect((error as ApiError).isUnavailable).toBe(false);
    });

    it('lets an aborted request surface as an abort, not as a network error', async () => {
      mockApi({
        'GET /api/things': () => {
          throw new DOMException('Aborted', 'AbortError');
        },
      });
      await expect(get('/api/things')).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('returns undefined for 204 responses', async () => {
      setCsrfCookie('abc');
      mockApi({ 'DELETE /api/things/1': json(null, 204) });
      await expect(del('/api/things/1')).resolves.toBeUndefined();
    });
  });
});
