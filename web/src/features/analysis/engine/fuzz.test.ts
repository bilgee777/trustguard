// @vitest-environment node
import { analyze } from './analyze';
import { inspectUrl } from './url';
import { CONTENT_TYPES } from './types';

/**
 * Property-based test: user text is hostile by definition, so analysis must never throw and every
 * result must satisfy the same invariants whatever the input. The C# engine runs the same test.
 */
const FRAGMENTS = [
  'http://',
  'https://',
  'www.',
  '.com',
  '.top',
  'xn--',
  'xn--pypal-4ve',
  '%',
  '%zz',
  '%41',
  '%E0%A4%A',
  '@',
  ':',
  '[',
  ']',
  '::',
  '1.2.3.4',
  '0x7f000001',
  '256.1.1.1',
  '[::1]',
  ' ',
  '\t',
  '\n',
  '\r\n',
  '\r',
  '\u200b',
  '\u00ad',
  '\ufeff',
  '\u2028',
  '\ud83d\ude00',
  '\ud800',
  '\udc00',
  '\u0430',
  '\u03bf',
  'paypal',
  'paypa1',
  'Netflix',
  'verify your account',
  'URGENT',
  '$350 per day',
  'send me the code',
  '/',
  '?',
  '#',
  '\\',
  '\u00df',
  '\u0130',
  '\u01c5',
  'a',
  '9',
  '-',
  '.',
  'bit.ly/x',
  't.me/x',
  'gift card',
  'javascript:',
  'data:',
  'file:///',
  'user:pw@',
  '100%',
  '\u00a0',
  '\u0663',
  'xn--99999999',
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomText(random: () => number): string {
  const parts = 1 + Math.floor(random() * 25);
  let text = '';
  for (let i = 0; i < parts; i++) text += FRAGMENTS[Math.floor(random() * FRAGMENTS.length)] ?? '';
  return text;
}

describe('engine invariants under random input', () => {
  it('never throws and keeps every invariant', () => {
    const random = mulberry32(20260124);
    for (let i = 0; i < 3000; i++) {
      const text = randomText(random);
      const contentType = CONTENT_TYPES[Math.floor(random() * CONTENT_TYPES.length)] ?? 'sms';
      const context = `input #${i} (${contentType}): ${JSON.stringify(text)}`;

      const result = analyze({ contentType, text });

      expect(result.score, context).toBeGreaterThanOrEqual(0);
      expect(result.score, context).toBeLessThanOrEqual(100);
      expect(
        result.contributions.reduce((sum, c) => sum + c.points, 0),
        context,
      ).toBe(result.score);
      expect(new Set(result.findings.map((f) => f.id)).size, context).toBe(result.findings.length);
      for (const finding of result.findings) {
        expect(finding.weight, context).toBeGreaterThan(0);
        expect(finding.weight, context).toBeLessThan(1);
        for (const span of finding.spans) {
          expect(span.start >= 0 && span.end <= result.text.length && span.start < span.end, context).toBe(true);
        }
      }
      expect(result.highlights.map((h) => h.text).join(''), context).toBe(result.text);
      expect(result.text.isWellFormed(), context).toBe(true);
      expect(() => JSON.stringify(result), context).not.toThrow();
    }
  });

  it('inspects random links without throwing', () => {
    const random = mulberry32(77);
    for (let i = 0; i < 3000; i++) {
      const report = inspectUrl(randomText(random));
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.valid || report.parts === null).toBe(true);
    }
  });
});
