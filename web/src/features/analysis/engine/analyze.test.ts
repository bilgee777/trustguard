import { analyze } from './analyze';
import { buildHighlights } from './highlights';

const run = (text: string, contentType: 'sms' | 'email' | 'job_offer' | 'url' | 'whatsapp' = 'sms') =>
  analyze({ contentType, text });

describe('analyze', () => {
  it('scores ordinary messages as low risk', () => {
    const result = run('Running 10 minutes late, order me a coffee please. See you at the station.');
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
    expect(result.recommendations[0]?.text).toMatch(/not a guarantee/);
  });

  it('flags one-time code requests as a strong signal', () => {
    const result = run('Hi, I sent you a code by mistake, can you send me the code please?');
    expect(result.findings.map((f) => f.ruleId)).toContain('personal_info.otp');
  });

  it('does not inflate the score when a phrase repeats', () => {
    const once = run('URGENT: reply now.').score;
    const many = run('URGENT URGENT URGENT URGENT: reply now.').score;
    expect(many).toBe(once);
  });

  it('detects invisible characters and look-alike letters', () => {
    const result = run('Your Pаypal acc​ount needs attention');
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).toContain('obfuscation.invisible');
    expect(ids).toContain('obfuscation.mixed_script');
  });

  it('reports impersonation when a brand message links elsewhere', () => {
    const result = run('Netflix: your payment failed. Update billing at https://netflix-billing-help.com');
    expect(result.findings.find((f) => f.ruleId === 'impersonation.brand')?.title).toBe('Claims to be Netflix');
  });

  it('does not report impersonation for official links', () => {
    const result = run('Your Netflix plan renews on 12 May. Manage it at https://www.netflix.com/account');
    expect(result.findings.map((f) => f.ruleId)).not.toContain('impersonation.brand');
  });

  it('treats URL content type input as a single link', () => {
    const result = run('  http://dhl-parcel.xyz/pay  ', 'url');
    expect(result.urls).toHaveLength(1);
    expect(result.level).not.toBe('low');
  });

  it('has contributions that add up to the score and match findings', () => {
    const result = run('Dear customer, your account will be suspended. Verify your account at http://bank-secure-login.top now');
    expect(result.contributions.reduce((s, c) => s + c.points, 0)).toBe(result.score);
    expect(result.contributions.map((c) => c.findingId)).toEqual(result.findings.map((f) => f.id));
  });

  it('gives low confidence for very short text', () => {
    expect(run('ok').confidence.level).toBe('low');
  });

  it('never produces an AI summary', () => {
    expect(run('test message').aiSummary).toBeNull();
  });
});

describe('buildHighlights', () => {
  it('splits overlapping spans into segments that rebuild the original text', () => {
    const text = 'abcdefghij';
    const segments = buildHighlights(text, [
      { id: 'a', ruleId: 'a', category: 'urgency', title: '', explanation: '', weight: 0.1, evidence: [], spans: [{ start: 2, end: 6 }] },
      { id: 'b', ruleId: 'b', category: 'urgency', title: '', explanation: '', weight: 0.1, evidence: [], spans: [{ start: 4, end: 8 }] },
    ]);
    expect(segments.map((s) => s.text).join('')).toBe(text);
    expect(segments.map((s) => s.findingIds)).toEqual([[], ['a'], ['a', 'b'], ['b'], []]);
  });
});
