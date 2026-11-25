import { analyze } from '@/features/analysis/engine';
import { ApiError } from '@/lib/api/client';
import { json, mockApi, problem } from '@/test/mockApi';
import { analyzeContent, validateAnalyzeRequest, ValidationError } from './analysisService';

const SCAM = 'URGENT: verify your account at http://paypa1-login.top now';
const request = { contentType: 'sms' as const, text: SCAM };

function serverReply(saved = true) {
  return json({ result: analyze({ contentType: 'sms', text: SCAM }), saved, historyId: saved ? 'history-1' : null });
}

describe('validateAnalyzeRequest', () => {
  it('accepts a normal message', () => {
    expect(validateAnalyzeRequest(request)).toBeNull();
  });

  it('asks for a message or a link depending on the type', () => {
    expect(validateAnalyzeRequest({ contentType: 'sms', text: '  ' })).toBe('Paste the message you want to check.');
    expect(validateAnalyzeRequest({ contentType: 'url', text: '' })).toBe('Paste the link you want to check.');
  });

  it('enforces the length limit', () => {
    expect(validateAnalyzeRequest({ contentType: 'sms', text: 'a'.repeat(10_000) })).toBeNull();
    expect(validateAnalyzeRequest({ contentType: 'sms', text: 'a'.repeat(10_001) })).toMatch(/too long/);
  });

  it('wants a single link for the URL type', () => {
    expect(validateAnalyzeRequest({ contentType: 'url', text: 'not a link' })).toMatch(/single link/);
    expect(validateAnalyzeRequest({ contentType: 'url', text: 'https://example.com' })).toBeNull();
  });
});

describe('analyzeContent', () => {
  it('rejects invalid input before doing anything', async () => {
    const { fetchMock } = mockApi();
    await expect(analyzeContent({ contentType: 'sms', text: '' })).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('analyzes in the browser and sends nothing when history is off', async () => {
    const { fetchMock } = mockApi({ 'POST /api/analyses': serverReply() });

    const outcome = await analyzeContent(request, { saveToServer: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ location: 'browser', saved: false, historyId: null, notice: null });
    expect(outcome.result.score).toBeGreaterThan(75);
  });

  it('is the default for anonymous callers', async () => {
    const { fetchMock } = mockApi();
    await analyzeContent(request);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the message to the server only when history is on', async () => {
    const { last } = mockApi({ 'POST /api/analyses': serverReply() });

    const outcome = await analyzeContent(request, { saveToServer: true });

    expect(last('POST /api/analyses')?.body).toEqual({ contentType: 'sms', text: SCAM });
    expect(outcome).toMatchObject({ location: 'server', saved: true, historyId: 'history-1', notice: null });
  });

  it('never sends demo samples, even when history is on', async () => {
    const { fetchMock } = mockApi({ 'POST /api/analyses': serverReply() });

    const outcome = await analyzeContent({ ...request, demoScenarioId: 'fake-bank-sms' }, { saveToServer: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.location).toBe('browser');
    expect(outcome.result.source).toBe('demo');
  });

  it('reports a server that declined to save', async () => {
    mockApi({ 'POST /api/analyses': serverReply(false) });
    expect(await analyzeContent(request, { saveToServer: true })).toMatchObject({ location: 'server', saved: false });
  });

  it('falls back to the browser, and says so, when the server is unreachable', async () => {
    mockApi({
      'POST /api/analyses': () => {
        throw new TypeError('fetch failed');
      },
    });

    const outcome = await analyzeContent(request, { saveToServer: true });

    expect(outcome.location).toBe('browser');
    expect(outcome.saved).toBe(false);
    expect(outcome.notice).toMatch(/could not be reached/);
    expect(outcome.result.score).toBeGreaterThan(75);
  });

  it('falls back on a server error too', async () => {
    mockApi({ 'POST /api/analyses': problem(500, 'internal_error', 'Boom') });
    expect((await analyzeContent(request, { saveToServer: true })).notice).toMatch(/could not be reached/);
  });

  it('falls back, with its own message, when the session has ended', async () => {
    mockApi({ 'POST /api/analyses': problem(401, 'session_expired', 'Expired') });
    const outcome = await analyzeContent(request, { saveToServer: true });
    expect(outcome.location).toBe('browser');
    expect(outcome.notice).toMatch(/session expired/);
  });

  it('surfaces errors the user can act on instead of hiding them', async () => {
    mockApi({ 'POST /api/analyses': problem(429, 'rate_limited', 'Slow down') });
    await expect(analyzeContent(request, { saveToServer: true })).rejects.toBeInstanceOf(ApiError);
  });
});
